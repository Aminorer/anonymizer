from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from uuid import uuid4
from pathlib import Path
from difflib import get_close_matches
from .anonymizer import RegexAnonymizer, Entity
from .ai_anonymizer import AIAnonymizer
import os
import json

app = FastAPI(title="Anonymiseur de documents juridiques")
regex_anonymizer = RegexAnonymizer()
ai_anonymizer = AIAnonymizer()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
templates = Jinja2Templates(directory="backend/templates")

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_FILE_SIZE_MB = 25

# simple in-memory job store
jobs: dict[str, dict] = {}

# in-memory stores for entities and groups
class EntityModel(BaseModel):
    id: str
    type: str
    value: str
    start: int = 0
    end: int = 0
    group_id: str | None = None


class GroupModel(BaseModel):
    id: str
    name: str
    entities: list[str] = []


# in-memory stores keyed by job then by entity/group id
entities_db: dict[str, dict[str, EntityModel]] = {}
groups_db: dict[str, dict[str, GroupModel]] = {}


class ExportOptions(BaseModel):
    watermark: str | None = None
    audit: bool = False

# configuration model for rules
class RegexRule(BaseModel):
    pattern: str
    replacement: str


class RulesConfig(BaseModel):
    regex_rules: list[RegexRule] = []
    ner: dict = {}
    styles: dict[str, str] = {}


RULES_FILE = Path("backend/rules.json")


def load_rules() -> RulesConfig:
    if RULES_FILE.exists():
        data = json.loads(RULES_FILE.read_text(encoding="utf-8"))
        return RulesConfig.parse_obj(data)
    return RulesConfig()


def save_rules(cfg: RulesConfig) -> None:
    RULES_FILE.write_text(
        json.dumps(cfg.dict(), indent=2, ensure_ascii=False), encoding="utf-8"
    )


@app.get("/rules", response_model=RulesConfig)
def get_rules() -> RulesConfig:
    """Return current anonymization rules."""
    return load_rules()


@app.put("/rules", response_model=RulesConfig)
def update_rules(cfg: RulesConfig) -> RulesConfig:
    """Persist updated anonymization rules."""
    save_rules(cfg)
    return cfg


def merge_entities(a: list[Entity], b: list[Entity]) -> list[Entity]:
    seen = set()
    merged = []
    for ent in a + b:
        key = (ent.start, ent.end, ent.type, ent.value)
        if key not in seen:
            seen.add(key)
            merged.append(ent)
    return merged

@app.get("/", response_class=HTMLResponse)
def read_index(request: Request):
    """Render the upload page."""
    return templates.TemplateResponse("index.html", {"request": request})

def _process_file(job_id: str, mode: str, confidence: float, contents: bytes, filename: str):
    """Internal worker updating job status while processing the file."""
    try:
        extension = filename.split(".")[-1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            jobs[job_id] = {"status": "error", "message": "Format non pris en charge"}
            return

        size_mb = len(contents) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            jobs[job_id] = {"status": "error", "message": "Fichier trop volumineux"}
            return

        if mode not in {"regex", "ai"}:
            jobs[job_id] = {"status": "error", "message": "Mode inconnu"}
            return

        jobs[job_id]["progress"] = 10
        if extension == "docx":
            anonymized_data, regex_entities, positions, text = regex_anonymizer.anonymize_docx(contents)
            jobs[job_id]["progress"] = 60
            if mode == "ai":
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            jobs[job_id]["progress"] = 90
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_filename = f"{uuid4().hex}_{filename}"
            output_path = output_dir / output_filename
            with open(output_path, "wb") as f:
                f.write(anonymized_data)
            original_filename = f"{uuid4().hex}_original_{filename}"
            original_path = output_dir / original_filename
            with open(original_path, "wb") as f:
                f.write(contents)
            result = {
                "filename": filename,
                "entities": [e.__dict__ for e in entities],
                "positions": positions,
                "download_url": f"/static/uploads/{output_filename}",
                "original_url": f"/static/uploads/{original_filename}",
            }
        else:
            anonymized_text, regex_entities, text = regex_anonymizer.anonymize_pdf(contents)
            jobs[job_id]["progress"] = 60
            if mode == "ai":
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            jobs[job_id]["progress"] = 90
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_filename = f"{uuid4().hex}_{Path(filename).stem}.txt"
            output_path = output_dir / output_filename
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(anonymized_text)
            original_filename = f"{uuid4().hex}_{filename}"
            original_path = output_dir / original_filename
            with open(original_path, "wb") as f:
                f.write(contents)
            result = {
                "filename": filename,
                "text": anonymized_text,
                "entities": [e.__dict__ for e in entities],
                "download_url": f"/static/uploads/{output_filename}",
                "original_url": f"/static/uploads/{original_filename}",
            }
        jobs[job_id].update({"status": "completed", "progress": 100, "result": result})
    except Exception as exc:
        jobs[job_id] = {"status": "error", "message": str(exc)}


@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    mode: str = Form(...),
    confidence: float = Form(0.5),
    file: UploadFile = File(...),
):
    """Handle file upload asynchronously and return a job identifier."""
    contents = await file.read()
    job_id = uuid4().hex
    jobs[job_id] = {"status": "processing", "progress": 0}
    background_tasks.add_task(_process_file, job_id, mode, confidence, contents, file.filename)
    return {"job_id": job_id}

@app.get("/progress", response_class=HTMLResponse)
def progress_page(request: Request):
    """Placeholder progression page."""
    return templates.TemplateResponse("progress.html", {"request": request})

