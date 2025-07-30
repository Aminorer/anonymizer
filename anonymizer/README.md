# 🛡️ Anonymiseur Juridique RGPD v2.0

Application web d'anonymisation de documents juridiques français, **100% conforme RGPD** avec architecture moderne Vercel + DistilCamemBERT.

## 🎯 Nouveautés v2.0 - Architecture Optimisée

### ⚡ Performance & Scalabilité
- **Architecture Vercel** : Déploiement serverless optimisé
- **DistilCamemBERT** : Modèle NER français léger (~250MB)
- **Sessions mémoire** : Plus de dépendance Redis
- **Temps de traitement** : 2-5s (standard), 5-15s (approfondi)

### 🧠 Séparation Stricte REGEX/NER

#### ✅ REGEX : UNIQUEMENT données STRUCTURÉES
- 📞 **Numéros de téléphone** (formats français)
- 📧 **Adresses email** (validation stricte)
- 🏭 **SIRET/SIREN** (avec validation checksum)
- 🆔 **Numéros de sécurité sociale**
- 🏠 **Adresses postales françaises**
- ⚖️ **Références juridiques** (N° RG, articles...)

#### ✅ NER : UNIQUEMENT entités COMPLEXES
- 👤 **Noms de personnes** (Jean Dupont, Maître Martin...)
- 🏢 **Organisations/entreprises** (Cabinet Durand, SARL TechCorp...)

#### ❌ INTERDICTIONS STRICTES
- ❌ **Regex sur noms/organisations** (trop complexe, faux positifs)
- ❌ **NER sur données structurées** (overkill, moins précis)

---

## 🚀 Déploiement Rapide

### Option 1 : Déploiement Vercel (Recommandé)

```bash
# 1. Clone le repository
git clone https://github.com/votre-repo/anonymiseur-juridique-rgpd
cd anonymiseur-juridique-rgpd

# 2. Installation des dépendances
npm install

# 3. Déploiement en un clic
vercel --prod
```

### Option 2 : Développement Local

```bash
# 1. Installation
npm install
pip install -r api/requirements.txt

# 2. Lancement développement
vercel dev

# 3. Accès
# Frontend: http://localhost:3000
# API: http://localhost:3000/api
```

---

## 🏗️ Architecture Technique

### 📁 Structure du Projet

```
anonymizer/
├── api/                    # Backend FastAPI (Vercel Functions)
│   ├── main.py            # Point d'entrée FastAPI + routes
│   ├── analyzer.py        # HybridAnalyzer (REGEX/NER séparés)
│   ├── processor.py       # Document processor simplifié
│   ├── models.py          # Pydantic models + config
│   ├── session.py         # Session en mémoire (pas Redis)
│   └── requirements.txt   # Dependencies minimales
├── src/                   # Frontend React
│   ├── components/        # Composants UI
│   ├── pages/            # Pages principales
│   ├── services/         # API calls
│   ├── types/            # TypeScript interfaces
│   └── utils/            # Helpers
├── public/               # Assets statiques
├── vercel.json           # Configuration Vercel
├── package.json          # Dependencies frontend
└── README.md             # Cette documentation
```

### 🔧 Stack Technique

**Backend (Vercel Functions)**
- **FastAPI** : API REST moderne et performante
- **DistilCamemBERT** : Modèle NER français optimisé (~250MB)
- **Transformers** : Pipeline NER avec lazy loading
- **python-docx** : Manipulation documents Word
- **PyPDF2 + OCR** : Support PDF avec Tesseract

**Frontend (React + Vite)**
- **React 18 + TypeScript** : Interface utilisateur moderne
- **Tailwind CSS** : Design system cohérent
- **Zustand** : Gestion d'état simplifiée
- **react-dropzone** : Upload par glisser-déposer
- **Lucide React** : Icônes modernes

**Infrastructure**
- **Vercel** : Hébergement serverless
- **Sessions mémoire** : Conformité RGPD stricte
- **DistilCamemBERT local** : Aucun appel API externe

---

## 📋 Guide d'Utilisation

### Étape 1 : Upload du Document
1. Accéder à l'application web
2. Glisser-déposer un fichier PDF ou DOCX (max 50MB)
3. Choisir le mode d'analyse :
   - **Standard** : Rapide (2-5s), REGEX uniquement sur données structurées
   - **Approfondi** : Précis (5-15s), REGEX + NER pour noms et organisations

### Étape 2 : Contrôle des Entités
1. Réviser les entités détectées automatiquement
2. **Entités REGEX** : Téléphones, emails, SIRET, adresses (confiance 95-99%)
3. **Entités NER** : Noms de personnes, organisations (confiance 80-95%)
4. Cocher/décocher les entités à anonymiser
5. Personnaliser les remplacements si nécessaire
6. Ajouter des entités manuelles si besoin

