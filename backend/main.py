from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from uuid import uuid4
from pathlib import Path
from difflib import get_close_matches
from .anonymizer import RegexAnonymizer, Entity, RunInfo
from .ai_anonymizer import AIAnonymizer
from .storage import jobs_store, entities_store, groups_store
import os
import json
import time
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Anonymiseur de documents juridiques")
regex_anonymizer = RegexAnonymizer()
ai_anonymizer = AIAnonymizer()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
templates = Jinja2Templates(directory="backend/templates")

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_FILE_SIZE_MB = 25

class EntityModel(BaseModel):
    id: str
    type: str
    value: str
    start: int = 0
    end: int = 0
    page: int | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    group_id: str | None = None


class GroupModel(BaseModel):
    id: str
    name: str
    entities: list[str] = []


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
    logger.info(f"Démarrage du traitement pour job {job_id}")
    
    def _calc_eta(start: float, progress: int) -> float | None:
        """Simple estimation of remaining seconds based on progress."""
        if progress <= 0:
            return None
        elapsed = time.time() - start
        return elapsed * (100 - progress) / progress

    start_time = time.time()
    jobs_store.update(job_id, {"mode": mode, "entities_detected": 0, "eta": None})
    
    try:
        # Vérifications initiales
        extension = filename.split(".")[-1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            jobs_store.set(job_id, {"status": "error", "message": "Format non pris en charge", "mode": mode, "entities_detected": 0, "eta": 0})
            return

        size_mb = len(contents) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            jobs_store.set(job_id, {"status": "error", "message": "Fichier trop volumineux", "mode": mode, "entities_detected": 0, "eta": 0})
            return

        if mode not in {"regex", "ai"}:
            jobs_store.set(job_id, {"status": "error", "message": "Mode inconnu", "mode": mode, "entities_detected": 0, "eta": 0})
            return

        logger.info(f"Job {job_id}: Début du traitement ({extension}, {size_mb:.1f}MB)")
        
        jobs_store.update(job_id, {"progress": 10, "eta": _calc_eta(start_time, 10)})
        
        if extension == "docx":
            logger.info(f"Job {job_id}: Traitement DOCX")
            _anonymized, regex_entities, mapping, text = regex_anonymizer.anonymize_docx(contents)
            jobs_store.update(job_id, {"progress": 60, "eta": _calc_eta(start_time, 60)})
            
            if mode == "ai":
                logger.info(f"Job {job_id}: Mode IA activé")
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            
            logger.info(f"Job {job_id}: {len(entities)} entités détectées")
            jobs_store.update(job_id, {"progress": 90, "eta": _calc_eta(start_time, 90)})
            
            # Création des dossiers de sortie
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            original_filename = f"{uuid4().hex}_original_{filename}"
            anonymized_filename = f"{uuid4().hex}_anonymized_{filename}"
            original_path = output_dir / original_filename
            anonymized_path = output_dir / anonymized_filename
            
            # Sauvegarde des fichiers
            with open(original_path, "wb") as f:
                f.write(contents)
            with open(anonymized_path, "wb") as f:
                f.write(_anonymized)
            
            result = {
                "filename": filename,
                "entities": [
                    {k: v for k, v in e.__dict__.items() if v is not None}
                    for e in entities
                ],
                "mapping": [m.to_dict() for m in mapping],  # Convert RunInfo to dict
                "original_url": f"/static/uploads/{original_filename}",
                "anonymized_url": f"/static/uploads/{anonymized_filename}",
            }
        else:
            logger.info(f"Job {job_id}: Traitement PDF")
            _anonymized_docx, regex_entities, mapping, text, original_docx = (
                regex_anonymizer.anonymize_pdf(contents)
            )
            jobs_store.update(job_id, {"progress": 60, "eta": _calc_eta(start_time, 60)})
            
            if mode == "ai":
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            
            logger.info(f"Job {job_id}: {len(entities)} entités détectées")
            jobs_store.update(job_id, {"progress": 90, "eta": _calc_eta(start_time, 90)})
            
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            original_filename = f"{uuid4().hex}_original_{Path(filename).stem}.docx"
            anonymized_filename = f"{uuid4().hex}_anonymized_{Path(filename).stem}.docx"
            original_path = output_dir / original_filename
            anonymized_path = output_dir / anonymized_filename
            
            with open(original_path, "wb") as f:
                f.write(original_docx)
            with open(anonymized_path, "wb") as f:
                f.write(_anonymized_docx)
                
            result = {
                "filename": f"{Path(filename).stem}.docx",
                "entities": [
                    {k: v for k, v in e.__dict__.items() if v is not None}
                    for e in entities
                ],
                "mapping": [m.to_dict() for m in mapping],  # Convert RunInfo to dict
                "original_url": f"/static/uploads/{original_filename}",
                "anonymized_url": f"/static/uploads/{anonymized_filename}",
                "text": text,
            }
        
        jobs_store.update(job_id, {"entities_detected": len(entities)})
        jobs_store.update(job_id, {"status": "completed", "progress": 100, "result": result, "eta": 0})
        logger.info(f"Job {job_id}: Traitement terminé avec succès")
        
    except Exception as exc:
        logger.error(f"Job {job_id}: Erreur - {str(exc)}")
        jobs_store.set(job_id, {"status": "error", "message": str(exc), "mode": mode, "entities_detected": 0, "eta": 0})


@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    mode: str = Form(...),
    confidence: float = Form(ai_anonymizer.confidence),
    file: UploadFile = File(...),
):
    """Handle file upload asynchronously and return a job identifier."""
    contents = await file.read()
    job_id = uuid4().hex
    
    # Vérifications préliminaires
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    logger.info(f"Nouveau job {job_id} pour fichier {file.filename}")
    
    jobs_store.set(
        job_id,
        {
            "status": "processing",
            "progress": 0,
            "mode": mode,
            "entities_detected": 0,
            "eta": None,
        },
    )
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
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job inconnu")
    
    # Protection contre les jobs zombies
    if job.get("status") == "processing" and job.get("progress", 0) == 0:
        # Si le job est en processing depuis plus de 5 minutes sans progression, on le marque en erreur
        import time
        current_time = time.time()
        # Cette logique peut être améliorée avec un timestamp de création
        pass
    
    # ensure anonymized_url is always present in the response when available
    result = job.get("result")
    if result is not None and "anonymized_url" not in result:
        result["anonymized_url"] = None
    return job


