import json
import os
from pathlib import Path
from typing import List, Optional

from transformers import pipeline

from .anonymizer import Entity


class AIAnonymizer:
    """Transformer-based NER anonymizer."""

    def __init__(self) -> None:
        rules_path = Path(__file__).with_name("rules.json")
        ner_cfg = {}
        if rules_path.exists():
            try:
                ner_cfg = json.loads(rules_path.read_text(encoding="utf-8")).get("ner", {})
            except Exception:
                ner_cfg = {}

        model_name = os.getenv("NER_MODEL", ner_cfg.get("model", "default"))

        confidence_env = os.getenv("NER_CONFIDENCE")
        if confidence_env is not None:
            try:
                self.confidence = float(confidence_env)
            except ValueError:
                self.confidence = float(ner_cfg.get("confidence", 0.5))
        else:
            self.confidence = float(ner_cfg.get("confidence", 0.5))

        cache_dir = Path(
            os.getenv("NER_CACHE_DIR", Path(__file__).parent / ".cache")
        )
        cache_dir.mkdir(parents=True, exist_ok=True)

        device_env = os.getenv("NER_DEVICE")
        device = -1
        if device_env:
            if device_env.lower() in {"gpu", "cuda"}:
                device = 0
        else:
            try:
                import torch

                device = 0 if torch.cuda.is_available() else -1
            except Exception:
                device = -1

        pipe_kwargs = {
            "grouped_entities": True,
            "device": device,
            "cache_dir": str(cache_dir),
        }
        if model_name != "default":
            pipe_kwargs["model"] = model_name

        try:
            self._pipe = pipeline("ner", **pipe_kwargs)
        except Exception:
            self._pipe = None

    def detect(self, text: str, confidence: Optional[float] = None) -> List[Entity]:
        """Detect entities in ``text`` above the confidence threshold."""
        if confidence is None:
            confidence = self.confidence
        if self._pipe is None:
            return []
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
