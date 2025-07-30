import uuid
import pickle
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from docx import Document
import io
import logging
import threading
import time

from models import Entity, AuditLog, RGPD_CONFIG

logger = logging.getLogger(__name__)

class SessionManager:
    """
    🗄️ Gestionnaire de sessions optimisé pour Vercel
    
    ✅ Stockage en mémoire uniquement (pas Redis)
    ✅ Auto-nettoyage des sessions expirées
    ✅ Conformité RGPD stricte (suppression immédiate)
    ✅ Thread-safe pour environnement serverless
    """
    
    def __init__(self):
        # Stockage en mémoire (thread-safe)
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        
        # Configuration RGPD
        self.session_expire_minutes = RGPD_CONFIG["session_max_duration_minutes"]
        self.auto_deletion = RGPD_CONFIG["auto_deletion"]
        
        # Démarrer le nettoyage automatique
        self._start_cleanup_thread()
        
        logger.info("✅ SessionManager initialisé (mémoire uniquement, RGPD strict)")
    
    def create_session(self, document: Document, original_text: str, 
                      entities: List[Entity], filename: str) -> str:
        """
        🆕 Crée une nouvelle session temporaire en mémoire
        
        Conformité RGPD :
        - Durée de vie limitée (15 minutes)
        - Suppression automatique garantie
        - Aucune persistance sur disque
        """
        session_id = str(uuid.uuid4())
        
        # Sérialiser le document DOCX en bytes
        doc_stream = io.BytesIO()
        document.save(doc_stream)
        doc_bytes = doc_stream.getvalue()
        doc_stream.close()
        
        # Préparer les données de session
        now = datetime.now()
        expires_at = now + timedelta(minutes=self.session_expire_minutes)
        
        session_data = {
            'session_id': session_id,
            'filename': filename,
            'original_text': original_text,
            'entities': [entity.__dict__ if hasattr(entity, '__dict__') else entity for entity in entities],
            'document_bytes': doc_bytes,
            'created_at': now.isoformat(),
            'expires_at': expires_at.isoformat(),
            'accessed_at': now.isoformat(),
            'rgpd_compliant': True,
            'processing_location': 'vercel_serverless'
        }
        
        # Stockage thread-safe
        with self._lock:
            self._sessions[session_id] = session_data
        
        logger.info(f"✅ Session créée: {session_id} (expire: {expires_at.strftime('%H:%M:%S')})")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        📖 Récupère les données d'une session avec vérification d'expiration
        """
        with self._lock:
            session_data = self._sessions.get(session_id)
            
            if not session_data:
                logger.warning(f"❌ Session introuvable: {session_id}")
                return None
            
            # Vérifier l'expiration
            expires_at = datetime.fromisoformat(session_data['expires_at'])
            if datetime.now() > expires_at:
                logger.info(f"⏰ Session expirée: {session_id}")
                # Suppression immédiate (conformité RGPD)
                del self._sessions[session_id]
                return None
            
            # Mettre à jour le dernier accès
            session_data['accessed_at'] = datetime.now().isoformat()
            
            logger.debug(f"✅ Session accédée: {session_id}")
            return session_data
    
    def update_session_entities(self, session_id: str, entities: List[Entity]) -> bool:
        """
        🔄 Met à jour les entités d'une session
        """
        with self._lock:
            session_data = self._sessions.get(session_id)
            if not session_data:
                logger.warning(f"❌ Session introuvable pour mise à jour: {session_id}")
                return False
            
            # Vérifier l'expiration
            expires_at = datetime.fromisoformat(session_data['expires_at'])
            if datetime.now() > expires_at:
                logger.info(f"⏰ Session expirée lors de la mise à jour: {session_id}")
                del self._sessions[session_id]
                return False
            
            # Mettre à jour les entités
            session_data['entities'] = [entity.__dict__ if hasattr(entity, '__dict__') else entity for entity in entities]
            session_data['updated_at'] = datetime.now().isoformat()
            session_data['accessed_at'] = datetime.now().isoformat()
            
            logger.info(f"✅ Entités mises à jour: {session_id} ({len(entities)} entités)")
            return True
    
    def get_document_from_session(self, session_id: str) -> Optional[Document]:
        """
        📄 Récupère le document DOCX d'une session
        """
        session_data = self.get_session(session_id)
        if not session_data:
            return None
        
        try:
            doc_bytes = session_data.get('document_bytes')
            if doc_bytes:
                doc_stream = io.BytesIO(doc_bytes)
                document = Document(doc_stream)
                logger.debug(f"✅ Document récupéré: {session_id}")
                return document
        except Exception as e:
            logger.error(f"❌ Erreur récupération document {session_id}: {e}")
        
        return None
    
    def delete_session(self, session_id: str) -> bool:
        """
        🗑️ Supprime une session (conformité RGPD)
        
        Suppression immédiate et complète des données
        """
        with self._lock:
            if session_id in self._sessions:
                # Récupérer les métadonnées avant suppression
                session_data = self._sessions[session_id]
                filename = session_data.get('filename', 'unknown')
                
                # Suppression complète
                del self._sessions[session_id]
                
                logger.info(f"🗑️ Session supprimée (RGPD): {session_id} - {filename}")
                return True
            else:
                logger.warning(f"❌ Session déjà supprimée: {session_id}")
                return False
    
    def cleanup_expired_sessions(self) -> int:
        """
        🧹 Nettoie les sessions expirées (tâche de maintenance automatique)
        
        Conformité RGPD : suppression automatique après expiration
        """
        current_time = datetime.now()
        expired_sessions = []
        
        with self._lock:
            for session_id, session_data in list(self._sessions.items()):
                try:
                    expires_at = datetime.fromisoformat(session_data['expires_at'])
                    if current_time > expires_at:
                        expired_sessions.append(session_id)
                except Exception as e:
                    logger.error(f"❌ Erreur vérification expiration {session_id}: {e}")
                    expired_sessions.append(session_id)  # Supprimer par sécurité
            
            # Supprimer toutes les sessions expirées
            for session_id in expired_sessions:
                if session_id in self._sessions:
                    del self._sessions[session_id]
        
        if expired_sessions:
            logger.info(f"🧹 {len(expired_sessions)} sessions expirées supprimées (RGPD)")
        
        return len(expired_sessions)
    
    def generate_audit_log(self, session_id: str, replacements: Dict[str, str]) -> Optional[AuditLog]:
        """
        📝 Génère un log d'audit RGPD pour traçabilité
        """
        session_data = self.get_session(session_id)
        if not session_data:
            logger.warning(f"❌ Session introuvable pour audit: {session_id}")
            return None
        
        try:
            # Analyser les types d'entités remplacées
            entities_data = session_data.get('entities', [])
            entities_dict = {}
            
            for entity_data in entities_data:
                if isinstance(entity_data, dict):
                    text = entity_data.get('text', '')
                    entities_dict[text] = entity_data
                elif hasattr(entity_data, 'text'):
                    entities_dict[entity_data.text] = entity_data
            
            # Créer le résumé des remplacements
            replacement_summary = []
            for original, replacement in replacements.items():
                entity_info = entities_dict.get(original, {})
                
                if isinstance(entity_info, dict):
                    entity_type = entity_info.get('type', 'UNKNOWN')
                    confidence = entity_info.get('confidence', 0.0)
                    source = entity_info.get('source', 'unknown')
                else:
                    entity_type = getattr(entity_info, 'type', 'UNKNOWN')
                    confidence = getattr(entity_info, 'confidence', 0.0)
                    source = getattr(entity_info, 'source', 'unknown')
                
                replacement_summary.append({
                    "type": entity_type,
                    "method": f"{source}_validated_replacement",
                    "original_length": len(original),
                    "replacement": replacement,
                    "confidence": confidence,
                    "processing_mode": "regex" if source == "regex" else "ner_distilcamembert"
                })
            
            # Créer le log d'audit
            audit_log = AuditLog(
                document=session_data['filename'],
                timestamp=datetime.now().isoformat(),
                entities_anonymized=len(replacements),
                replacement_summary=replacement_summary
            )
            
            logger.info(f"📝 Log d'audit généré: {session_id} - {len(replacements)} entités")
            return audit_log
            
        except Exception as e:
            logger.error(f"❌ Erreur génération audit log {session_id}: {e}")
            return None
    
    def get_session_stats(self) -> Dict[str, Any]:
        """
        📊 Retourne les statistiques des sessions actives
        """
        with self._lock:
            active_sessions = len(self._sessions)
            total_entities = 0
            
            # Calculer les statistiques
            for session_data in self._sessions.values():
                entities = session_data.get('entities', [])
                total_entities += len(entities)
            
            # Statistiques par source de détection
            source_stats = {'regex': 0, 'ner': 0, 'manual': 0}
            type_stats = {}
            
            for session_data in self._sessions.values():
                entities = session_data.get('entities', [])
                for entity_data in entities:
                    if isinstance(entity_data, dict):
                        source = entity_data.get('source', 'unknown')
                        entity_type = entity_data.get('type', 'UNKNOWN')
                    else:
                        source = getattr(entity_data, 'source', 'unknown')
                        entity_type = getattr(entity_data, 'type', 'UNKNOWN')
                    
                    # Stats par source
                    if source in source_stats:
                        source_stats[source] += 1
                    
                    # Stats par type
                    type_stats[entity_type] = type_stats.get(entity_type, 0) + 1
        
        return {
            "active_sessions": active_sessions,
            "total_entities": total_entities,
            "memory_usage": "in_memory_only",
            "session_backend": "memory",
            "rgpd_compliant": True,
            "auto_cleanup_enabled": True,
            "session_max_duration_minutes": self.session_expire_minutes,
            "detection_sources": source_stats,
            "entity_types_distribution": type_stats
        }
    
    def _start_cleanup_thread(self):
        """
        🧹 Démarre le thread de nettoyage automatique
        
        Nettoie les sessions expirées toutes les 5 minutes
        """
        def cleanup_worker():
            while True:
                try:
                    self.cleanup_expired_sessions()
                    time.sleep(300)  # 5 minutes
                except Exception as e:
                    logger.error(f"❌ Erreur thread cleanup: {e}")
                    time.sleep(60)  # Retry après 1 minute en cas d'erreur
        
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        logger.info("🧹 Thread de nettoyage automatique démarré (toutes les 5 minutes)")
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """
        📊 Retourne l'utilisation mémoire des sessions
        """
        with self._lock:
            total_sessions = len(self._sessions)
            total_documents_size = 0
            total_text_size = 0
            total_entities = 0
            
            for session_data in self._sessions.values():
                # Taille des documents
                doc_bytes = session_data.get('document_bytes', b'')
                total_documents_size += len(doc_bytes)
                
                # Taille du texte
                original_text = session_data.get('original_text', '')
                total_text_size += len(original_text.encode('utf-8'))
                
                # Nombre d'entités
                entities = session_data.get('entities', [])
                total_entities += len(entities)
            
            return {
                "total_sessions": total_sessions,
                "total_documents_size_mb": round(total_documents_size / (1024 * 1024), 2),
                "total_text_size_kb": round(total_text_size / 1024, 2),
                "total_entities": total_entities,
                "average_entities_per_session": round(total_entities / max(total_sessions, 1), 1),
                "storage_backend": "memory_only",
                "rgpd_retention": "0_minutes"
            }
    
    def force_cleanup_all(self):
        """
        🚨 Force la suppression de toutes les sessions (urgence RGPD)
        """
        with self._lock:
            session_count = len(self._sessions)
            self._sessions.clear()
            logger.warning(f"🚨 NETTOYAGE FORCÉ: {session_count} sessions supprimées")
        
        return session_count

# Instance globale pour l'application
session_manager = SessionManager()
            