@app.get("/interface", response_class=HTMLResponse)
def interface_page(request: Request):
    """Placeholder unified interface page."""
    return templates.TemplateResponse("interface.html", {"request": request})


@app.get("/status/{job_id}")
def get_status(job_id: str):
    """Return processing status for a given job id."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job inconnu")
    return job


# ---------------------------------------------------------------------------
# REST endpoints for entities and groups


@app.get("/entities/{job_id}")
def list_entities(job_id: str) -> list[EntityModel]:
    """Return all stored entities for a job."""
    return list(entities_db.get(job_id, {}).values())


@app.post("/entities/{job_id}")
def create_entity(job_id: str, entity: EntityModel) -> EntityModel:
    """Create a new entity for a job."""
    if not entity.id:
        entity.id = uuid4().hex
    job_entities = entities_db.setdefault(job_id, {})
    job_entities[entity.id] = entity
    return entity


@app.put("/entities/{job_id}/{entity_id}")
def update_entity(job_id: str, entity_id: str, entity: EntityModel) -> EntityModel:
    """Update an existing entity for a job."""
    job_entities = entities_db.setdefault(job_id, {})
    if entity_id not in job_entities:
        raise HTTPException(status_code=404, detail="Entity not found")
    entity.id = entity_id
    job_entities[entity_id] = entity
    return entity


@app.delete("/entities/{job_id}/{entity_id}")
def delete_entity(job_id: str, entity_id: str):
    """Remove an entity for a job and detach it from groups."""
    job_entities = entities_db.get(job_id, {})
    if entity_id in job_entities:
        del job_entities[entity_id]
    job_groups = groups_db.get(job_id, {})
    for group in job_groups.values():
        if entity_id in group.entities:
            group.entities.remove(entity_id)
    return {"status": "deleted"}


@app.get("/groups/{job_id}")
def list_groups(job_id: str) -> list[GroupModel]:
    """Return all groups for a job."""
    return list(groups_db.get(job_id, {}).values())


@app.post("/groups/{job_id}")
def create_group(job_id: str, group: GroupModel) -> GroupModel:
    """Create a new group for a job."""
    if not group.id:
        group.id = uuid4().hex
    job_groups = groups_db.setdefault(job_id, {})
    job_groups[group.id] = group
    return group


@app.put("/groups/{job_id}/{group_id}")
def update_group(job_id: str, group_id: str, group: GroupModel) -> GroupModel:
    """Update group information for a job."""
    job_groups = groups_db.setdefault(job_id, {})
    if group_id not in job_groups:
        raise HTTPException(status_code=404, detail="Group not found")
    group.id = group_id
    job_groups[group_id] = group
    job_entities = entities_db.setdefault(job_id, {})
    for ent_id in group.entities:
        if ent_id in job_entities:
            job_entities[ent_id].group_id = group_id
    return group


@app.delete("/groups/{job_id}/{group_id}")
def delete_group(job_id: str, group_id: str):
    """Delete a group for a job and clear group assignments."""
    job_groups = groups_db.get(job_id, {})
    if group_id in job_groups:
        del job_groups[group_id]
    job_entities = entities_db.get(job_id, {})
    for ent in job_entities.values():
        if ent.group_id == group_id:
            ent.group_id = None
    return {"status": "deleted"}


@app.post("/groups/{job_id}/{group_id}/entities/{entity_id}")
def add_entity_to_group(job_id: str, group_id: str, entity_id: str) -> GroupModel:
    """Assign an entity to a group for a job."""
    job_groups = groups_db.get(job_id, {})
    job_entities = entities_db.get(job_id, {})
    group = job_groups.get(group_id)
    entity = job_entities.get(entity_id)
    if not group or not entity:
        raise HTTPException(status_code=404, detail="Not found")
    if entity_id not in group.entities:
        group.entities.append(entity_id)
    entity.group_id = group_id
    return group


@app.get("/semantic-search/{job_id}")
def semantic_search(job_id: str, q: str):
    """Return words similar to the query using a simple fuzzy match."""
    job = jobs.get(job_id)
    if not job or "result" not in job or "text" not in job["result"]:
        raise HTTPException(status_code=404, detail="Job inconnu")
    text = job["result"]["text"]
    words = set(text.split())
    matches = get_close_matches(q, list(words), n=10, cutoff=0.8)
    return {"matches": matches}


@app.post("/export/{job_id}")
async def export_job(job_id: str, opts: ExportOptions):
    """Apply export options such as watermark and audit report."""
    job = jobs.get(job_id)
    if not job or "result" not in job:
        raise HTTPException(status_code=404, detail="Job inconnu")
    result = job["result"]
    src_path = Path("backend") / result["download_url"].lstrip("/")
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="Document non trouvé")
    data = src_path.read_bytes()
    entities = [Entity(**e) for e in result.get("entities", [])]
    modified, report = regex_anonymizer.export_docx(
        data, entities=entities, watermark=opts.watermark, audit=opts.audit
    )
    output_dir = Path("backend/static/exports")
    output_dir.mkdir(parents=True, exist_ok=True)
    out_filename = f"{uuid4().hex}_{Path(result['filename']).stem}.docx"
    out_path = output_dir / out_filename
    out_path.write_bytes(modified)
    response = {"download_url": f"/static/exports/{out_filename}"}
    if report:
        audit_filename = f"{uuid4().hex}_audit.txt"
        audit_path = output_dir / audit_filename
        audit_path.write_text(report, encoding="utf-8")
        response["audit_url"] = f"/static/exports/{audit_filename}"
    return JSONResponse(response)
