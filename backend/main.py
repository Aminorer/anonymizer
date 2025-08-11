from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
import os

app = FastAPI(title="Anonymiseur de documents juridiques")

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
async def upload_file(file: UploadFile = File(...)):
    """Handle file upload and perform basic validation."""
    extension = file.filename.split(".")[-1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non pris en charge")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux")

    # TODO: Sauvegarde et traitement du document
    return {"filename": file.filename, "message": "Upload réussi"}

@app.get("/progress", response_class=HTMLResponse)
def progress_page(request: Request):
    """Placeholder progression page."""
    return templates.TemplateResponse("progress.html", {"request": request})

@app.get("/interface", response_class=HTMLResponse)
def interface_page(request: Request):
    """Placeholder unified interface page."""
    return templates.TemplateResponse("interface.html", {"request": request})
