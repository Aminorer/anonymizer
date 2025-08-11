import re
import uuid
from typing import List, Dict, Any
from io import BytesIO

import spacy
from docx import Document

NLP = None


def get_nlp():
    """Lazy load spaCy model to avoid import-time cost."""
    global NLP
    if NLP is None:
        try:
            NLP = spacy.load("fr_core_news_sm")
        except OSError as exc:  # Model not found
            raise RuntimeError(
                "Le modèle spaCy 'fr_core_news_sm' est requis. Installez-le via 'python -m spacy download fr_core_news_sm'."
            ) from exc
    return NLP

# Regex patterns for simple entity detection
REGEX_PATTERNS = {
    "EMAIL": r"\b[\w\.-]+@[\w\.-]+\.\w{2,}\b",
    "PHONE": r"\b(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}\b",
    "DATE": r"\b\d{1,2}/\d{1,2}/\d{4}\b",
    "IBAN": r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b",
    "SIREN": r"\b\d{9}\b",
    "SIRET": r"\b\d{14}\b",
    # Basic French address pattern
    "ADDRESS": r"\b\d+\s+[A-Za-z\u00C0-\u017F\s]+",
}


def detect_regex(text: str) -> List[Dict[str, Any]]:
    """Detect entities in text using predefined regex patterns."""
    entities = []
    for ent_type, pattern in REGEX_PATTERNS.items():
        for match in re.finditer(pattern, text):
            entities.append(
                {
                    "id": str(uuid.uuid4()),
                    "type": ent_type,
                    "value": match.group(0),
                    "start": match.start(),
                    "end": match.end(),
                    "replacement": match.group(0),
                    "source": "regex",
                    "confidence": 1.0,
                }
            )
    return entities


def detect_ner(text: str) -> List[Dict[str, Any]]:
    """Detect entities using spaCy NER model."""
    nlp = get_nlp()
    doc = nlp(text)
    entities = []
    for ent in doc.ents:
        entities.append(
            {
                "id": str(uuid.uuid4()),
                "type": ent.label_,
                "value": ent.text,
                "start": ent.start_char,
                "end": ent.end_char,
                "replacement": ent.text,
                "source": "ner",
                "confidence": getattr(ent, "kb_id_", 1.0),
            }
        )
    return entities


def analyze_document(text: str, mode: str) -> Dict[str, Any]:
    """Analyze text and return detected entities based on mode."""
    entities = detect_regex(text)
    if mode == "ia":
        entities += detect_ner(text)
    # Sort entities by start position
    entities.sort(key=lambda x: x["start"])
    return {"text": text, "entities": entities}


def apply_replacements(doc_bytes: bytes, entities: List[Dict[str, Any]]) -> bytes:
    """Apply replacements to DOCX document while preserving formatting."""
    doc = Document(BytesIO(doc_bytes))
    mapping = {e["value"]: e["replacement"] for e in entities if e["value"] != e["replacement"]}
    if not mapping:
        return doc_bytes

    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            text = run.text
            for value, repl in mapping.items():
                if value in text:
                    run.text = run.text.replace(value, repl)
    # TODO: handle tables, headers, footers if needed
    output = BytesIO()
    doc.save(output)
    return output.getvalue()
