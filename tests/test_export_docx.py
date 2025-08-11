from io import BytesIO
import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from docx import Document

from backend.anonymizer import RegexAnonymizer, Entity

from tests.test_docx_integrity import create_sample_doc


def test_export_docx_replaces_entities():
    data = create_sample_doc()
    anonymizer = RegexAnonymizer()
    _, entities, mapping, _ = anonymizer.anonymize_docx(data)

    email = next(e for e in entities if e.type == "EMAIL")
    loc = next(e for e in entities if e.type == "LOC")

    modified_entities = [
        Entity(type=email.type, value="REMPLACED", start=email.start, end=email.end),
        loc,
    ]

    modified_bytes, _ = anonymizer.export_docx(
        data, mapping=mapping, entities=modified_entities
    )
    doc = Document(BytesIO(modified_bytes))
    text = "\n".join(p.text for p in doc.paragraphs)

    assert "REMPLACED" in text
    assert "[LOC]" in text
    assert "test@example.com" not in text
    assert "Contact" not in text
