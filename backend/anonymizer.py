from dataclasses import dataclass
import re
from typing import List, Tuple
from io import BytesIO

import pdfplumber
from docx import Document


@dataclass
class Entity:
    type: str
    value: str
    start: int
    end: int


class RegexAnonymizer:
    """Regex based anonymizer for DOCX and PDF files.

    Besides anonymization it also exposes utilities to map positions
    between the plain extracted text and DOCX runs so that callers can
    later locate and modify text while preserving formatting.
    """

    PATTERNS = {
        "EMAIL": re.compile(r"[\w\.-]+@[\w\.-]+", re.IGNORECASE),
        "PHONE": re.compile(r"(?:\+\d{1,3} ?)?\d{10}"),
        "DATE": re.compile(r"\b\d{2}/\d{2}/\d{4}\b"),
        "IBAN": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
        "SIREN": re.compile(r"\b\d{9}\b"),
        "SIRET": re.compile(r"\b\d{14}\b"),
        # Basic French address: number + street + zip + city
        "ADDRESS": re.compile(r"\d+\s+[\w\s]+,?\s*\d{5}\s+[\w\s]+"),
        # Location placeholder: capitalized words
        "LOC": re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b"),
    }

    def detect(self, text: str) -> List[Entity]:
        """Detect entities in ``text`` and return their positions."""
        entities: List[Entity] = []
        for etype, pattern in self.PATTERNS.items():
            for match in pattern.finditer(text):
                entities.append(
                    Entity(
                        type=etype,
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                    )
                )
        return entities

    # ------------------------------------------------------------------
    # DOCX utilities
    def docx_text_mapping(self, doc: Document) -> Tuple[str, List[Tuple[int, int, int, int]]]:
        """Return full text of ``doc`` and mapping to paragraph/run indices.

        The mapping is a list of tuples ``(start, end, p_idx, r_idx)`` where
        ``start`` and ``end`` are character offsets in the plain text
        representation and ``p_idx``/``r_idx`` refer to the corresponding
        paragraph and run indices in the original document.
        """

        parts: List[str] = []
        mapping: List[Tuple[int, int, int, int]] = []
        pos = 0
        for p_idx, para in enumerate(doc.paragraphs):
            for r_idx, run in enumerate(para.runs):
                text = run.text
                start = pos
                end = start + len(text)
                parts.append(text)
                mapping.append((start, end, p_idx, r_idx))
                pos = end
            if p_idx < len(doc.paragraphs) - 1:
                parts.append("\n")
                pos += 1
        return "".join(parts), mapping

    def anonymize_docx(self, data: bytes) -> Tuple[bytes, List[Entity], List[Tuple[int, int, int, int]]]:
        """Anonymize a DOCX document and expose mapping information."""

        doc = Document(BytesIO(data))
        text, mapping = self.docx_text_mapping(doc)
        entities = self.detect(text)

        # Replace entities in runs to preserve formatting
        for para in doc.paragraphs:
            for run in para.runs:
                for etype, pattern in self.PATTERNS.items():
                    if pattern.search(run.text):
                        run.text = pattern.sub(f"[{etype}]", run.text)

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.read(), entities, mapping

    # ------------------------------------------------------------------
    # PDF utilities
    def anonymize_pdf(self, data: bytes) -> Tuple[str, List[Entity]]:
        """Extract text from a PDF, anonymize it and return positions."""

        with pdfplumber.open(BytesIO(data)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages)
        entities = self.detect(text)
        anonymized_text = text
        for etype, pattern in self.PATTERNS.items():
            anonymized_text = pattern.sub(f"[{etype}]", anonymized_text)
        return anonymized_text, entities