# Nouveau endpoint pour nettoyer les jobs bloqués
@app.post("/admin/clear-stuck-jobs")
def clear_stuck_jobs():
    """Clear jobs that are stuck in processing state."""
    all_jobs = jobs_store.all()
    cleared = 0
    for job_id, job in all_jobs.items():
        if job.get("status") == "processing":
            jobs_store.set(job_id, {
                **job,
                "status": "error",
                "message": "Job interrompu (nettoyage manuel)"
            })
            cleared += 1
    return {"message": f"{cleared} jobs nettoyés"}


# ---------------------------------------------------------------------------
# REST endpoints for entities and groups


@app.get("/entities/{job_id}")
def list_entities(job_id: str) -> list[EntityModel]:
    """Return all stored entities for a job."""
    return [EntityModel.parse_obj(e) for e in entities_store.list(job_id)]


@app.post("/entities/{job_id}")
def create_entity(job_id: str, entity: EntityModel) -> EntityModel:
    """Create a new entity for a job."""
    if not entity.id:
        entity.id = uuid4().hex
    entities_store.set_nested(job_id, entity.id, entity.dict())
    return entity


@app.put("/entities/{job_id}/{entity_id}")
def update_entity(job_id: str, entity_id: str, entity: EntityModel) -> EntityModel:
    """Update an existing entity for a job."""
    existing = entities_store.get_nested(job_id, entity_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    entity.id = entity_id
    entities_store.set_nested(job_id, entity_id, entity.dict())
    return entity


@app.delete("/entities/{job_id}/{entity_id}")
def delete_entity(job_id: str, entity_id: str):
    """Remove an entity for a job and detach it from groups."""
    entities_store.delete_nested(job_id, entity_id)
    job_groups = groups_store.get(job_id, {})
    for group in job_groups.values():
        if entity_id in group.get("entities", []):
            group["entities"].remove(entity_id)
    groups_store.set(job_id, job_groups)
    return {"status": "deleted"}


@app.get("/groups/{job_id}")
def list_groups(job_id: str) -> list[GroupModel]:
    """Return all groups for a job."""
    return [GroupModel.parse_obj(g) for g in groups_store.list(job_id)]


@app.post("/groups/{job_id}")
def create_group(job_id: str, group: GroupModel) -> GroupModel:
    """Create a new group for a job."""
    if not group.id:
        group.id = uuid4().hex
    groups_store.set_nested(job_id, group.id, group.dict())
    return group


@app.put("/groups/{job_id}/{group_id}")
def update_group(job_id: str, group_id: str, group: GroupModel) -> GroupModel:
    """Update group information for a job."""
    existing = groups_store.get_nested(job_id, group_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Group not found")
    group.id = group_id
    groups_store.set_nested(job_id, group_id, group.dict())
    # update entities with group assignment
    job_entities = entities_store.get(job_id, {})
    for ent_id in group.entities:
        ent = job_entities.get(ent_id)
        if ent is not None:
            ent["group_id"] = group_id
    entities_store.set(job_id, job_entities)
    return group


@app.delete("/groups/{job_id}/{group_id}")
def delete_group(job_id: str, group_id: str):
    """Delete a group for a job and clear group assignments."""
    groups_store.delete_nested(job_id, group_id)
    job_entities = entities_store.get(job_id, {})
    for ent in job_entities.values():
        if ent.get("group_id") == group_id:
            ent["group_id"] = None
    entities_store.set(job_id, job_entities)
    return {"status": "deleted"}


@app.post("/groups/{job_id}/{group_id}/entities/{entity_id}")
def add_entity_to_group(job_id: str, group_id: str, entity_id: str) -> GroupModel:
    """Assign an entity to a group for a job."""
    group = groups_store.get_nested(job_id, group_id)
    entity = entities_store.get_nested(job_id, entity_id)
    if not group or not entity:
        raise HTTPException(status_code=404, detail="Not found")
    if entity_id not in group.get("entities", []):
        group.setdefault("entities", []).append(entity_id)
    groups_store.set_nested(job_id, group_id, group)
    entity["group_id"] = group_id
    entities_store.set_nested(job_id, entity_id, entity)
    return GroupModel.parse_obj(group)


@app.get("/semantic-search/{job_id}")
def semantic_search(job_id: str, q: str):
    """Return words similar to the query using a simple fuzzy match."""
    job = jobs_store.get(job_id)
    if not job or "result" not in job or "text" not in job["result"]:
        raise HTTPException(status_code=404, detail="Job inconnu")
    text = job["result"]["text"]
    words = set(text.split())
    matches = get_close_matches(q, list(words), n=10, cutoff=0.8)
    return {"matches": matches}


@app.post("/export/{job_id}")
async def export_job(job_id: str, opts: ExportOptions):
    """Apply export options such as watermark and audit report."""
    job = jobs_store.get(job_id)
    if not job or "result" not in job:
        raise HTTPException(status_code=404, detail="Job inconnu")
    result = job["result"]
    src_path = Path("backend") / result["original_url"].lstrip("/")
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="Document non trouvé")
    data = src_path.read_bytes()
    
    # Reconstruct mapping from dict format
    mapping_data = result.get("mapping", [])
    mapping = [RunInfo.from_dict(m) for m in mapping_data] if mapping_data else []
    
    stored = [EntityModel.parse_obj(e) for e in entities_store.list(job_id)]
    if stored:
        entities = [
            Entity(
                type=e.type,
                value=e.value,
                start=e.start,
                end=e.end,
                page=e.page,
                x=e.x,
                y=e.y,
                width=e.width,
                height=e.height,
            )
            for e in stored
        ]
    else:
        entities = [Entity(**e) for e in result.get("entities", [])]
    modified, report = regex_anonymizer.export_docx(
        data,
        mapping=mapping,
        entities=entities,
        watermark=opts.watermark,
        audit=opts.audit,
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