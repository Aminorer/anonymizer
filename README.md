# Projet Anonymiseur Juridique

Cette application FastAPI permet d'anonymiser des documents juridiques (PDF ou DOCX) en détectant des entités sensibles puis en générant un DOCX de sortie identique au document original à l'exception des valeurs remplacées.

## Fonctionnalités principales
- **Upload unique** d'un document jusqu'à 25Mo avec choix du mode d'analyse
- **Mode Regex** : détection rapide de huit entités (LOC, ADDRESS, EMAIL, PHONE, DATE, IBAN, SIREN, SIRET)
- **Mode IA** : détection étendue via spaCy NER combinée aux regex
- **Interface interactive** : visualisation du texte avec surlignage, tableau d'entités éditable et aperçu anonymisé en temps réel
- **Export DOCX** : téléchargement du document anonymisé en conservant la mise en forme

## Structure du projet
```
backend/
  main.py           # API FastAPI et gestion des sessions
  anonymizer.py     # Analyse regex/NER et anonymisation DOCX
  requirements.txt  # Dépendances backend
  templates/        # Pages HTML
  static/           # Fichiers statiques (CSS)
```

## Installation
```bash
pip install -r backend/requirements.txt
python -m spacy download fr_core_news_sm
```

## Lancer le serveur de développement
```bash
uvicorn backend.main:app --reload
```
Puis ouvrir [http://localhost:8000](http://localhost:8000).

## Limitations actuelles
- La préservation complète du format pour les tableaux, en-têtes ou images reste à améliorer
- Les règles d'anonymisation avancées et la page de progression sont simplifiées

Des contributions sont bienvenues pour étendre ces fonctionnalités.
