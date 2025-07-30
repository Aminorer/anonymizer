from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
import io
import json
import logging
from datetime import datetime
import uuid

from analyzer import hybrid_analyzer, Entity
from processor import DocumentProcessor
from session import SessionManager
from models import (
    AnalyzeResponse, EntityStats, CustomEntity, 
    ENTITY_TYPES, EntityTypeEnum
)

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration pour Vercel
app = FastAPI(
    title="Anonymiseur Juridique RGPD - Vercel",
    description="Application d'anonymisation RGPD avec séparation stricte REGEX/NER",
    version="2.0.0",
    docs_url="/api/docs"
)

# CORS pour Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vercel gérera les origines
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Instances globales (optimisées pour Vercel)
document_processor = DocumentProcessor()
session_manager = SessionManager()

# Configuration Vercel
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
SUPPORTED_FILE_TYPES = [".pdf", ".docx"]

@app.get("/api/health")
async def health_check():
    """Point de santé pour Vercel"""
    return {
        "status": "healthy",
        "service": "Anonymiseur Juridique RGPD",
        "version": "2.0.0",
        "architecture": "Vercel + DistilCamemBERT",
        "rgpd_compliant": True
    }

@app.post("/api/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    mode: str = Form("standard")
) -> AnalyzeResponse:
    """
    🎯 Analyse un document avec séparation stricte REGEX/NER
    
    MODE STANDARD (2-5s):
    - REGEX uniquement sur données structurées (téléphone, SIRET, email, adresse)
    - AUCUNE détection de noms/organisations
    
    MODE APPROFONDI (5-15s):  
    - REGEX pour données structurées + NER DistilCamemBERT pour noms/organisations
    """
    try:
        # Validation du fichier
        if not file.filename:
            raise HTTPException(status_code=400, detail="Nom de fichier manquant")
        
        file_extension = f".{file.filename.split('.')[-1].lower()}"
        if file_extension not in SUPPORTED_FILE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"Format non supporté. Formats acceptés: {', '.join(SUPPORTED_FILE_TYPES)}"
            )
        
        # Validation de la taille
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"Fichier trop volumineux. Taille maximum: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Validation du mode
        if mode not in ["standard", "approfondi"]:
            mode = "standard"
        
        logger.info(f"🚀 ANALYSE {mode.upper()} - Fichier: {file.filename}")
        
        # 1. Traitement du fichier (PDF→DOCX ou DOCX direct)
        try:
            processed_document, extracted_text = document_processor.process_uploaded_file(
                file_content, file.filename
            )
            logger.info(f"✅ Document traité: {len(extracted_text)} caractères extraits")
        except Exception as e:
            logger.error(f"Erreur traitement document: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur traitement document: {str(e)}")
        
        # 2. Analyse des entités avec séparation stricte REGEX/NER
        try:
            entities = await hybrid_analyzer.analyze(extracted_text, mode)
            logger.info(f"✅ Analyse terminée: {len(entities)} entités détectées")
        except Exception as e:
            logger.error(f"Erreur analyse NLP: {e}")
            # Mode dégradé : continuer avec liste vide
            entities = []
            logger.warning("Mode dégradé: analyse sans entités")
        
        # 3. Génération des statistiques
        try:
            stats = _generate_entity_stats(entities)
            logger.info(f"✅ Statistiques générées: {stats.total_entities} entités")
        except Exception as e:
            logger.error(f"Erreur statistiques: {e}")
            stats = EntityStats(
                total_entities=len(entities),
                by_type={},
                selected_count=len(entities)
            )
        
        # 4. Session en mémoire (pas Redis)
        try:
            session_id = session_manager.create_session(
                processed_document, extracted_text, entities, file.filename
            )
            logger.info(f"✅ Session créée: {session_id}")
        except Exception as e:
            logger.error(f"Erreur création session: {e}")
            raise HTTPException(status_code=500, detail="Erreur création session")
        
        # 5. Préparation de la réponse avec sélection par défaut
        entity_responses = []
        for i, entity in enumerate(entities):
            try:
                # Règles de sélection par défaut selon le type
                default_selected = True
                if entity.type == 'REFERENCE_JURIDIQUE':
                    default_selected = False  # Références décochées par défaut
                
                entity_response = {
                    "id": entity.id,
                    "text": entity.text,
                    "type": entity.type,
                    "start": entity.start,
                    "end": entity.end,
                    "occurrences": entity.occurrences,
                    "confidence": entity.confidence,
                    "selected": default_selected,
                    "replacement": entity.replacement,
                    "source": entity.source
                }
                entity_responses.append(entity_response)
                
            except Exception as e:
                logger.error(f"Erreur préparation entité {i}: {e}")
                continue
        
        # Aperçu du texte (limité pour sécurité)
        text_preview = extracted_text[:2000] + "..." if len(extracted_text) > 2000 else extracted_text
        
        logger.info(f"🎯 ANALYSE RÉUSSIE: {file.filename} - {len(entity_responses)} entités prêtes")
        
        return AnalyzeResponse(
            success=True,
            session_id=session_id,
            filename=file.filename,
            text_preview=text_preview,
            entities=entity_responses,
            stats=stats
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🚨 ERREUR CRITIQUE ANALYSE: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Erreur interne : {str(e)[:200]}"
        )

