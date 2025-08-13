#!/usr/bin/env python3
"""
Script de démarrage pour l'anonymiseur avec vérifications préalables.
Usage: python startup.py
"""

import os
import sys
import json
import logging
from pathlib import Path
import subprocess

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_python_version():
    """Vérifier la version Python."""
    if sys.version_info < (3, 8):
        logger.error("Python 3.8+ requis. Version actuelle: %s", sys.version)
        return False
    logger.info("Version Python OK: %s", sys.version)
    return True

def check_directories():
    """Créer les répertoires nécessaires."""
    directories = [
        "backend/data",
        "backend/static/uploads", 
        "backend/static/exports",
        "backend/.cache"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info("Répertoire créé/vérifié: %s", directory)
    
    return True

def check_dependencies():
    """Vérifier les dépendances."""
    try:
        import fastapi
        import uvicorn
        import docx
        import pdfplumber
        import pdf2docx
        import transformers
        logger.info("Toutes les dépendances principales sont installées")
        return True
    except ImportError as e:
        logger.error("Dépendance manquante: %s", e)
        logger.info("Installez les dépendances avec: pip install -r backend/requirements.txt")
        return False

def create_default_rules():
    """Créer le fichier de règles par défaut."""
    rules_file = Path("backend/rules.json")
    
    if not rules_file.exists():
        default_rules = {
            "regex_rules": [
                {"pattern": "\\b\\d{2}/\\d{2}/\\d{4}\\b", "replacement": "[DATE]"},
                {"pattern": "[\\w\\.-]+@[\\w\\.-]+", "replacement": "[EMAIL]"}
            ],
            "ner": {
                "model": "hf-internal-testing/tiny-bert-large-cased-finetuned-conll03-english", 
                "confidence": 0.5
            },
            "styles": {
                "PERSON": "[PERSONNE]",
                "ORG": "[ORGANISATION]",
                "LOC": "[LIEU]",
                "EMAIL": "[EMAIL]",
                "PHONE": "[TELEPHONE]",
                "DATE": "[DATE]",
                "ADDRESS": "[ADRESSE]",
                "IBAN": "[IBAN]",
                "SIREN": "[SIREN]",
                "SIRET": "[SIRET]"
            }
        }
        
        rules_file.write_text(json.dumps(default_rules, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info("Fichier de règles par défaut créé: %s", rules_file)
    
    return True

def check_environment():
    """Vérifier les variables d'environnement."""
    env_vars = {
        "NER_MODEL": "hf-internal-testing/tiny-bert-large-cased-finetuned-conll03-english",
        "NER_CONFIDENCE": "0.5",
        "NER_DEVICE": "cpu",
        "NER_CACHE_DIR": str(Path("backend/.cache").absolute())
    }
    
    for var, default in env_vars.items():
        if var not in os.environ:
            os.environ[var] = default
            logger.info("Variable d'environnement définie: %s=%s", var, default)
    
    return True

def test_imports():
    """Tester les imports critiques."""
    try:
        logger.info("Test des imports...")
        
        # Test FastAPI
        from fastapi import FastAPI
        logger.info("✓ FastAPI")
        
        # Test traitement documents
        from docx import Document
        logger.info("✓ python-docx")
        
        import pdfplumber
        logger.info("✓ pdfplumber")
        
        from pdf2docx import parse
        logger.info("✓ pdf2docx")
        
        # Test IA (optionnel)
        try:
            from transformers import pipeline
            logger.info("✓ transformers")
        except ImportError:
            logger.warning("⚠ transformers non disponible (mode IA désactivé)")
        
        # Test modules locaux
        sys.path.insert(0, str(Path("backend").absolute()))
        from anonymizer import RegexAnonymizer
        from storage import jobs_store
        logger.info("✓ Modules locaux")
        
        return True
        
    except ImportError as e:
        logger.error("Erreur d'import: %s", e)
        return False

def run_tests():
    """Exécuter les tests de base."""
    try:
        logger.info("Exécution des tests de base...")
        
        # Test de création d'un document simple
        from docx import Document
        doc = Document()
        doc.add_paragraph("Test")
        
        # Test du store
        sys.path.insert(0, str(Path("backend").absolute()))
        from storage import jobs_store
        jobs_store.set("test", {"status": "test"})
        assert jobs_store.get("test")["status"] == "test"
        jobs_store.delete("test")
        
        logger.info("✓ Tests de base réussis")
        return True
        
    except Exception as e:
        logger.error("Erreur lors des tests: %s", e)
        return False

def start_server():
    """Démarrer le serveur."""
    try:
        logger.info("Démarrage du serveur...")
        cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        logger.info("Arrêt du serveur par l'utilisateur")
    except subprocess.CalledProcessError as e:
        logger.error("Erreur lors du démarrage du serveur: %s", e)
        return False
    return True

def main():
    """Fonction principale."""
    logger.info("=== Démarrage de l'Anonymiseur Juridique ===")
    
    # Vérifications préalables
    checks = [
        ("Version Python", check_python_version),
        ("Répertoires", check_directories), 
        ("Dépendances", check_dependencies),
        ("Règles par défaut", create_default_rules),
        ("Variables d'environnement", check_environment),
        ("Imports", test_imports),
        ("Tests de base", run_tests)
    ]
    
    for name, check_func in checks:
        logger.info("Vérification: %s", name)
        if not check_func():
            logger.error("❌ Échec: %s", name)
            return False
        logger.info("✅ OK: %s", name)
    
    logger.info("=== Toutes les vérifications sont OK ===")
    logger.info("Serveur disponible sur: http://localhost:8000")
    logger.info("Interface d'upload: http://localhost:8000/")
    logger.info("Appuyez sur Ctrl+C pour arrêter")
    
    # Démarrer le serveur
    return start_server()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)