from dataclasses import dataclass
import re
from typing import List, Tuple, Optional
from io import BytesIO

import pdfplumber
from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT


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

    def anonymize_docx(self, data: bytes) -> Tuple[bytes, List[Entity], List[Tuple[int, int, int, int]], str]:
        """Anonymize a DOCX document while preserving structure and metadata.

        Returns the anonymized document bytes, detected entities, the mapping
        between plain text and DOCX runs and the plain text itself.
        """

        doc = Document(BytesIO(data))
        core_props = {
            "author": doc.core_properties.author,
            "title": doc.core_properties.title,
            "subject": doc.core_properties.subject,
        }
        text, mapping = self.docx_text_mapping(doc)
        entities = self.detect(text)

        def replace_in_paragraphs(paragraphs):
            for para in paragraphs:
                for run in para.runs:
                    for etype, pattern in self.PATTERNS.items():
                        if pattern.search(run.text):
                            run.text = pattern.sub(f"[{etype}]", run.text)

        # Replace in body paragraphs
        replace_in_paragraphs(doc.paragraphs)
        # Replace in tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    replace_in_paragraphs(cell.paragraphs)
        # Replace in headers and footers
        for section in doc.sections:
            replace_in_paragraphs(section.header.paragraphs)
            replace_in_paragraphs(section.footer.paragraphs)

        # Restore metadata explicitly
        doc.core_properties.author = core_props["author"]
        doc.core_properties.title = core_props["title"]
        doc.core_properties.subject = core_props["subject"]

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.read(), entities, mapping, text

    def export_docx(
        self,
        data: bytes,
        mapping: Optional[List[Tuple[int, int, int, int]]] = None,
        entities: Optional[List[Entity]] = None,
        watermark: Optional[str] = None,
        audit: bool = False,
    ) -> Tuple[bytes, Optional[str]]:
        """Apply modifications and export options to a DOCX document.

        ``mapping`` should contain tuples ``(start, end, p_idx, r_idx)`` mapping
        character positions in the extracted text to paragraph/run indices. The
        ``entities`` list contains the potentially modified entities whose
        ranges will be replaced in the document. If the entity ``value`` is
        unchanged compared to the original text, it will be replaced by a
        placeholder ``[TYPE]``.

        The function returns the modified document bytes and optionally an
        audit report if ``audit`` is True.
        """

        doc = Document(BytesIO(data))

        if entities and mapping:
            def _original_text(ent: Entity) -> str:
                parts: List[str] = []
                for m_start, m_end, p_idx, r_idx in mapping:
                    if m_end <= ent.start or m_start >= ent.end:
                        continue
                    run = doc.paragraphs[p_idx].runs[r_idx]
                    rs = max(ent.start, m_start) - m_start
                    re = min(ent.end, m_end) - m_start
                    parts.append(run.text[rs:re])
                return "".join(parts)

            for ent in entities:
                original = _original_text(ent)
                replacement = ent.value
                if replacement == original:
                    replacement = f"[{ent.type}]"

                first = True
                for m_start, m_end, p_idx, r_idx in mapping:
                    if m_end <= ent.start or m_start >= ent.end:
                        continue
                    run = doc.paragraphs[p_idx].runs[r_idx]
                    rs = max(ent.start, m_start) - m_start
                    re = min(ent.end, m_end) - m_start
                    if first:
                        run.text = run.text[:rs] + replacement + run.text[re:]
                        first = False
                    else:
                        run.text = run.text[:rs] + run.text[re:]

        if watermark:
            for section in doc.sections:
                header = section.header
                para = header.add_paragraph()
                run = para.add_run(watermark)
                run.font.color.rgb = None
                run.font.bold = True

        report: Optional[str] = None
        if audit and entities:
            report_lines = [f"{e.type}: {e.value}" for e in entities]
            report = "\n".join(report_lines)

        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output.read(), report

    # ------------------------------------------------------------------
    # PDF utilities
    def anonymize_pdf(self, data: bytes) -> Tuple[str, List[Entity], str]:
        """Extract text from a PDF, anonymize it and return positions.

        Returns the anonymized text, detected entities and the original text.
        """

        with pdfplumber.open(BytesIO(data)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages)
        entities = self.detect(text)
        anonymized_text = text
        for etype, pattern in self.PATTERNS.items():
            anonymized_text = pattern.sub(f"[{etype}]", anonymized_text)
        return anonymized_text, entities, text
