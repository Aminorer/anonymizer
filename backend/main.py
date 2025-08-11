import uuid
from io import BytesIO

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .anonymizer import analyze_document, apply_replacements

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_FILE_SIZE_MB = 25

app = FastAPI(title="Anonymiseur de documents juridiques")
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
templates = Jinja2Templates(directory="backend/templates")

# Simple in-memory session store
SESSIONS = {}


@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    """Render the upload page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload")
async def upload_file(
    request: Request,
    mode: str = Form(...),
    file: UploadFile = File(...),
):
    extension = file.filename.split(".")[-1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non pris en charge")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux")

    # Extract text for analysis
    if extension == "docx":
        from docx import Document

        doc = Document(BytesIO(contents))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        import pdfplumber

        with pdfplumber.open(BytesIO(contents)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    analysis = analyze_document(text, mode)
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "file_bytes": contents,
        "mode": mode,
        "entities": analysis["entities"],
        "text": analysis["text"],
    }
    return RedirectResponse(url=f"/interface/{session_id}", status_code=303)


@app.get("/interface/{session_id}", response_class=HTMLResponse)
async def interface_page(request: Request, session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return templates.TemplateResponse(
        "interface.html",
        {
            "request": request,
            "session_id": session_id,
            "text": session["text"],
            "entities": session["entities"],
            "mode": session["mode"],
        },
    )


@app.post("/download/{session_id}")
async def download_anonymized(session_id: str, request: Request):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")

    data = await request.json()
    replacements = data.get("entities", [])
    session_entities = session["entities"]
    # update replacements in session
    mapping = {e["id"]: e for e in session_entities}
    for rep in replacements:
        ent = mapping.get(rep["id"])
        if ent:
            ent["replacement"] = rep.get("replacement", ent["replacement"])

    anonymized_bytes = apply_replacements(session["file_bytes"], session_entities)
    headers = {"Content-Disposition": f"attachment; filename=anonymized.docx"}
    return StreamingResponse(BytesIO(anonymized_bytes), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers=headers)