@app.post("/api/add-entity")
async def add_custom_entity(
    session_id: str = Form(...),
    text: str = Form(...),
    entity_type: str = Form(...),
    replacement: str = Form(...)
):
    """
    ➕ Ajoute une entité personnalisée à la session
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session introuvable ou expirée")
        
        # Validation du type d'entité
        try:
            entity_type_enum = EntityTypeEnum(entity_type)
        except ValueError:
            logger.warning(f"Type d'entité invalide: {entity_type}")
            entity_type_enum = EntityTypeEnum.PERSONNE
        
        # Création de la nouvelle entité
        text_position = session_data['original_text'].find(text)
        if text_position == -1:
            text_position = 0
        
        new_entity = Entity(
            id=f"custom_{int(datetime.now().timestamp())}",
            text=text,
            type=entity_type,
            start=text_position,
            end=text_position + len(text),
            confidence=1.0,
            source='manual',
            replacement=replacement,
            occurrences=session_data['original_text'].count(text)
        )
        
        # Mise à jour de la session
        current_entities = session_data.get('entities', [])
        
        # Vérification des doublons
        for existing_entity in current_entities:
            if existing_entity.text.lower() == text.lower():
                raise HTTPException(status_code=400, detail="Cette entité existe déjà")
        
        current_entities.append(new_entity)
        session_manager.update_session_entities(session_id, current_entities)
        
        logger.info(f"✅ Entité manuelle ajoutée: '{text}' -> '{replacement}'")
        
        return {
            "success": True,
            "entity": {
                "id": new_entity.id,
                "text": new_entity.text,
                "type": new_entity.type,
                "replacement": new_entity.replacement,
                "occurrences": new_entity.occurrences,
                "confidence": new_entity.confidence,
                "source": new_entity.source
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🚨 ERREUR AJOUT ENTITÉ: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@app.post("/api/generate")
async def generate_anonymized_document(
    session_id: str = Form(...),
    selected_entities: str = Form(...)
):
    """
    📄 Génère le document DOCX anonymisé avec conformité RGPD
    """
    try:
        # Parsing des entités sélectionnées
        try:
            entities_data = json.loads(selected_entities)
            if not isinstance(entities_data, list):
                raise ValueError("Format de données invalide")
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Erreur parsing JSON entités: {e}")
            raise HTTPException(status_code=400, detail="Format JSON invalide pour les entités")
        
        # Récupération de la session
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session introuvable ou expirée")
        
        # Récupération du document original
        document = session_manager.get_document_from_session(session_id)
        if not document:
            raise HTTPException(status_code=500, detail="Document introuvable dans la session")
        
        # Création du mapping de remplacement
        replacements = {}
        for entity_data in entities_data:
            if isinstance(entity_data, dict) and entity_data.get("selected", False):
                original_text = str(entity_data.get("text", "")).strip()
                replacement_text = str(entity_data.get("replacement", "")).strip()
                if original_text and replacement_text:
                    replacements[original_text] = replacement_text
        
        if not replacements:
            raise HTTPException(status_code=400, detail="Aucune entité sélectionnée pour l'anonymisation")
        
        logger.info(f"🚀 Génération document: {len(replacements)} remplacements")
        
        # Application de l'anonymisation
        try:
            anonymized_docx_bytes = document_processor.apply_global_replacements(document, replacements)
        except Exception as e:
            logger.error(f"Erreur anonymisation: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors de l'anonymisation")
        
        # Générer le log d'audit RGPD
        audit_log = session_manager.generate_audit_log(session_id, replacements)
        
        # Nettoyage de la session (conformité RGPD)
        session_manager.delete_session(session_id)
        
        # Préparation du nom de fichier
        original_filename = session_data.get('filename', 'document.docx')
        filename_parts = original_filename.split('.')
        filename_without_ext = '.'.join(filename_parts[:-1]) if len(filename_parts) > 1 else original_filename
        anonymized_filename = f"anonymized_{filename_without_ext}.docx"
        
        logger.info(f"✅ Document anonymisé généré: {anonymized_filename}")
        
        # Headers RGPD
        headers = {
            "Content-Disposition": f"attachment; filename={anonymized_filename}",
            "X-RGPD-Compliant": "true",
            "X-Processing-Location": "local_vercel",
            "X-Data-Retention": "0_minutes"
        }
        
        if audit_log:
            headers["X-Audit-Summary"] = f"{audit_log.entities_anonymized}_entities_processed"
        
        return StreamingResponse(
            io.BytesIO(anonymized_docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🚨 ERREUR GÉNÉRATION: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du document")

@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    """
    ℹ️ Récupère les informations d'une session
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session introuvable ou expirée")
        
        return {
            "success": True,
            "session_id": session_id,
            "filename": session_data.get('filename', 'unknown'),
            "created_at": session_data.get('created_at', ''),
            "expires_at": session_data.get('expires_at', ''),
            "entities_count": len(session_data.get('entities', [])),
            "text_length": len(session_data.get('original_text', ''))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🚨 ERREUR SESSION INFO: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@app.get("/api/stats")
async def get_application_stats():
    """
    📊 Retourne les statistiques de l'application
    """
    try:
        session_stats = session_manager.get_session_stats()
        
        return {
            "success": True,
            "application": {
                "name": "Anonymiseur Juridique RGPD",
                "version": "2.0.0",
                "architecture": "Vercel + DistilCamemBERT",
                "rgpd_compliant": True,
                "supported_formats": SUPPORTED_FILE_TYPES,
                "processing_modes": ["standard", "approfondi"],
                "separation_strategy": "REGEX_structured_data + NER_complex_entities"
            },
            "sessions": session_stats,
            "entity_types": {
                "total_types": len(ENTITY_TYPES),
                "structured_types": ["TELEPHONE", "EMAIL", "SIRET", "SECU_SOCIALE", "ADRESSE", "REFERENCE_JURIDIQUE"],
                "complex_types": ["PERSONNE", "ORGANISATION"],
                "model_ner": "cmarkea/distilcamembert-base-ner"
            },
            "performance": {
                "mode_standard": "2-5s (REGEX only)",
                "mode_approfondi": "5-15s (REGEX + NER)",
                "max_file_size": f"{MAX_FILE_SIZE // (1024*1024)}MB",
                "session_duration": "15 minutes",
                "rgpd_retention": "0 minutes (immediate deletion)"
            }
        }
    
    except Exception as e:
        logger.error(f"🚨 ERREUR STATS: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

def _generate_entity_stats(entities: List[Entity]) -> EntityStats:
    """
    📈 Génère les statistiques des entités de manière sécurisée
    """
    try:
        if not entities:
            return EntityStats(
                total_entities=0,
                by_type={},
                selected_count=0
            )
        
        by_type = {}
        selected_count = 0
        
        for entity in entities:
            # Compter par type
            entity_type = entity.type
            by_type[entity_type] = by_type.get(entity_type, 0) + 1
            
            # Compter les sélectionnées (par défaut True sauf références juridiques)
            if entity.type != 'REFERENCE_JURIDIQUE':
                selected_count += 1
        
        return EntityStats(
            total_entities=len(entities),
            by_type=by_type,
            selected_count=selected_count
        )
        
    except Exception as e:
        logger.error(f"Erreur génération stats: {e}")
        return EntityStats(
            total_entities=len(entities) if entities else 0,
            by_type={"UNKNOWN": len(entities) if entities else 0},
            selected_count=len(entities) if entities else 0
        )

# Point d'entrée pour Vercel
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)