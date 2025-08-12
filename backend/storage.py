from __future__ import annotations

"""Simple file-based persistence layer for jobs, entities and groups.

Data is stored as JSON files under ``backend/data``.  The storage API offers
basic ``get``/``set``/``delete`` helpers with automatic persistence to disk.
This replaces the previous in-memory dictionaries used by the application.
"""

from pathlib import Path
import json
from typing import Any, Dict

DATA_DIR = Path("backend/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)


class JSONStore:
    """Key-value JSON store persisted to ``DATA_DIR``.

    Parameters
    ----------
    filename:
        Name of the JSON file used for persistence.
    """

    def __init__(self, filename: str) -> None:
        self.path = DATA_DIR / filename
        if self.path.exists():
            self._data: Dict[str, Any] = json.loads(
                self.path.read_text(encoding="utf-8") or "{}"
            )
        else:
            self._data = {}

    # ------------------------------------------------------------------
    # internal helpers
    def _persist(self) -> None:
        self.path.write_text(
            json.dumps(self._data, ensure_ascii=False), encoding="utf-8"
        )

    # ------------------------------------------------------------------
    # public API
    def get(self, key: str, default: Any | None = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._persist()

    def update(self, key: str, updates: Dict[str, Any]) -> None:
        current = self._data.get(key, {})
        current.update(updates)
        self._data[key] = current
        self._persist()

    def delete(self, key: str) -> None:
        if key in self._data:
            del self._data[key]
            self._persist()

    def all(self) -> Dict[str, Any]:
        return self._data


class NestedJSONStore(JSONStore):
    """A two-level JSON store ``job_id -> entity_id -> data``."""

    def list(self, job_id: str) -> list[Any]:
        return list(self.get(job_id, {}).values())

    def set_nested(self, job_id: str, item_id: str, value: Any) -> None:
        job_items = self._data.setdefault(job_id, {})
        job_items[item_id] = value
        self._persist()

    def get_nested(self, job_id: str, item_id: str) -> Any:
        return self.get(job_id, {}).get(item_id)

    def delete_nested(self, job_id: str, item_id: str) -> None:
        job_items = self._data.get(job_id, {})
        if item_id in job_items:
            del job_items[item_id]
            self._persist()


# Instantiate stores used by the application
jobs_store = JSONStore("jobs.json")
entities_store = NestedJSONStore("entities.json")
groups_store = NestedJSONStore("groups.json")
