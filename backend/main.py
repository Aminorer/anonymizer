from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from uuid import uuid4
from pathlib import Path
from .anonymizer import RegexAnonymizer
import os

app = FastAPI(title="Anonymiseur de documents juridiques")
anonymizer = RegexAnonymizer()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
templates = Jinja2Templates(directory="backend/templates")

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_FILE_SIZE_MB = 25

@app.get("/", response_class=HTMLResponse)
def read_index(request: Request):
    """Render the upload page."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload")
async def upload_file(mode: str = Form(...), file: UploadFile = File(...)):
    """Handle file upload, anonymize and return detected entities."""
    extension = file.filename.split(".")[-1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non pris en charge")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux")

    if mode != "regex":
        raise HTTPException(status_code=501, detail="Mode IA non implémenté")
    if extension == "docx":
        anonymized_data, entities, positions = anonymizer.anonymize_docx(contents)

        output_dir = Path("backend/static/uploads")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_filename = f"{uuid4().hex}_{file.filename}"
        output_path = output_dir / output_filename
        with open(output_path, "wb") as f:
            f.write(anonymized_data)

        return {
            "filename": file.filename,
            "entities": [e.__dict__ for e in entities],
            "positions": positions,
            "download_url": f"/static/uploads/{output_filename}",
        }
    else:
        anonymized_text, entities = anonymizer.anonymize_pdf(contents)
        output_dir = Path("backend/static/uploads")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_filename = f"{uuid4().hex}_{Path(file.filename).stem}.txt"
        output_path = output_dir / output_filename
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(anonymized_text)

        return {
            "filename": file.filename,
            "text": anonymized_text,
            "entities": [e.__dict__ for e in entities],
            "download_url": f"/static/uploads/{output_filename}",
        }

@app.get("/progress", response_class=HTMLResponse)
def progress_page(request: Request):
    """Placeholder progression page."""
    return templates.TemplateResponse("progress.html", {"request": request})

@app.get("/interface", response_class=HTMLResponse)
def interface_page(request: Request):
    """Placeholder unified interface page."""
    return templates.TemplateResponse("interface.html", {"request": request})
