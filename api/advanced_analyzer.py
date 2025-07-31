"""Advanced analysis helpers that rely solely on the PyTorch backend."""

import os
import warnings
from typing import Dict

# Ensure transformers never attempts to load TensorFlow
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
warnings.filterwarnings("ignore", category=UserWarning, module="tensorflow")

# Use the same defensive import strategy as in ``analyzer`` to guarantee that
# TensorFlow is never loaded even if it is present in the environment.
try:
    from transformers import pipeline
except ImportError as e:  # pragma: no cover - defensive fallback
    if "tensorflow" in str(e).lower():
        import transformers

        transformers.utils.import_utils.is_tf_available = lambda: False
        from transformers import pipeline
    else:  # pragma: no cover
        raise
from .analyzer import hybrid_analyzer

_NER_PIPELINE = None

def analyze_advanced(text: str) -> Dict:
    entities = []
    for e in hybrid_analyzer._extract_structured_entities(text):
        entities.append({"text": e.text, "label": e.type, "start": e.start, "end": e.end, "source": "REGEX"})
    global _NER_PIPELINE
    if _NER_PIPELINE is None:
        _NER_PIPELINE = pipeline(
            "ner",
            model="cmarkea/distilcamembert-base-ner",
            tokenizer="cmarkea/distilcamembert-base-ner",
            aggregation_strategy="simple",
        )
    ner_results = _NER_PIPELINE(text)
    existing = {(d["start"], d["end"], d["text"].lower(), d["label"]) for d in entities}
    for r in ner_results:
        if r["entity_group"] not in {"PER", "ORG"}:
            continue
        key = (r["start"], r["end"], r["word"].lower(), r["entity_group"])
        if key in existing:
            continue
        entities.append({"text": r["word"], "label": r["entity_group"], "start": r["start"], "end": r["end"], "source": "NER"})
        existing.add(key)
    return {"entities": entities}
