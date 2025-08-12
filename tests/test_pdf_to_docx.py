from io import BytesIO
import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

import fitz  # PyMuPDF
from docx import Document

from backend.anonymizer import RegexAnonymizer


def create_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Contact: test@example.com")
    return doc.write()


def test_pdf_converted_to_anonymized_docx():
    data = create_pdf()
    anonymizer = RegexAnonymizer()
    docx_bytes, entities, mapping, text, _ = anonymizer.anonymize_pdf(data)
    docx = Document(BytesIO(docx_bytes))
    full_text = "\n".join(p.text for p in docx.paragraphs)
    assert "[EMAIL]" in full_text
    assert any(e.type == "EMAIL" for e in entities)
    assert mapping
    assert "Contact: test@example.com" in text
