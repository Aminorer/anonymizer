from __future__ import annotations

"""Simple file-based persistence layer for jobs, entities and groups.

Data is stored as JSON files under ``backend/data``.  The storage API offers
basic ``get``/``set``/``delete`` helpers with automatic persistence to disk.
This replaces the previous in-memory dictionaries used by the application.
"""

from pathlib import Path
import json
import logging
from typing import Any, Dict
import threading
import time

logger = logging.getLogger(__name__)

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
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {}
        self._load_data()

    def _load_data(self) -> None:
        """Load data from disk with error handling."""
        try:
            if self.path.exists():
                content = self.path.read_text(encoding="utf-8")
                if content.strip():
                    self._data = json.loads(content)
                else:
                    self._data = {}
                logger.debug(f"Loaded data from {self.path}")
            else:
                self._data = {}
                logger.debug(f"No existing file at {self.path}, starting with empty data")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {self.path}: {e}")
            # Backup corrupted file and start fresh
            if self.path.exists():
                backup_path = self.path.with_suffix(f".backup_{int(time.time())}")
                self.path.rename(backup_path)
                logger.info(f"Corrupted file backed up to {backup_path}")
            self._data = {}
        except Exception as e:
            logger.error(f"Error loading data from {self.path}: {e}")
            self._data = {}

    def _persist(self) -> None:
        """Persist data to disk with error handling."""
        try:
            with self._lock:
                # Write to temporary file first, then atomic rename
                temp_path = self.path.with_suffix('.tmp')
                temp_path.write_text(
                    json.dumps(self._data, ensure_ascii=False, indent=2), 
                    encoding="utf-8"
                )
                temp_path.replace(self.path)
                logger.debug(f"Persisted data to {self.path}")
        except Exception as e:
            logger.error(f"Error persisting data to {self.path}: {e}")
            # Don't raise the exception to avoid breaking the application
            # The data is still in memory and can be retried

    def get(self, key: str, default: Any | None = None) -> Any:
        """Get value for key with default."""
        try:
            with self._lock:
                return self._data.get(key, default)
        except Exception as e:
            logger.error(f"Error getting key {key}: {e}")
            return default

    def set(self, key: str, value: Any) -> None:
        """Set value for key and persist."""
        try:
            with self._lock:
                self._data[key] = value
            self._persist()
        except Exception as e:
            logger.error(f"Error setting key {key}: {e}")

    def update(self, key: str, updates: Dict[str, Any]) -> None:
        """Update existing value with new data."""
        try:
            with self._lock:
                current = self._data.get(key, {})
                if isinstance(current, dict):
                    current.update(updates)
                    self._data[key] = current
                else:
                    # If current value is not a dict, replace it
                    self._data[key] = updates
            self._persist()
        except Exception as e:
            logger.error(f"Error updating key {key}: {e}")

    def delete(self, key: str) -> None:
        """Delete key if it exists."""
        try:
            with self._lock:
                if key in self._data:
                    del self._data[key]
            self._persist()
        except Exception as e:
            logger.error(f"Error deleting key {key}: {e}")

    def all(self) -> Dict[str, Any]:
        """Return all data."""
        try:
            with self._lock:
                return self._data.copy()
        except Exception as e:
            logger.error(f"Error getting all data: {e}")
            return {}

    def exists(self, key: str) -> bool:
        """Check if key exists."""
        try:
            with self._lock:
                return key in self._data
        except Exception as e:
            logger.error(f"Error checking existence of key {key}: {e}")
            return False

    def clear(self) -> None:
        """Clear all data."""
        try:
            with self._lock:
                self._data.clear()
            self._persist()
        except Exception as e:
            logger.error(f"Error clearing data: {e}")

    def size(self) -> int:
        """Return number of items."""
        try:
            with self._lock:
                return len(self._data)
        except Exception as e:
            logger.error(f"Error getting size: {e}")
            return 0


class NestedJSONStore(JSONStore):
    """A two-level JSON store ``job_id -> entity_id -> data``."""

    def list(self, job_id: str) -> list[Any]:
        """Get all items for a job as a list."""
        try:
            job_data = self.get(job_id, {})
            if isinstance(job_data, dict):
                return list(job_data.values())
            else:
                logger.warning(f"Expected dict for job {job_id}, got {type(job_data)}")
                return []
        except Exception as e:
            logger.error(f"Error listing items for job {job_id}: {e}")
            return []

    def set_nested(self, job_id: str, item_id: str, value: Any) -> None:
        """Set nested value for job_id -> item_id."""
        try:
            with self._lock:
                job_items = self._data.setdefault(job_id, {})
                if not isinstance(job_items, dict):
                    job_items = {}
                    self._data[job_id] = job_items
                job_items[item_id] = value
            self._persist()
        except Exception as e:
            logger.error(f"Error setting nested value for job {job_id}, item {item_id}: {e}")

    def get_nested(self, job_id: str, item_id: str, default: Any = None) -> Any:
        """Get nested value for job_id -> item_id."""
        try:
            job_data = self.get(job_id, {})
            if isinstance(job_data, dict):
                return job_data.get(item_id, default)
            else:
                return default
        except Exception as e:
            logger.error(f"Error getting nested value for job {job_id}, item {item_id}: {e}")
            return default

    def delete_nested(self, job_id: str, item_id: str) -> None:
        """Delete nested item for job_id -> item_id."""
        try:
            with self._lock:
                job_items = self._data.get(job_id, {})
                if isinstance(job_items, dict) and item_id in job_items:
                    del job_items[item_id]
            self._persist()
        except Exception as e:
            logger.error(f"Error deleting nested item for job {job_id}, item {item_id}: {e}")

    def exists_nested(self, job_id: str, item_id: str) -> bool:
        """Check if nested item exists."""
        try:
            job_data = self.get(job_id, {})
            if isinstance(job_data, dict):
                return item_id in job_data
            return False
        except Exception as e:
            logger.error(f"Error checking nested existence for job {job_id}, item {item_id}: {e}")
            return False

    def count_nested(self, job_id: str) -> int:
        """Count items for a job."""
        try:
            job_data = self.get(job_id, {})
            if isinstance(job_data, dict):
                return len(job_data)
            return 0
        except Exception as e:
            logger.error(f"Error counting nested items for job {job_id}: {e}")
            return 0

    def clear_job(self, job_id: str) -> None:
        """Clear all items for a specific job."""
        try:
            with self._lock:
                if job_id in self._data:
                    self._data[job_id] = {}
            self._persist()
        except Exception as e:
            logger.error(f"Error clearing job {job_id}: {e}")


# Instantiate stores used by the application
try:
    jobs_store = JSONStore("jobs.json")
    entities_store = NestedJSONStore("entities.json")  
    groups_store = NestedJSONStore("groups.json")
    logger.info("Storage initialized successfully")
except Exception as e:
    logger.error(f"Error initializing storage: {e}")
    # Create empty stores as fallback
    jobs_store = JSONStore("jobs.json")
    entities_store = NestedJSONStore("entities.json")
    groups_store = NestedJSONStore("groups.json")