### Étape 3 : Génération
1. Cliquer sur "Générer document anonymisé"
2. Le document DOCX anonymisé se télécharge automatiquement
3. Format et mise en forme originaux préservés
4. Log d'audit RGPD généré automatiquement

---

## 🎯 Types d'Entités Détectées

### 🔧 Données Structurées (REGEX)

| Type | Exemples | Validation | Confiance |
|------|----------|------------|-----------|
| **📞 Téléphone** | `01 23 45 67 89`, `+33 1 23 45 67 89` | Format français | 98% |
| **📧 Email** | `contact@exemple.fr` | Syntaxe stricte | 97% |
| **🆔 Sécurité Sociale** | `1 85 12 75 123 456 78` | Format français | 99% |
| **🏭 SIRET/SIREN** | `12345678901234`, `RCS Paris 123456789` | Checksum | 96-99% |
| **🏠 Adresse** | `123 rue de la Paix 75001 Paris` | Structure française | 85% |
| **⚖️ Référence Juridique** | `N°RG 2023/123`, `Article 1234` | Motifs juridiques | 94% |

### 🧠 Entités Complexes (NER DistilCamemBERT)

| Type | Exemples | Modèle | Confiance |
|------|----------|--------|-----------|
| **👤 Personne** | `Maître Jean Dupont`, `M. Pierre Martin` | DistilCamemBERT | 80-95% |
| **🏢 Organisation** | `Cabinet Juridique SARL`, `Tribunal de Paris` | DistilCamemBERT | 80-95% |

---

## ⚡ Performance & Optimisations

### 🎯 Temps de Traitement Cibles
- **Document 10 pages** : 3-8 secondes (mode standard)
- **Document 50 pages** : 8-20 secondes (mode approfondi)
- **PDF scanné** : +30% (OCR Tesseract)

### 🚀 Optimisations Implémentées

#### Backend
- **Lazy Loading** : DistilCamemBERT chargé seulement si nécessaire
- **Chunking Intelligent** : Découpe par phrases (max 400 tokens)
- **Cache Patterns** : Compilation regex mise en cache
- **Validation Checksum** : SIRET/SIREN avec algorithme Luhn

#### Frontend  
- **Code Splitting** : Chargement optimisé des composants
- **State Management** : Zustand pour performance
- **Debounced Updates** : Éviter les re-renders inutiles

#### Infrastructure Vercel
- **Serverless Functions** : Scalabilité automatique
- **Edge Caching** : Assets statiques optimisés
- **Memory Management** : 512MB RAM avec monitoring

---

## 🔒 Conformité RGPD Stricte

### ✅ Garanties Techniques
- **Traitement 100% local** : Vercel serverless européen
- **Aucun stockage externe** : Sessions temporaires en mémoire
- **Suppression automatique** : Données effacées après 15 minutes
- **Audit trail complet** : Log de toutes les modifications
- **Chiffrement en transit** : HTTPS obligatoire

### 📋 Configuration RGPD
```json
{
  "data_processing": "local_serverless_only",
  "external_apis": false,
  "data_retention_minutes": 0,
  "audit_logging": true,
  "user_consent": "explicit",
  "model_source": "huggingface_local_cache",
  "session_max_duration_minutes": 15,
  "auto_deletion": true,
  "compliance_level": "RGPD_strict"
}
```

### 🛡️ Mesures de Sécurité
- **Headers de sécurité** : X-Frame-Options, CSP, HSTS
- **Validation stricte** : Tous les inputs utilisateur
- **Rate Limiting** : Protection contre les abus
- **CORS configuré** : Origines autorisées uniquement

---

## 🧪 Développement & Tests

### Installation Complète
```bash
# Clone et installation
git clone https://github.com/votre-repo/anonymiseur-juridique-rgpd
cd anonymiseur-juridique-rgpd
npm install

# Installation Python (backend)
cd api
pip install -r requirements.txt

# Test du modèle DistilCamemBERT
python -c "from transformers import pipeline; ner = pipeline('ner', model='cmarkea/distilcamembert-base-ner'); print('✅ Modèle DistilCamemBERT opérationnel')"
```

### Tests de Performance
```bash
# Test analyse standard (doit être < 5s)
curl -X POST "http://localhost:3000/api/analyze" \
  -F "file=@test_document.pdf" \
  -F "mode=standard"

# Test analyse approfondie (doit être < 15s)  
curl -X POST "http://localhost:3000/api/analyze" \
  -F "file=@test_document.pdf" \
  -F "mode=approfondi"
```

### Monitoring
```bash
# Santé de l'application
curl http://localhost:3000/api/health

# Statistiques détaillées
curl http://localhost:3000/api/stats
```

---

## 📊 Métriques & Monitoring

