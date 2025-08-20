# Anonymiseur de Documents Juridiques - Version Avancée 2.0

> Interface d'anonymisation complète avec viewer PDF intégré, gestion avancée des entités et workflow collaboratif

## 🚀 Nouveautés de la Version 2.0

### Interface Utilisateur Révolutionnée
- ✨ **Viewer PDF natif** avec PDF.js intégré
- 🎯 **Highlighting en temps réel** des entités détectées
- 📱 **Interface responsive** optimisée mobile/tablette
- 🎨 **Design moderne** avec animations fluides
- ⌨️ **Raccourcis clavier** pour une navigation rapide

### Fonctionnalités Avancées
- 🔍 **Recherche intelligente** avec filtres multiples
- 👥 **Gestion de groupes** d'entités avec drag & drop
- 📊 **Système de confidence** pour les détections IA
- 🔄 **Auto-sauvegarde** et historique des modifications
- 📤 **Export avancé** avec options personnalisables

### Performance et Stabilité
- ⚡ **Traitement asynchrone** optimisé
- 💾 **Stockage persistant** avec cleanup automatique
- 🔧 **API REST complète** avec documentation Swagger
- 📈 **Monitoring** et health checks intégrés
- 🛡️ **Gestion d'erreurs** robuste

## 📋 Prérequis

