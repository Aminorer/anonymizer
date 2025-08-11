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

## Fonctionnalités prévues
- **Mode Regex** : détection rapide de 8 entités (LOC, ADDRESS, EMAIL, PHONE, DATE, IBAN, SIREN, SIRET)
- **Mode IA** : détection étendue via NER et Regex avec réglage de la confiance
- **Interface unifiée** avec visualisation du document, gestion des entités et groupes
- **Export DOCX** identique au document original, seules les valeurs anonymisées changent

Ce README sera complété au fur et à mesure de l'avancement du projet.
