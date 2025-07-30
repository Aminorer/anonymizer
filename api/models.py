from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid
from datetime import datetime

class EntityTypeEnum(str, Enum):
    """
    🏷️ Types d'entités avec séparation stricte REGEX/NER
    
    ✅ REGEX (données structurées) :
    - TELEPHONE, EMAIL, SIRET, SECU_SOCIALE, ADRESSE, REFERENCE_JURIDIQUE
    
    ✅ NER (entités complexes) :
    - PERSONNE, ORGANISATION
    """
    PERSONNE = "PERSONNE"
    ORGANISATION = "ORGANISATION"
    TELEPHONE = "TELEPHONE"
    EMAIL = "EMAIL"
    SECU_SOCIALE = "SECU_SOCIALE"
    SIRET = "SIRET"
    ADRESSE = "ADRESSE"
    REFERENCE_JURIDIQUE = "REFERENCE_JURIDIQUE"

class Entity(BaseModel):
    """
    🎯 Entité détectée avec toutes les métadonnées nécessaires
    """
    id: str
    text: str
    type: str
    start: int
    end: int
    confidence: float
    source: str  # 'regex' ou 'ner'
    selected: bool = True
    replacement: str = ""
    occurrences: int = 1
    
    def __init__(self, **data):
        if 'id' not in data or not data['id']:
            data['id'] = str(uuid.uuid4())
        super().__init__(**data)

class CustomEntity(BaseModel):
    """
    ➕ Entité personnalisée ajoutée manuellement
    """
    text: str
    entity_type: EntityTypeEnum
    replacement: str

class EntityStats(BaseModel):
    """
    📊 Statistiques des entités détectées
    """
    total_entities: int
    by_type: Dict[str, int]
    selected_count: int

class AnalyzeResponse(BaseModel):
    """
    📋 Réponse de l'analyse de document
    """
    success: bool
    session_id: str
    filename: str
    text_preview: str
    entities: List[Dict[str, Any]]  # Format flexible pour la réponse API
    stats: EntityStats

class AuditLog(BaseModel):
    """
    📝 Log d'audit RGPD pour traçabilité
    """
    document: str
    timestamp: str
    processing_tool: str = "Anonymiseur Juridique RGPD v2.0 (Vercel + DistilCamemBERT)"
    processing_location: str = "vercel_serverless"
    rgpd_compliant: bool = True
    entities_anonymized: int
    replacement_summary: List[Dict[str, Any]]
    architecture: str = "REGEX_structured + NER_complex"

# Configuration des types d'entités avec séparation REGEX/NER
STRUCTURED_ENTITY_TYPES = {
    """
    🔧 Types d'entités pour traitement REGEX uniquement
    Données structurées simples avec patterns fiables
    """
    'TELEPHONE': {
        'patterns': [
            r'\b0[1-9](?:[\s.-]?\d{2}){4}\b',
            r'\+33\s?[1-9](?:[\s.-]?\d{2}){4}\b'
        ],
        'default_replacement': '0X XX XX XX XX',
        'color': '#f59e0b',
        'icon': '📞',
        'validation': 'phone_french'
    },
    'EMAIL': {
        'patterns': [
            r'\b[A-Za-z0-9]([A-Za-z0-9._%-]*[A-Za-z0-9])?@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b'
        ],
        'default_replacement': 'contact@anonyme.fr',
        'color': '#10b981',
        'icon': '📧',
        'validation': 'email_strict'
    },
    'SECU_SOCIALE': {
        'patterns': [
            r'\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b'
        ],
        'default_replacement': 'X XX XX XX XXX XXX XX',
        'color': '#ef4444',
        'icon': '🆔',
        'validation': 'social_security_french'
    },
    'SIRET': {
        'patterns': [
            r'\b(?:SIRET\s*:?\s*)?(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5})\b',
            r'\b(?:SIREN\s*:?\s*)?(\d{3}[\s\.]?\d{3}[\s\.]?\d{3})\b',
            r'RCS\s+[A-Z][a-zA-Z-\s]+\s+(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}(?:[\s\.]?\d{5})?)',
            r'(?:n°\s*TVA\s*:?\s*|TVA\s+intra\w*\s*:?\s*)?FR\s*(\d{2}\s?\d{9})',
            r'(?:APE|NAF)\s*:?\s*(\d{4}[A-Z])'
        ],
        'default_replacement': 'SIRET_MASQUE',
        'color': '#f97316',
        'icon': '🏭',
        'validation': 'siret_siren_checksum',
        'replacement_options': [
            'SIRET_MASQUE',
            'SIREN_MASQUE', 
            'XXX XXX XXX',
            'ENTREPRISE_A',
            'NUMERO_REGISTRE'
        ]
    },
    'ADRESSE': {
        'patterns': [
            r'\d+(?:\s+(?:bis|ter|quater))?\s+(?:rue|avenue|boulevard|place|impasse|allée|square|passage|chemin|route|cours|quai)\s+[^,\n.]{5,}(?:\s+\d{5}\s+[A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ][a-zàáâäçéèêëïîôöùúûüñ-\s]+)?',
            r'\b\d{5}\s+[A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ][A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ\s-]{2,}\b'
        ],
        'default_replacement': 'ADRESSE_MASQUEE',
        'color': '#8b5cf6',
        'icon': '🏠',
        'validation': 'address_french'
    },
    'REFERENCE_JURIDIQUE': {
        'patterns': [
            r'N°\s?RG\s?\d+[\/\-\s]*\d*',
            r'(?:Dossier|Affaire)\s+n°\s?\d+[\/\-\s]*\d*',
            r'Article\s+\d+(?:\s+du\s+Code\s+[a-zA-ZÀ-ÿ\s]+)?',
            r'Arrêt\s+n°\s?\d+[\/\-\s]*\d*',
            r'Ordonnance\s+n°\s?\d+[\/\-\s]*\d*',
            r'Jugement\s+n°\s?\d+[\/\-\s]*\d*'
        ],
        'default_replacement': 'REFERENCE_MASQUEE',
        'color': '#6b7280',
        'icon': '⚖️',
        'validation': 'legal_reference',
        'default_selected': False  # Décochées par défaut
    }
}

