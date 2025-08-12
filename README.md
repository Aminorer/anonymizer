# Projet Anonymiseur Juridique

Ce dépôt contient une base minimale pour développer une application d'anonymisation de documents juridiques. L'objectif final est d'offrir une interface permettant d'uploader un document (DOCX ou PDF), d'analyser les entités sensibles puis de télécharger un DOCX anonymisé tout en préservant le format original.

## Structure du projet

```
backend/
  main.py             # API FastAPI basique (upload, pages placeholder)
  requirements.txt    # Dépendances backend
  templates/          # Pages HTML (index, progression, interface)
  static/             # Fichiers statiques (CSS)
```

## Démarrer le serveur de développement

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Ouvrir ensuite [http://localhost:8000](http://localhost:8000) pour accéder à la page d'accueil.

## Configuration du modèle NER

Le nom du modèle de reconnaissance d'entités ainsi que le seuil de confiance
par défaut sont lus depuis `backend/rules.json`. Ils peuvent également être
surchargés via les variables d'environnement suivantes :

- `NER_MODEL` : identifiant du modèle Hugging Face à utiliser.
- `NER_CONFIDENCE` : seuil de confiance minimal.
- `NER_DEVICE` : "cpu" ou "gpu" pour forcer l'usage du CPU ou du GPU.
- `NER_CACHE_DIR` : répertoire local pour mettre en cache les modèles.

Par défaut, si un GPU compatible est disponible, il sera utilisé.

## Fonctionnalités actuelles

- Upload d'un fichier DOCX (≤25 Mo) via le formulaire d'accueil
- Détection et anonymisation par **Regex** des entités suivantes :
  `LOC`, `ADDRESS`, `EMAIL`, `PHONE`, `DATE`, `IBAN`, `SIREN`, `SIRET`
- Téléchargement d'un DOCX anonymisé tout en conservant la mise en forme

## Fonctionnalités prévues
- **Mode Regex** : détection rapide de 8 entités (LOC, ADDRESS, EMAIL, PHONE, DATE, IBAN, SIREN, SIRET)
- **Mode IA** : détection étendue via NER et Regex avec réglage de la confiance
- **Interface unifiée** avec visualisation du document, gestion des entités et groupes
- **Export DOCX** identique au document original, seules les valeurs anonymisées changent

Ce README sera complété au fur et à mesure de l'avancement du projet.
