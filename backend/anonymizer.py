from dataclasses import dataclass
import re
from typing import List, Tuple
from io import BytesIO
from docx import Document


@dataclass
class Entity:
    type: str
    value: str


class RegexAnonymizer:
    """Simple regex-based anonymizer for DOCX files."""

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
        entities: List[Entity] = []
        for etype, pattern in self.PATTERNS.items():
            for match in pattern.finditer(text):
                entities.append(Entity(type=etype, value=match.group()))
        return entities

    def anonymize_docx(self, data: bytes) -> Tuple[bytes, List[Entity]]:
        doc = Document(BytesIO(data))
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        text = "\n".join(full_text)
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
        return output.read(), entities
