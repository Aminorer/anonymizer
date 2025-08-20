#!/usr/bin/env python3
"""
Script de démarrage amélioré pour l'anonymiseur avec interface avancée.
Usage: python startup.py [--dev] [--port PORT] [--host HOST]
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
import subprocess
import signal
import time
import requests
from datetime import datetime

# Configuration du logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend/logs/startup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AnonymizerBootstrap:
    """Gestionnaire de démarrage pour l'anonymiseur."""
    
    def __init__(self):
        self.server_process = None
        self.dev_mode = False
        self.host = "0.0.0.0"
        self.port = 8000
        
    def check_python_version(self):
        """Vérifier la version Python."""
        if sys.version_info < (3, 8):
            logger.error("Python 3.8+ requis. Version actuelle: %s", sys.version)
            return False
        logger.info("✓ Version Python OK: %s", sys.version.split()[0])
        return True

    def check_and_create_directories(self):
        """Créer les répertoires nécessaires."""
        directories = [
            "backend/data",
            "backend/static/uploads", 
            "backend/static/exports",
            "backend/.cache",
            "backend/logs",
            "backend/templates",
            "backend/static/css",
            "backend/static/js"
        ]
        
        for directory in directories:
            try:
                Path(directory).mkdir(parents=True, exist_ok=True)
                logger.info(f"✓ Répertoire vérifié: {directory}")
            except Exception as e:
                logger.error(f"✗ Erreur création répertoire {directory}: {e}")
                return False
        
        return True

    def check_dependencies(self):
        """Vérifier les dépendances critiques."""
        critical_deps = [
            'fastapi',
            'uvicorn',
            'python-docx',
            'pdfplumber',
            'pdf2docx',
            'jinja2'
        ]
        
        optional_deps = [
            'transformers',
            'torch',
            'numpy',
            'scikit-learn'
        ]
        
        missing_critical = []
        missing_optional = []
        
        for dep in critical_deps:
            try:
                __import__(dep.replace('-', '_'))
                logger.info(f"✓ {dep}")
            except ImportError:
                missing_critical.append(dep)
                logger.error(f"✗ {dep} (critique)")
        
        for dep in optional_deps:
            try:
                __import__(dep)
                logger.info(f"✓ {dep}")
            except ImportError:
                missing_optional.append(dep)
                logger.warning(f"⚠ {dep} (optionnel)")
        
        if missing_critical:
            logger.error("Dépendances critiques manquantes: %s", ', '.join(missing_critical))
            logger.info("Installez avec: pip install -r backend/requirements.txt")
            return False
        
        if missing_optional:
            logger.warning("Dépendances optionnelles manquantes: %s", ', '.join(missing_optional))
            logger.info("Mode IA limité. Installez avec: pip install torch transformers")
        
        return True

    def create_default_configuration(self):
        """Créer les fichiers de configuration par défaut."""
        configs = {
            "backend/rules.json": {
                "regex_rules": [
                    {"pattern": "\\b\\d{2}/\\d{2}/\\d{4}\\b", "replacement": "[DATE]", "enabled": True},
                    {"pattern": "[\\w\\.-]+@[\\w\\.-]+", "replacement": "[EMAIL]", "enabled": True}
                ],
                "ner": {
                    "model": "hf-internal-testing/tiny-bert-large-cased-finetuned-conll03-english",
                    "confidence": 0.5,
                    "device": "auto"
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
            },
            "backend/presets.json": {
                "light": {
                    "name": "Anonymisation légère",
                    "description": "Supprime uniquement les emails et téléphones",
                    "entity_types": ["EMAIL", "PHONE"],
                    "replacement_mode": "type"
                },
                "standard": {
                    "name": "Anonymisation standard", 
                    "description": "Supprime les données personnelles principales",
                    "entity_types": ["EMAIL", "PHONE", "PERSON", "ADDRESS", "DATE"],
                    "replacement_mode": "type"
                },
                "complete": {
                    "name": "Anonymisation complète",
                    "description": "Supprime toutes les données identifiantes",
                    "entity_types": ["EMAIL", "PHONE", "PERSON", "ORG", "ADDRESS", "DATE", "LOC", "IBAN", "SIREN", "SIRET"],
                    "replacement_mode": "generic"
                }
            }
        }
        
        for config_path, config_data in configs.items():
            config_file = Path(config_path)
            if not config_file.exists():
                try:
                    config_file.parent.mkdir(parents=True, exist_ok=True)
                    config_file.write_text(
                        json.dumps(config_data, indent=2, ensure_ascii=False), 
                        encoding="utf-8"
                    )
                    logger.info(f"✓ Configuration créée: {config_path}")
                except Exception as e:
                    logger.error(f"✗ Erreur création config {config_path}: {e}")
                    return False
            else:
                logger.info(f"✓ Configuration existante: {config_path}")
        
        return True

    def setup_environment_variables(self):
        """Configurer les variables d'environnement."""
        env_vars = {
            "NER_MODEL": "hf-internal-testing/tiny-bert-large-cased-finetuned-conll03-english",
            "NER_CONFIDENCE": "0.5",
            "NER_DEVICE": "cpu",
            "NER_CACHE_DIR": str(Path("backend/.cache").absolute()),
            "PYTHONPATH": str(Path(".").absolute())
        }
        
        for var, default in env_vars.items():
            if var not in os.environ:
                os.environ[var] = default
                logger.info(f"✓ Variable d'environnement: {var}={default}")
            else:
                logger.info(f"✓ Variable existante: {var}={os.environ[var]}")
        
        return True

    def test_imports_and_functionality(self):
        """Tester les imports et fonctionnalités critiques."""
        try:
            logger.info("Test des imports critiques...")
            
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
            
            # Test Vue.js et PDF.js (vérification des CDN)
            try:
                response = requests.get("https://unpkg.com/vue@3/dist/vue.global.prod.js", timeout=5)
                if response.status_code == 200:
                    logger.info("✓ CDN Vue.js accessible")
                else:
                    logger.warning("⚠ CDN Vue.js non accessible")
            except:
                logger.warning("⚠ CDN Vue.js non accessible")
            
            try:
                response = requests.get("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", timeout=5)
                if response.status_code == 200:
                    logger.info("✓ CDN PDF.js accessible")
                else:
                    logger.warning("⚠ CDN PDF.js non accessible")
            except:
                logger.warning("⚠ CDN PDF.js non accessible")
            
            # Test IA (optionnel)
            try:
                from transformers import pipeline
                logger.info("✓ transformers (mode IA disponible)")
            except ImportError:
                logger.warning("⚠ transformers non disponible (mode IA désactivé)")
            
            # Test modules locaux
            sys.path.insert(0, str(Path("backend").absolute()))
            try:
                from anonymizer import RegexAnonymizer
                from storage import jobs_store
                from ai_anonymizer import AIAnonymizer
                logger.info("✓ Modules locaux")
            except ImportError as e:
                logger.error(f"✗ Erreur import modules locaux: {e}")
                return False
            
            return True
            
        except ImportError as e:
            logger.error(f"✗ Erreur d'import critique: {e}")
            return False

    def run_basic_tests(self):
        """Exécuter des tests de base."""
        try:
            logger.info("Exécution des tests de base...")
            
            # Test création d'un document simple
            from docx import Document
            doc = Document()
            doc.add_paragraph("Test d'anonymisation")
            
            # Test du système de stockage
            sys.path.insert(0, str(Path("backend").absolute()))
            from storage import jobs_store
            
            test_key = f"test_{int(time.time())}"
            jobs_store.set(test_key, {"status": "test", "timestamp": datetime.now().isoformat()})
            retrieved = jobs_store.get(test_key)
            assert retrieved["status"] == "test"
            jobs_store.delete(test_key)
            
            # Test de détection d'entités
            from anonymizer import RegexAnonymizer
            anonymizer = RegexAnonymizer()
            entities = anonymizer.detect("Contact: test@example.com et 01 23 45 67 89")
            assert len(entities) >= 2  # Au moins email et téléphone
            
            logger.info("✓ Tests de base réussis")
            return True
            
        except Exception as e:
            logger.error(f"✗ Erreur lors des tests: {e}")
            return False

    def check_port_availability(self):
        """Vérifier que le port est disponible."""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex((self.host, self.port))
            sock.close()
            
            if result == 0:
                logger.warning(f"⚠ Port {self.port} déjà utilisé")
                return False
            else:
                logger.info(f"✓ Port {self.port} disponible")
                return True
        except Exception as e:
            logger.error(f"✗ Erreur vérification port: {e}")
            return False

    def wait_for_server(self, timeout=30):
        """Attendre que le serveur soit prêt."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"http://{self.host}:{self.port}/health", timeout=2)
                if response.status_code in [200, 503]:  # 503 = degraded but running
                    logger.info("✓ Serveur démarré et accessible")
                    return True
            except:
                pass
            time.sleep(1)
        
        logger.error("✗ Timeout: serveur non accessible")
        return False

    def start_server(self):
        """Démarrer le serveur uvicorn."""
        try:
            logger.info("Démarrage du serveur...")
            
            cmd = [
                sys.executable, "-m", "uvicorn", 
                "backend.main:app",
                "--host", self.host,
                "--port", str(self.port)
            ]
            
            if self.dev_mode:
                cmd.extend(["--reload", "--reload-dir", "backend"])
                logger.info("Mode développement activé avec auto-reload")
            
            # Démarrer le processus
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            logger.info(f"Serveur démarré (PID: {self.server_process.pid})")
            
            # Attendre que le serveur soit prêt
            if self.wait_for_server():
                return True
            else:
                self.stop_server()
                return False
                
        except Exception as e:
            logger.error(f"✗ Erreur lors du démarrage du serveur: {e}")
            return False

    def stop_server(self):
        """Arrêter le serveur."""
        if self.server_process:
            logger.info("Arrêt du serveur...")
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.warning("Arrêt forcé du serveur")
                self.server_process.kill()
            self.server_process = None

    def setup_signal_handlers(self):
        """Configurer les gestionnaires de signaux."""
        def signal_handler(sig, frame):
            logger.info(f"Signal {sig} reçu, arrêt de l'application...")
            self.stop_server()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def display_startup_info(self):
        """Afficher les informations de démarrage."""
        print("\n" + "="*60)
        print("🚀 ANONYMISEUR DE DOCUMENTS JURIDIQUES - v2.0")
        print("="*60)
        print(f"📍 Interface web: http://{self.host}:{self.port}")
        print(f"🔧 API Documentation: http://{self.host}:{self.port}/docs")
        print(f"❤️  Health Check: http://{self.host}:{self.port}/health")
        print(f"📊 Admin Stats: http://{self.host}:{self.port}/admin/stats")
        print("="*60)
        print("📝 Fonctionnalités disponibles:")
        print("   • Upload de documents PDF et DOCX")
        print("   • Détection d'entités par Regex et IA")
        print("   • Interface d'annotation avancée")
        print("   • Viewer PDF intégré")
        print("   • Gestion de groupes d'entités")
        print("   • Export avec options avancées")
        print("="*60)
        print("⏹️  Arrêt: Ctrl+C")
        print("="*60)

    def run_diagnostics(self):
        """Exécuter un diagnostic complet du système."""
        logger.info("=== DIAGNOSTIC SYSTÈME ===")
        
        checks = [
            ("Version Python", self.check_python_version),
            ("Répertoires", self.check_and_create_directories),
            ("Dépendances", self.check_dependencies),
            ("Configuration", self.create_default_configuration),
            ("Variables d'environnement", self.setup_environment_variables),
            ("Imports et fonctionnalités", self.test_imports_and_functionality),
            ("Tests de base", self.run_basic_tests),
            ("Disponibilité du port", self.check_port_availability)
        ]
        
        failed_checks = []
        
        for name, check_func in checks:
            logger.info(f"Vérification: {name}")
            try:
                if not check_func():
                    failed_checks.append(name)
                    logger.error(f"❌ Échec: {name}")
                else:
                    logger.info(f"✅ Succès: {name}")
            except Exception as e:
                failed_checks.append(name)
                logger.error(f"❌ Erreur lors de {name}: {e}")
        
        if failed_checks:
            logger.error(f"❌ Vérifications échouées: {', '.join(failed_checks)}")
            return False
        
        logger.info("✅ Toutes les vérifications sont OK")
        return True

    def run(self, dev_mode=False, host="0.0.0.0", port=8000):
        """Démarrer l'application complète."""
        self.dev_mode = dev_mode
        self.host = host
        self.port = port
        
        logger.info("=== DÉMARRAGE DE L'ANONYMISEUR ===")
        
        # Diagnostic du système
        if not self.run_diagnostics():
            logger.error("❌ Échec du diagnostic, arrêt du démarrage")
            return False
        
        # Configuration des gestionnaires de signaux
        self.setup_signal_handlers()
        
        # Démarrage du serveur
        if not self.start_server():
            logger.error("❌ Échec du démarrage du serveur")
            return False
        
        # Affichage des informations
        self.display_startup_info()
        
        try:
            # Boucle principale - afficher les logs du serveur
            if self.server_process:
                for line in iter(self.server_process.stdout.readline, ''):
                    print(line.rstrip())
                    if self.server_process.poll() is not None:
                        break
        except KeyboardInterrupt:
            logger.info("Arrêt demandé par l'utilisateur")
        finally:
            self.stop_server()
        
        return True

def main():
    """Fonction principale avec arguments en ligne de commande."""
    parser = argparse.ArgumentParser(
        description="Anonymiseur de documents juridiques - Interface avancée"
    )
    parser.add_argument(
        "--dev", 
        action="store_true", 
        help="Mode développement avec auto-reload"
    )
    parser.add_argument(
        "--port", 
        type=int, 
        default=8000, 
        help="Port du serveur (défaut: 8000)"
    )
    parser.add_argument(
        "--host", 
        default="0.0.0.0", 
        help="Adresse d'écoute (défaut: 0.0.0.0)"
    )
    parser.add_argument(
        "--check-only", 
        action="store_true", 
        help="Effectuer uniquement les vérifications sans démarrer le serveur"
    )
    
    args = parser.parse_args()
    
    bootstrap = AnonymizerBootstrap()
    
    if args.check_only:
        # Mode vérification uniquement
        logger.info("Mode vérification uniquement")
        success = bootstrap.run_diagnostics()
        sys.exit(0 if success else 1)
    else:
        # Mode normal
        success = bootstrap.run(
            dev_mode=args.dev,
            host=args.host,
            port=args.port
        )
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()