- **Python 3.8+** 
- **4 GB RAM minimum** (8 GB recommandé pour l'IA)
- **2 GB d'espace disque libre**
- **Connexion internet** (pour les CDN et modèles IA)

### Dépendances Système
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3-pip python3-dev

# macOS (avec Homebrew)
brew install python

# Windows
# Télécharger Python depuis python.org
```

## 🔧 Installation Rapide

### 1. Cloner le Repository
```bash
git clone <URL_DU_DEPOT>
cd anonymizer-advanced
```

### 2. Installation Automatique
```bash
# Script d'installation avec vérifications
python startup.py --check-only

# Installation des dépendances si nécessaire
pip install -r backend/requirements.txt
```

### 3. Démarrage
```bash
# Démarrage normal
python startup.py

# Mode développement avec auto-reload
python startup.py --dev

# Port personnalisé
python startup.py --port 3000
```

## 🌐 Accès à l'Interface

Une fois démarré, l'application est accessible sur :

- **Interface principale** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs
- **Health Check** : http://localhost:8000/health
- **Statistiques Admin** : http://localhost:8000/admin/stats

## 📖 Guide d'Utilisation

### 1. Upload et Traitement

#### Modes de Traitement
- **Regex (Rapide)** : Détection basée sur des patterns
  - Entités : EMAIL, PHONE, DATE, ADDRESS, IBAN, SIREN, SIRET, LOC
  - Temps : 10-30 secondes
  - Recommandé pour : Documents standardisés

- **IA (Intelligent)** : Détection par NER + Regex
  - Entités : PERSON, ORG + toutes les entités Regex
  - Temps : 1-3 minutes
  - Recommandé pour : Documents complexes

#### Formats Supportés
- **PDF** : Conversion automatique vers DOCX
- **DOCX** : Traitement direct avec préservation du format

### 2. Interface d'Annotation

#### Navigation
- **Sidebar** : Outils d'annotation et gestion des entités
- **Viewer** : Document avec highlighting interactif
- **Toolbar** : Contrôles de zoom, navigation, modes

#### Raccourcis Clavier
- `Ctrl+Z` / `Ctrl+Y` : Annuler / Rétablir
- `Ctrl+S` : Sauvegarder
- `Ctrl+F` : Rechercher
- `Esc` : Désélectionner
- `Delete` : Supprimer l'entité sélectionnée
- `←` / `→` : Navigation pages (PDF)
- `+` / `-` : Zoom
- `0` : Réinitialiser zoom

### 3. Gestion des Entités

#### Actions Individuelles
- **Clic sur entité** : Sélection et détails
- **Hover** : Prévisualisation rapide
- **Édition inline** : Double-clic pour modifier
- **Glisser-déposer** : Assignation aux groupes

#### Actions en Lot
- **Sélection multiple** : Ctrl+clic
- **Filtrage par type** : Boutons de filtre
- **Suppression groupée** : Bouton de suppression
- **Groupement automatique** : Par type ou critères

### 4. Système de Groupes

#### Création et Gestion
```javascript
// Exemple de groupe
{
  "name": "Informations personnelles",
  "description": "Données identifiantes des personnes",
  "entities": ["person_1", "email_1", "phone_1"],
  "replacement_pattern": "[PERSONNE_{{index}}]"
}
```

#### Cas d'Usage
- **Parties contractuelles** : Regrouper personnes et organisations
- **Coordonnées** : Emails, téléphones, adresses liées
- **Données financières** : IBAN, SIREN, montants

### 5. Export et Options

#### Formats de Sortie
- **DOCX anonymisé** : Format identique à l'original
- **Rapport d'audit** : Liste détaillée des modifications
- **Métadonnées** : Statistiques et informations de traitement

#### Options Avancées
- **Filigrane** : "DOCUMENT ANONYMISÉ"
- **Protection par mot de passe** : Sécurisation du fichier
- **Compression** : Réduction de la taille
- **Audit trail** : Traçabilité complète

## ⚙️ Configuration Avancée

### Variables d'Environnement

```bash
# Configuration IA
export NER_MODEL="camembert-ner"
export NER_CONFIDENCE="0.8"
export NER_DEVICE="cuda"  # ou "cpu"
export NER_CACHE_DIR="/path/to/cache"

# Configuration serveur
export HOST="0.0.0.0"
export PORT="8000"
export WORKERS="4"

# Configuration stockage
export DATA_DIR="/path/to/data"
export MAX_FILE_SIZE_MB="50"
export CLEANUP_INTERVAL_HOURS="24"
```

### Fichiers de Configuration

#### Rules.json
```json
{
  "regex_rules": [
    {
      "pattern": "\\b\\d{2}/\\d{2}/\\d{4}\\b",
      "replacement": "[DATE]",
      "enabled": true
    }
  ],
  "ner": {
    "model": "custom-model-name",
    "confidence": 0.7,
    "device": "auto"
  },
  "styles": {
    "PERSON": "[PERSONNE_{{index}}]",
    "ORG": "[ORGANISATION_{{index}}]"
  }
}
```

#### Presets.json
```json
{
  "gdpr_compliant": {
    "name": "Conformité RGPD",
    "description": "Anonymisation selon les standards RGPD",
    "entity_types": ["PERSON", "EMAIL", "PHONE", "ADDRESS"],
    "replacement_mode": "pseudonymization"
  }
}
```

## 🔌 API REST

### Endpoints Principaux

#### Upload et Traitement
```bash
# Upload d'un fichier
POST /upload
Content-Type: multipart/form-data
{
  "file": <file>,
  "mode": "ai",
  "confidence": 0.7
}

# Statut du traitement
GET /status/{job_id}
```

#### Gestion des Entités
```bash
# Lister les entités
GET /entities/{job_id}

# Créer une entité
POST /entities/{job_id}
{
  "type": "EMAIL",
  "value": "user@example.com",
  "replacement": "[EMAIL_1]"
}

# Modifier une entité
PUT /entities/{job_id}/{entity_id}

# Supprimer une entité
DELETE /entities/{job_id}/{entity_id}

# Opérations en lot
POST /entities/{job_id}/bulk
{
  "operation": "delete",
  "entity_ids": ["id1", "id2"]
}
```

#### Gestion des Groupes
```bash
# Lister les groupes
GET /groups/{job_id}

# Créer un groupe
POST /groups/{job_id}
{
  "name": "Parties prenantes",
  "description": "Personnes impliquées"
}

# Assigner une entité à un groupe
POST /groups/{job_id}/{group_id}/entities/{entity_id}
```

#### Export
```bash
# Exporter avec options
POST /export/{job_id}
{
  "watermark": "CONFIDENTIEL",
  "audit": true,
  "format": "docx"
}
```

### Recherche et Filtrage
```bash
# Recherche d'entités
POST /entities/{job_id}/search
{
  "text": "dupont",
  "entity_type": "PERSON",
  "confidence_min": 0.8
}

# Recherche sémantique
GET /semantic-search/{job_id}?q=entreprise
```

### Administration
```bash
# Statistiques système
GET /admin/stats

# Santé de l'application
GET /health

# Nettoyage manuel
POST /admin/cleanup
```

## 🏗️ Architecture Technique

### Backend (FastAPI)
```
backend/
├── main.py              # API principale
├── anonymizer.py        # Traitement documents
├── ai_anonymizer.py     # Détection IA
├── storage.py           # Persistance données
├── templates/           # Templates HTML
├── static/             # Assets statiques
│   ├── css/            # Styles
│   ├── js/             # JavaScript
│   ├── uploads/        # Fichiers uploadés
│   └── exports/        # Fichiers exportés
└── data/               # Stockage JSON
```

### Frontend (Vue.js 3)
- **Composition API** pour la réactivité
- **PDF.js** pour le rendu de documents
- **Tailwind CSS** pour le styling
- **Font Awesome** pour les icônes

### Stockage
- **JSON Files** pour la persistance locale
- **File System** pour les documents
- **In-Memory** pour les sessions actives

## 🧪 Tests et Qualité

### Tests Automatisés
```bash
# Tests unitaires
python -m pytest tests/ -v

# Tests d'intégration
python -m pytest tests/test_integration.py -v

# Tests de performance
python -m pytest tests/test_performance.py -v
```

### Couverture de Code
```bash
# Générer le rapport de couverture
python -m pytest --cov=backend tests/
python -m pytest --cov-report=html
```

### Linting et Formatage
```bash
# Black (formatage)
black backend/

# Flake8 (linting)
flake8 backend/

# isort (imports)
isort backend/
```

## 🚀 Déploiement

### Développement
```bash
# Mode développement avec auto-reload
python startup.py --dev

# Debug avec logs détaillés
PYTHONPATH=. python -m uvicorn backend.main:app --reload --log-level debug
```

### Production

#### Docker
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "startup.py", "--host", "0.0.0.0", "--port", "8000"]
```

#### Systemd Service
```ini
[Unit]
Description=Anonymiseur de Documents
After=network.target

[Service]
Type=simple
User=anonymizer
WorkingDirectory=/opt/anonymizer
ExecStart=/opt/anonymizer/venv/bin/python startup.py
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name anonymizer.example.com;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Monitoring et Logs

### Health Checks
```bash
# Vérification basique
curl http://localhost:8000/health

# Réponse attendue
{
  "status": "healthy",
  "timestamp": "2025-01-20T10:30:00Z",
  "components": {
    "storage": "healthy",
    "anonymizers": "healthy",
    "filesystem": "healthy"
  }
}
```

### Métriques
- **Jobs traités** : Nombre total et par période
- **Temps de traitement** : Moyennes et percentiles
- **Entités détectées** : Par type et confiance
- **Erreurs** : Taux et types d'erreurs
- **Utilisation ressources** : CPU, mémoire, disque

### Logs
```bash
# Logs applicatifs
tail -f backend/logs/app.log

# Logs de démarrage
tail -f backend/logs/startup.log

# Logs uvicorn
tail -f /var/log/anonymizer/access.log
```

## 🔒 Sécurité

### Bonnes Pratiques
- ✅ **Validation stricte** des entrées
- ✅ **Nettoyage automatique** des fichiers temporaires
- ✅ **Limitation de taille** des uploads
- ✅ **Isolation des processus** de traitement
- ✅ **Logs d'audit** pour traçabilité

### Configuration Sécurisée
```python
# Limites strictes
MAX_FILE_SIZE_MB = 25
MAX_CONCURRENT_JOBS = 10
FILE_RETENTION_HOURS = 24

# Validation des types MIME
ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

# Sanitisation des noms de fichiers
FILENAME_PATTERN = re.compile(r'^[a-zA-Z0-9._-]+)
```

## 🛠️ Dépannage

### Problèmes Courants

#### Erreur de Démarrage
```bash
# Vérifier les dépendances
python startup.py --check-only

# Nettoyer le cache
rm -rf backend/.cache/*
rm -rf backend/data/*
```

#### Problèmes de Performance
```bash
# Surveiller les ressources
htop
df -h

# Nettoyer les anciens fichiers
curl -X POST http://localhost:8000/admin/cleanup
```

#### Erreurs IA
```bash
# Forcer le CPU si GPU pose problème
export NER_DEVICE="cpu"

# Réduire la taille du modèle
export NER_MODEL="distilbert-base-cased"
```

### Logs de Debug
```python
# Activer les logs détaillés
logging.basicConfig(level=logging.DEBUG)

# Logs spécifiques par module
logging.getLogger('backend.anonymizer').setLevel(logging.DEBUG)
logging.getLogger('backend.ai_anonymizer').setLevel(logging.DEBUG)
```

## 📚 Ressources

### Documentation Technique
- [API Reference](http://localhost:8000/docs) - Documentation Swagger interactive
- [Vue.js Guide](https://vuejs.org/guide/) - Framework frontend
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/) - Rendu PDF
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/) - Framework backend

### Modèles IA Recommandés
- **Français** : `camembert-ner`, `flaubert-base-cased`
- **Multilingue** : `bert-base-multilingual-cased`
- **Rapide** : `distilbert-base-cased`
- **Précis** : `roberta-large`

### Communauté et Support
- **Issues GitHub** : Rapporter des bugs
- **Discussions** : Questions et suggestions
- **Wiki** : Documentation collaborative
- **Changelog** : Historique des versions

## 🔄 Roadmap

### Version 2.1 (Q2 2025)
- [ ] Support des fichiers RTF et ODT
- [ ] Mode collaboratif multi-utilisateur
- [ ] API webhooks pour intégrations
- [ ] Templates d'anonymisation par métier

### Version 2.2 (Q3 2025)
- [ ] Intelligence artificielle améliorer
- [ ] Support des langues supplémentaires
- [ ] Interface de configuration graphique
- [ ] Intégration bases de données

### Version 3.0 (Q4 2025)
- [ ] Architecture microservices
- [ ] Support cloud (AWS, Azure, GCP)
- [ ] Anonymisation temps réel
- [ ] Dashboard analytics avancé

## 🤝 Contribution

### Guide du Contributeur
1. **Fork** le repository
2. **Créer une branche** : `git checkout -b feature/amazing-feature`
3. **Commiter** : `git commit -m 'Add amazing feature'`
4. **Pousser** : `git push origin feature/amazing-feature`
5. **Pull Request** avec description détaillée

### Standards de Code
- **Python** : PEP 8, type hints, docstrings
- **JavaScript** : ES6+, Vue.js Composition API
- **CSS** : Tailwind utilities, BEM methodology
- **Tests** : Couverture > 80%, tests unitaires et d'intégration

### Architecture des Commits
```
type(scope): description

feat(api): add bulk entity operations
fix(ui): resolve PDF rendering on Safari
docs(readme): update installation guide
style(css): improve mobile responsiveness
refactor(core): optimize entity detection
test(integration): add export workflow tests
```

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **PDF.js Team** pour le rendu PDF côté client
- **Hugging Face** pour les modèles de NLP
- **Vue.js Team** pour le framework réactif
- **FastAPI Team** pour l'API moderne
- **Tailwind CSS** pour le système de design

---

**📞 Support** : Pour toute question technique, consultez la [documentation API](http://localhost:8000/docs) ou créez une [issue GitHub](https://github.com/your-repo/issues).

**🚀 Démo en ligne** : [demo.anonymizer.example.com](https://demo.anonymizer.example.com)

*Dernière mise à jour : Janvier 2025*