NER_ENTITY_TYPES = {
    """
    🧠 Types d'entités pour traitement NER uniquement
    Entités complexes nécessitant compréhension contextuelle
    """
    'PERSONNE': {
        'model': 'cmarkea/distilcamembert-base-ner',
        'ner_labels': ['PER', 'PERSON'],
        'default_replacement': 'PERSONNE_MASQUEE',
        'color': '#3b82f6',
        'icon': '👤',
        'validation': 'person_name_french'
    },
    'ORGANISATION': {
        'model': 'cmarkea/distilcamembert-base-ner',
        'ner_labels': ['ORG'],
        'default_replacement': 'ORGANISATION_MASQUEE',
        'color': '#06b6d4',
        'icon': '🏢',
        'validation': 'organization_name_french'
    }
}

# Combinaison pour compatibilité (séparation claire maintenue)
ENTITY_TYPES = {**STRUCTURED_ENTITY_TYPES, **NER_ENTITY_TYPES}

# Configuration RGPD stricte pour Vercel
RGPD_CONFIG = {
    "data_processing": "local_serverless_only",
    "external_apis": False,
    "data_retention_minutes": 0,  # Suppression immédiate
    "audit_logging": True,
    "user_consent": "explicit",
    "model_source": "huggingface_local_cache",
    "session_max_duration_minutes": 15,
    "auto_deletion": True,
    "encryption_in_transit": True,
    "compliance_level": "RGPD_strict"
}

# Configuration de performance pour Vercel
PERFORMANCE_CONFIG = {
    "max_file_size_mb": 50,
    "max_processing_time_seconds": 30,  # Limite Vercel
    "lazy_model_loading": True,
    "chunk_size_ner": 400,  # Tokens pour DistilCamemBERT
    "session_memory_only": True,  # Pas de persistance
    "regex_cache_enabled": True,
    "model_device": "cpu",  # Vercel CPU only
    "max_entities_per_document": 1000,
    "timeout_per_mode": {
        "standard": 5,    # 5s max pour mode standard
        "approfondi": 15  # 15s max pour mode approfondi
    }
}

# Modèle DistilCamemBERT configuration
DISTILCAMEMBERT_CONFIG = {
    "model_name": "cmarkea/distilcamembert-base-ner",
    "model_size_mb": 250,
    "languages": ["french"],
    "entity_types": ["PER", "ORG"],
    "aggregation_strategy": "simple",
    "device": -1,  # CPU
    "return_all_scores": False,
    "cache_dir": None,  # Vercel gérera le cache
    "tokenizer_config": {
        "max_length": 512,
        "truncation": True,
        "padding": True
    }
}

class VercelConfig:
    """
    ⚙️ Configuration spécifique pour déploiement Vercel
    """
    # Limites Vercel
    MAX_EXECUTION_TIME = 30  # secondes
    MAX_MEMORY_MB = 512
    
    # Chemins
    API_BASE_PATH = "/api"
    STATIC_FILES_PATH = "/dist"
    
    # CORS
    ALLOWED_ORIGINS = ["*"]  # Vercel gérera les origines
    
    # Logging
    LOG_LEVEL = "INFO"
    
    # Sessions
    SESSION_BACKEND = "memory"  # Pas Redis sur Vercel
    SESSION_EXPIRE_MINUTES = 15
    
    # Modèles
    MODEL_CACHE_STRATEGY = "lazy_loading"
    MODEL_BACKEND = "transformers_cpu"
    
    # Monitoring
    HEALTH_CHECK_ENDPOINT = "/api/health"
    METRICS_ENABLED = True
    
    @classmethod
    def is_vercel_environment(cls) -> bool:
        """Détecte si on est dans l'environnement Vercel"""
        import os
        return os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None