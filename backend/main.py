from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
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