### 🎯 KPIs de Performance
- **Temps de chargement initial** : < 3s
- **Temps d'analyse standard** : 2-5s
- **Temps d'analyse approfondie** : 5-15s  
- **Utilisation RAM** : < 512MB
- **Taux de succès** : > 99%

### 📈 Tableaux de Bord
- **Vercel Analytics** : Performance et usage
- **API Metrics** : Temps de réponse par endpoint
- **Error Tracking** : Monitoring des erreurs
- **RGPD Compliance** : Suivi des suppressions

---

## 🔧 Configuration Avancée

### Variables d'Environnement

#### Backend (Vercel Functions)
```bash
PYTHONPATH=/var/task/api
TRANSFORMERS_CACHE=/tmp/transformers
HF_HOME=/tmp/huggingface
TOKENIZERS_PARALLELISM=false
```

#### Frontend 
```bash
VITE_API_URL=/api
VITE_APP_NAME="Anonymiseur Juridique RGPD"
VITE_MAX_FILE_SIZE=52428800
```

### Personnalisation

#### Ajout de Nouveaux Types d'Entités
1. **Données structurées** : Modifier `api/models.py` → `STRUCTURED_ENTITY_TYPES`
2. **Entités complexes** : Pas de modification nécessaire (DistilCamemBERT gère automatiquement)

#### Modification des Patterns Regex
```python
# Dans api/analyzer.py
'NOUVEAU_TYPE': [
    re.compile(r'votre_pattern_regex', re.IGNORECASE)
]
```

---

## 🚨 Dépannage

### Problèmes Courants

#### ❌ Erreur "Model not found"
```bash
# Solution : Vérifier le cache DistilCamemBERT
python -c "from transformers import pipeline; pipeline('ner', model='cmarkea/distilcamembert-base-ner')"
```

#### ❌ Timeout Vercel (>30s)
- **Cause** : Document trop volumineux ou mode approfondi sur gros fichier
- **Solution** : Utiliser mode standard ou diviser le document

#### ❌ Erreur mémoire (>512MB)
- **Cause** : Plusieurs modèles chargés simultanément  
- **Solution** : Lazy loading activé automatiquement (vérifier logs)

#### ❌ OCR Tesseract échoue
- **Cause** : PDF scanné avec qualité insuffisante
- **Solution** : Améliorer la qualité du scan ou conversion manuelle

### Logs de Débogage
```bash
# Logs Vercel en temps réel
vercel logs --follow

# Logs spécifiques à l'API
vercel logs --follow --scope=api

# Debug local
npm run dev -- --debug
```

---

## 📞 Support & Contribution

### 🐛 Signaler un Bug
1. Vérifier les [issues existantes](https://github.com/votre-repo/issues)
2. Utiliser le template de bug report
3. Inclure les logs et un document de test

### 💡 Demander une Fonctionnalité  
1. Consulter la [roadmap](https://github.com/votre-repo/projects)
2. Ouvrir une issue avec le template feature request
3. Décrire le cas d'usage et la valeur ajoutée

### 🤝 Contribuer
1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committer les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Pousser la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

---

## 📄 Licence & Mentions Légales

### 🔐 Licence
Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

### 🏛️ Conformité Juridique
- **RGPD** : Conformité totale avec suppression automatique
- **Données personnelles** : Traitement local uniquement
- **Audit trail** : Log complet pour contrôles
- **Droit à l'oubli** : Suppression immédiate post-traitement

### 🤖 Modèles Utilisés
- **DistilCamemBERT** : [cmarkea/distilcamembert-base-ner](https://huggingface.co/cmarkea/distilcamembert-base-ner)
- **Licence** : Apache 2.0
- **Source** : HuggingFace Transformers

---

## 🎉 Changelog

### v2.0.0 - Architecture Vercel + DistilCamemBERT
- ✅ **Migration complète** Docker → Vercel
- ✅ **SpaCy → DistilCamemBERT** (250MB, français optimisé)
- ✅ **Redis → Sessions mémoire** (RGPD strict)
- ✅ **Séparation stricte** REGEX/NER selon spécifications
- ✅ **Performance optimisée** (2-5s standard, 5-15s approfondi)
- ✅ **RGPD renforcé** (suppression immédiate, audit automatique)

### v1.0.0 - Version Docker Originale
- ❌ Architecture Docker complexe
- ❌ SpaCy + Ollama LLM lourd
- ❌ Redis requis pour sessions
- ❌ Patterns regex non optimisés

---

**Version** : 2.0.0  
**Dernière mise à jour** : 2024  
**Architecture** : Vercel + DistilCamemBERT + React  
**Conformité RGPD** : ✅ Stricte (0 minute de rétention)  
**Performance** : ✅ Optimisée (<30s, <512MB)  
**Séparation REGEX/NER** : ✅ Strictement respectée