import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.analyzer import HybridAnalyzer


@pytest.fixture
def analyzer():
    return HybridAnalyzer()


def test_valid_siret(analyzer):
    assert analyzer._validate_siret_checksum("73282932000074")


def test_invalid_siret(analyzer):
    assert not analyzer._validate_siret_checksum("73282932000075")


def test_valid_siren(analyzer):
    assert analyzer._validate_siren_checksum("732829320")


def test_invalid_siren(analyzer):
    assert not analyzer._validate_siren_checksum("732829321")
