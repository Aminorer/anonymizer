from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from uuid import uuid4
from pathlib import Path
from .anonymizer import RegexAnonymizer, Entity
from .ai_anonymizer import AIAnonymizer
import os

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


entities_db: dict[str, EntityModel] = {}
groups_db: dict[str, GroupModel] = {}


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


@app.get("/entities")
def list_entities() -> list[EntityModel]:
    """Return all stored entities."""
    return list(entities_db.values())


@app.post("/entities")
def create_entity(entity: EntityModel) -> EntityModel:
    """Create a new entity."""
    if not entity.id:
        entity.id = uuid4().hex
    entities_db[entity.id] = entity
    return entity


@app.put("/entities/{entity_id}")
def update_entity(entity_id: str, entity: EntityModel) -> EntityModel:
    """Update an existing entity."""
    if entity_id not in entities_db:
        raise HTTPException(status_code=404, detail="Entity not found")
    entity.id = entity_id
    entities_db[entity_id] = entity
    return entity


@app.delete("/entities/{entity_id}")
def delete_entity(entity_id: str):
    """Remove an entity and detach it from groups."""
    if entity_id in entities_db:
        del entities_db[entity_id]
    for group in groups_db.values():
        if entity_id in group.entities:
            group.entities.remove(entity_id)
    return {"status": "deleted"}


@app.get("/groups")
def list_groups() -> list[GroupModel]:
    """Return all groups."""
    return list(groups_db.values())


@app.post("/groups")
def create_group(group: GroupModel) -> GroupModel:
    """Create a new group."""
    if not group.id:
        group.id = uuid4().hex
    groups_db[group.id] = group
    return group


@app.put("/groups/{group_id}")
def update_group(group_id: str, group: GroupModel) -> GroupModel:
    """Update group information."""
    if group_id not in groups_db:
        raise HTTPException(status_code=404, detail="Group not found")
    group.id = group_id
    groups_db[group_id] = group
    for ent_id in group.entities:
        if ent_id in entities_db:
            entities_db[ent_id].group_id = group_id
    return group


@app.delete("/groups/{group_id}")
def delete_group(group_id: str):
    """Delete a group and clear group assignments."""
    if group_id in groups_db:
        del groups_db[group_id]
    for ent in entities_db.values():
        if ent.group_id == group_id:
            ent.group_id = None
    return {"status": "deleted"}


@app.post("/groups/{group_id}/entities/{entity_id}")
def add_entity_to_group(group_id: str, entity_id: str) -> GroupModel:
    """Assign an entity to a group."""
    group = groups_db.get(group_id)
    entity = entities_db.get(entity_id)
    if not group or not entity:
        raise HTTPException(status_code=404, detail="Not found")
    if entity_id not in group.entities:
        group.entities.append(entity_id)
    entity.group_id = group_id
    return group
