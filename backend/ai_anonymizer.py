from typing import List
from transformers import pipeline
from .anonymizer import Entity


class AIAnonymizer:
    """Transformer-based NER anonymizer."""

    def __init__(self) -> None:
        self._pipe = None

    def _ensure_pipeline(self) -> None:
        if self._pipe is None:
            self._pipe = pipeline("ner", grouped_entities=True)

    def detect(self, text: str, confidence: float = 0.5) -> List[Entity]:
        """Detect entities in ``text`` above ``confidence`` threshold."""
        self._ensure_pipeline()
        entities: List[Entity] = []
        for ent in self._pipe(text):
            if ent["score"] >= confidence:
                start = int(ent["start"])
                end = int(ent["end"])
                entities.append(
                    Entity(
                        type=ent["entity_group"],
                        value=text[start:end],
                        start=start,
                        end=end,
                    )
                )
        return entities
