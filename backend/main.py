@app.post("/entities/{job_id}/bulk")
def bulk_entity_operation(job_id: str, operation: BulkOperation):
    """Effectuer une opération en lot sur les entités."""
    try:
        if operation.operation == "delete":
            # Supprimer plusieurs entités
            deleted_count = 0
            for entity_id in operation.entity_ids:
                try:
                    existing = entities_store.get_nested(job_id, entity_id)
                    if existing:
                        entities_store.delete_nested(job_id, entity_id)
                        deleted_count += 1
                except Exception as e:
                    logger.warning(f"Erreur lors de la suppression de l'entité {entity_id}: {e}")
            
            # Nettoyer les références dans les groupes
            job_groups = groups_store.get(job_id, {})
            for group in job_groups.values():
                original_count = len(group.get("entities", []))
                group["entities"] = [eid for eid in group.get("entities", []) if eid not in operation.entity_ids]
                if len(group["entities"]) != original_count:
                    group["updated_at"] = datetime.now().isoformat()
            groups_store.set(job_id, job_groups)
            
            logger.info(f"Suppression en lot: {deleted_count} entités pour job {job_id}")
            return {"status": "deleted", "count": deleted_count}
            
        elif operation.operation == "group":
            # Grouper plusieurs entités
            if not operation.data or "group_id" not in operation.data:
                raise HTTPException(status_code=400, detail="group_id requis pour l'opération de groupement")
            
            group_id = operation.data["group_id"]
            group = groups_store.get_nested(job_id, group_id)
            if not group:
                raise HTTPException(status_code=404, detail="Groupe introuvable")
            
            # Ajouter les entités au groupe
            current_entities = set(group.get("entities", []))
            for entity_id in operation.entity_ids:
                if entities_store.get_nested(job_id, entity_id):
                    current_entities.add(entity_id)
            
            group["entities"] = list(current_entities)
            group["updated_at"] = datetime.now().isoformat()
            groups_store.set_nested(job_id, group_id, group)
            
            # Mettre à jour les entités avec le group_id
            for entity_id in operation.entity_ids:
                entity = entities_store.get_nested(job_id, entity_id)
                if entity:
                    entity["group_id"] = group_id
                    entity["updated_at"] = datetime.now().isoformat()
                    entities_store.set_nested(job_id, entity_id, entity)
            
            logger.info(f"Groupement en lot: {len(operation.entity_ids)} entités dans groupe {group_id}")
            return {"status": "grouped", "group_id": group_id, "count": len(operation.entity_ids)}
            
        elif operation.operation == "update":
            # Mettre à jour plusieurs entités
            if not operation.data:
                raise HTTPException(status_code=400, detail="Données de mise à jour requises")
            
            updated_count = 0
            for entity_id in operation.entity_ids:
                entity = entities_store.get_nested(job_id, entity_id)
                if entity:
                    entity.update(operation.data)
                    entity["updated_at"] = datetime.now().isoformat()
                    entities_store.set_nested(job_id, entity_id, entity)
                    updated_count += 1
            
            logger.info(f"Mise à jour en lot: {updated_count} entités pour job {job_id}")
            return {"status": "updated", "count": updated_count}
            
        else:
            raise HTTPException(status_code=400, detail="Opération non supportée")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'opération en lot pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'opération en lot")

@app.post("/entities/{job_id}/search")
def search_entities(job_id: str, query: SearchQuery) -> List[EntityModel]:
    """Rechercher des entités selon des critères."""
    try:
        entities_data = entities_store.list(job_id)
        results = []
        
        for e in entities_data:
            try:
                entity = EntityModel.parse_obj(e)
                
                # Filtrer selon les critères
                if query.text and query.text.lower() not in entity.value.lower():
                    continue
                    
                if query.entity_type and entity.type != query.entity_type:
                    continue
                    
                if query.confidence_min is not None and (entity.confidence is None or entity.confidence < query.confidence_min):
                    continue
                    
                if query.confidence_max is not None and (entity.confidence is None or entity.confidence > query.confidence_max):
                    continue
                    
                if query.page is not None and entity.page != query.page:
                    continue
                    
                if query.group_id and entity.group_id != query.group_id:
                    continue
                
                results.append(entity)
                
            except Exception as parse_error:
                logger.warning(f"Erreur lors du parsing de l'entité {e}: {parse_error}")
                continue
                
        logger.info(f"Recherche d'entités: {len(results)} résultats pour job {job_id}")
        return results
        
    except Exception as e:
        logger.error(f"Erreur lors de la recherche d'entités pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la recherche")

# Routes de gestion des groupes

@app.get("/groups/{job_id}")
def list_groups(job_id: str) -> List[GroupModel]:
    """Retourner tous les groupes pour un job."""
    try:
        groups_data = groups_store.list(job_id)
        groups = []
        for g in groups_data:
            try:
                group = GroupModel.parse_obj(g)
                groups.append(group)
            except Exception as parse_error:
                logger.warning(f"Erreur lors du parsing du groupe {g}: {parse_error}")
                continue
        return groups
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des groupes pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des groupes")

@app.post("/groups/{job_id}")
def create_group(job_id: str, group: GroupModel) -> GroupModel:
    """Créer un nouveau groupe pour un job."""
    try:
        if not group.id:
            group.id = uuid4().hex
            
        group.created_at = datetime.now().isoformat()
        group.updated_at = group.created_at
        
        groups_store.set_nested(job_id, group.id, group.dict())
        logger.info(f"Groupe créé: {group.id} pour job {job_id}")
        return group
    except Exception as e:
        logger.error(f"Erreur lors de la création du groupe pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du groupe")

@app.put("/groups/{job_id}/{group_id}")
def update_group(job_id: str, group_id: str, group: GroupModel) -> GroupModel:
    """Mettre à jour les informations d'un groupe pour un job."""
    try:
        existing = groups_store.get_nested(job_id, group_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Groupe introuvable")
        
        group.id = group_id
        group.updated_at = datetime.now().isoformat()
        group.created_at = existing.get("created_at", group.updated_at)
        
        groups_store.set_nested(job_id, group_id, group.dict())
        
        # Mettre à jour les entités avec l'assignation de groupe
        job_entities = entities_store.get(job_id, {})
        for ent_id in group.entities:
            ent = job_entities.get(ent_id)
            if ent is not None:
                ent["group_id"] = group_id
                ent["updated_at"] = datetime.now().isoformat()
        entities_store.set(job_id, job_entities)
        
        logger.info(f"Groupe mis à jour: {group_id} pour job {job_id}")
        return group
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du groupe {group_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour du groupe")

@app.delete("/groups/{job_id}/{group_id}")
def delete_group(job_id: str, group_id: str):
    """Supprimer un groupe pour un job et nettoyer les assignations."""
    try:
        # S'assurer que le groupe existe
        existing = groups_store.get_nested(job_id, group_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Groupe introuvable")

        groups_store.delete_nested(job_id, group_id)
        
        # Nettoyer les assignations de groupe dans les entités
        job_entities = entities_store.get(job_id, {})
        for ent in job_entities.values():
            if ent.get("group_id") == group_id:
                ent["group_id"] = None
                ent["updated_at"] = datetime.now().isoformat()
        entities_store.set(job_id, job_entities)
        
        logger.info(f"Groupe supprimé: {group_id} pour job {job_id}")
        return {"status": "deleted", "group_id": group_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la suppression du groupe {group_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression du groupe")

@app.post("/groups/{job_id}/{group_id}/entities/{entity_id}")
def add_entity_to_group(job_id: str, group_id: str, entity_id: str) -> GroupModel:
    """Assigner une entité à un groupe pour un job."""
    try:
        group = groups_store.get_nested(job_id, group_id)
        entity = entities_store.get_nested(job_id, entity_id)
        
        if not group or not entity:
            raise HTTPException(status_code=404, detail="Groupe ou entité introuvable")
        
        # Ajouter l'entité au groupe si elle n'y est pas déjà
        if entity_id not in group.get("entities", []):
            group.setdefault("entities", []).append(entity_id)
            group["updated_at"] = datetime.now().isoformat()
            
        groups_store.set_nested(job_id, group_id, group)
        
        # Mettre à jour l'entité avec le group_id
        entity["group_id"] = group_id
        entity["updated_at"] = datetime.now().isoformat()
        entities_store.set_nested(job_id, entity_id, entity)
        
        logger.info(f"Entité {entity_id} assignée au groupe {group_id} pour job {job_id}")
        return GroupModel.parse_obj(group)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'assignation de l'entité {entity_id} au groupe {group_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'assignation de l'entité au groupe")

@app.delete("/groups/{job_id}/{group_id}/entities/{entity_id}")
def remove_entity_from_group(job_id: str, group_id: str, entity_id: str) -> GroupModel:
    """Retirer une entité d'un groupe."""
    try:
        group = groups_store.get_nested(job_id, group_id)
        entity = entities_store.get_nested(job_id, entity_id)
        
        if not group or not entity:
            raise HTTPException(status_code=404, detail="Groupe ou entité introuvable")
        
        # Retirer l'entité du groupe
        if entity_id in group.get("entities", []):
            group["entities"].remove(entity_id)
            group["updated_at"] = datetime.now().isoformat()
            
        groups_store.set_nested(job_id, group_id, group)
        
        # Mettre à jour l'entité
        entity["group_id"] = None
        entity["updated_at"] = datetime.now().isoformat()
        entities_store.set_nested(job_id, entity_id, entity)
        
        logger.info(f"Entité {entity_id} retirée du groupe {group_id} pour job {job_id}")
        return GroupModel.parse_obj(group)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du retrait de l'entité {entity_id} du groupe {group_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du retrait de l'entité du groupe")

# Routes utilitaires

@app.get("/semantic-search/{job_id}")
def semantic_search(job_id: str, q: str):
    """Retourner des mots similaires à la requête en utilisant une correspondance floue simple."""
    try:
        job = jobs_store.get(job_id)
        if not job or "result" not in job or "text" not in job["result"]:
            raise HTTPException(status_code=404, detail="Job ou texte introuvable")
        
        text = job["result"]["text"]
        words = set(text.split())
        matches = get_close_matches(q, list(words), n=10, cutoff=0.8)
        
        # Aussi chercher dans les valeurs d'entités
        entities_data = entities_store.list(job_id)
        entity_values = [e.get("value", "") for e in entities_data]
        entity_matches = get_close_matches(q, entity_values, n=5, cutoff=0.6)
        
        all_matches = list(set(matches + entity_matches))
        
        logger.info(f"Recherche sémantique pour '{q}': {len(all_matches)} résultats")
        return {"matches": all_matches, "query": q}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la recherche sémantique pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la recherche sémantique")

# Routes d'export

@app.post("/export/{job_id}")
async def export_job(job_id: str, opts: ExportOptions):
    """Appliquer les options d'export comme le filigrane et le rapport d'audit."""
    try:
        job = jobs_store.get(job_id)
        if not job or "result" not in job:
            raise HTTPException(status_code=404, detail="Job introuvable")
        
        result = job["result"]
        src_path = Path("backend") / result["original_url"].lstrip("/")
        
        if not src_path.exists():
            raise HTTPException(status_code=404, detail="Document source introuvable")
        
        data = src_path.read_bytes()
        
        # Reconstruire le mapping depuis le format dict
        mapping_data = result.get("mapping", [])
        mapping = []
        for m in mapping_data:
            try:
                mapping.append(RunInfo.from_dict(m))
            except Exception as e:
                logger.warning(f"Erreur lors de la reconstruction du mapping: {e}")
        
        # Charger les entités depuis le store (version la plus récente)
        stored_entities = entities_store.list(job_id)
        if stored_entities:
            entities = []
            for e in stored_entities:
                try:
                    entity = Entity(
                        type=e.get("type", "UNKNOWN"),
                        value=e.get("value", ""),
                        start=e.get("start", 0),
                        end=e.get("end", 0),
                        page=e.get("page"),
                        x=e.get("x"),
                        y=e.get("y"),
                        width=e.get("width"),
                        height=e.get("height"),
                    )
                    entities.append(entity)
                except Exception as entity_error:
                    logger.warning(f"Erreur lors de la reconstruction de l'entité: {entity_error}")
        else:
            # Fallback vers les entités du résultat
            entities = [Entity(**e) for e in result.get("entities", [])]
        
        # Traitement de l'export
        modified, report = regex_anonymizer.export_docx(
            data,
            mapping=mapping,
            entities=entities,
            watermark=opts.watermark,
            audit=opts.audit,
        )
        
        # Préparation des fichiers de sortie
        output_dir = Path("backend/static/exports")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        base_filename = Path(result['filename']).stem
        
        # Fichier principal
        out_filename = f"{timestamp}_{uuid4().hex}_{base_filename}.docx"
        out_path = output_dir / out_filename
        out_path.write_bytes(modified)
        
        response_data = {
            "download_url": f"/static/exports/{out_filename}",
            "filename": f"{base_filename}_anonymized.docx",
            "size": len(modified),
            "entities_count": len(entities),
            "export_time": datetime.now().isoformat()
        }
        
        # Rapport d'audit si demandé
        if report and opts.audit:
            audit_filename = f"{timestamp}_{uuid4().hex}_{base_filename}_audit.txt"
            audit_path = output_dir / audit_filename
            
            # Enrichir le rapport avec des informations supplémentaires
            enhanced_report = f"""RAPPORT D'AUDIT D'ANONYMISATION
=====================================

Document original: {result['filename']}
Date d'export: {datetime.now().strftime('%d/%m/%Y à %H:%M')}
Mode de traitement: {job.get('mode', 'unknown').upper()}
Temps de traitement: {result.get('processing_time', 0):.2f} secondes

STATISTIQUES
============
- Entités détectées: {len(entities)}
- Entités anonymisées: {len([e for e in entities if e.value])}
- Groupes créés: {len(groups_store.list(job_id))}

ENTITÉS ANONYMISÉES
==================
{report}

OPTIONS D'EXPORT
================
- Filigrane: {'Oui' if opts.watermark else 'Non'}
- Rapport d'audit: Oui
- Format: {opts.format.upper()}

Ce rapport certifie que le document a été traité selon les paramètres spécifiés.
"""
            
            audit_path.write_text(enhanced_report, encoding="utf-8")
            response_data["audit_url"] = f"/static/exports/{audit_filename}"
            response_data["audit_filename"] = f"{base_filename}_audit.txt"
        
        logger.info(f"Export terminé pour job {job_id}: {out_filename}")
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'export pour job {job_id}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'export du document")

# Routes d'administration

@app.post("/admin/clear-stuck-jobs")
def clear_stuck_jobs():
    """Nettoyer les jobs bloqués en état de traitement."""
    try:
        all_jobs = jobs_store.all()
        cleared = 0
        cutoff_time = datetime.now() - timedelta(minutes=30)
        
        for job_id, job in all_jobs.items():
            if job.get("status") == "processing":
                try:
                    created_at = job.get("created_at")
                    if created_at:
                        job_time = datetime.fromisoformat(created_at)
                        if job_time < cutoff_time:
                            jobs_store.set(job_id, {
                                **job,
                                "status": "error",
                                "message": "Job interrompu (nettoyage administratif)",
                                "updated_at": datetime.now().isoformat()
                            })
                            cleared += 1
                except Exception as e:
                    logger.warning(f"Erreur lors du nettoyage du job {job_id}: {e}")
                    
        logger.info(f"Nettoyage administratif: {cleared} jobs nettoyés")
        return {"message": f"{cleared} jobs nettoyés", "cutoff_minutes": 30}
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage des jobs: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du nettoyage des jobs")

@app.get("/admin/stats")
def get_admin_stats():
    """Obtenir des statistiques d'administration."""
    try:
        all_jobs = jobs_store.all()
        
        stats = {
            "total_jobs": len(all_jobs),
            "jobs_by_status": {},
            "jobs_by_mode": {},
            "total_entities": 0,
            "total_groups": 0,
            "oldest_job": None,
            "newest_job": None,
            "average_processing_time": 0
        }
        
        processing_times = []
        job_times = []
        
        for job_id, job in all_jobs.items():
            # Statistiques par statut
            status = job.get("status", "unknown")
            stats["jobs_by_status"][status] = stats["jobs_by_status"].get(status, 0) + 1
            
            # Statistiques par mode
            mode = job.get("mode", "unknown")
            stats["jobs_by_mode"][mode] = stats["jobs_by_mode"].get(mode, 0) + 1
            
            # Temps de traitement
            if "result" in job and "processing_time" in job["result"]:
                processing_times.append(job["result"]["processing_time"])
            
            # Temps de création
            if "created_at" in job:
                try:
                    job_time = datetime.fromisoformat(job["created_at"])
                    job_times.append(job_time)
                except:
                    pass
            
            # Compter les entités et groupes
            stats["total_entities"] += len(entities_store.list(job_id))
            stats["total_groups"] += len(groups_store.list(job_id))
        
        # Calculs des moyennes et extrêmes
        if processing_times:
            stats["average_processing_time"] = sum(processing_times) / len(processing_times)
        
        if job_times:
            stats["oldest_job"] = min(job_times).isoformat()
            stats["newest_job"] = max(job_times).isoformat()
        
        # Statistiques de fichiers
        upload_dir = Path("backend/static/uploads")
        export_dir = Path("backend/static/exports")
        
        stats["file_stats"] = {
            "uploads_count": len(list(upload_dir.glob("*"))) if upload_dir.exists() else 0,
            "exports_count": len(list(export_dir.glob("*"))) if export_dir.exists() else 0,
            "total_size_mb": 0
        }
        
        # Calculer la taille totale
        for directory in [upload_dir, export_dir]:
            if directory.exists():
                for file_path in directory.glob("*"):
                    if file_path.is_file():
                        stats["file_stats"]["total_size_mb"] += file_path.stat().st_size / (1024 * 1024)
        
        stats["file_stats"]["total_size_mb"] = round(stats["file_stats"]["total_size_mb"], 2)
        
        return stats
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des statistiques: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des statistiques")

@app.post("/admin/cleanup")
def manual_cleanup():
    """Déclencher un nettoyage manuel des fichiers et jobs anciens."""
    try:
        cleanup_old_files()
        cleanup_old_jobs()
        return {
            "message": "Nettoyage manuel terminé",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage manuel: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du nettoyage manuel")

# Routes de téléchargement direct

@app.get("/download/{file_type}/{job_id}")
def download_file(file_type: str, job_id: str):
    """Télécharger directement un fichier lié à un job."""
    try:
        if file_type not in ["original", "anonymized", "pdf"]:
            raise HTTPException(status_code=400, detail="Type de fichier invalide")
        
        job = jobs_store.get(job_id)
        if not job or "result" not in job:
            raise HTTPException(status_code=404, detail="Job introuvable")
        
        result = job["result"]
        
        if file_type == "original" and "original_url" in result:
            file_path = Path("backend") / result["original_url"].lstrip("/")
        elif file_type == "anonymized" and "anonymized_url" in result:
            file_path = Path("backend") / result["anonymized_url"].lstrip("/")
        elif file_type == "pdf" and "pdf_url" in result:
            file_path = Path("backend") / result["pdf_url"].lstrip("/")
        else:
            raise HTTPException(status_code=404, detail="Fichier non disponible")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Fichier introuvable sur le disque")
        
        # Déterminer le nom de fichier pour le téléchargement
        original_name = result.get("filename", "document")
        if file_type == "anonymized":
            name_parts = original_name.rsplit(".", 1)
            if len(name_parts) == 2:
                download_name = f"{name_parts[0]}_anonymized.{name_parts[1]}"
            else:
                download_name = f"{original_name}_anonymized"
        else:
            download_name = original_name
        
        return FileResponse(
            path=file_path,
            filename=download_name,
            media_type="application/octet-stream"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors du téléchargement pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du téléchargement")

# Événements de démarrage et d'arrêt

@app.on_event("startup")
async def startup_event():
    """Événements de démarrage de l'application."""
    logger.info("Démarrage de l'application d'anonymisation")
    
    # Créer les dossiers nécessaires
    for directory in [
        "backend/static/uploads",
        "backend/static/exports", 
        "backend/logs",
        "backend/data"
    ]:
        os.makedirs(directory, exist_ok=True)
    
    # Charger la configuration par défaut
    try:
        load_rules()
        load_presets()
        logger.info("Configuration chargée avec succès")
    except Exception as e:
        logger.warning(f"Erreur lors du chargement de la configuration: {e}")
    
    # Démarrer la tâche de nettoyage périodique
    asyncio.create_task(periodic_cleanup())
    logger.info("Tâche de nettoyage périodique démarrée")

@app.on_event("shutdown")
async def shutdown_event():
    """Événements d'arrêt de l'application."""
    logger.info("Arrêt de l'application d'anonymisation")
    
    # Nettoyer les jobs en cours
    try:
        all_jobs = jobs_store.all()
        for job_id, job in all_jobs.items():
            if job.get("status") == "processing":
                jobs_store.set(job_id, {
                    **job,
                    "status": "error",
                    "message": "Arrêt du serveur",
                    "updated_at": datetime.now().isoformat()
                })
        logger.info("Jobs en cours nettoyés lors de l'arrêt")
    except Exception as e:
        logger.warning(f"Erreur lors du nettoyage à l'arrêt: {e}")

# Route de santé pour le monitoring

@app.get("/health")
def health_check():
    """Vérification de santé de l'application."""
    try:
        # Vérifier les composants critiques
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
            "components": {
                "storage": "healthy",
                "anonymizers": "healthy",
                "filesystem": "healthy"
            }
        }
        
        # Vérifier le stockage
        try:
            test_key = f"health_check_{int(time.time())}"
            jobs_store.set(test_key, {"test": True})
            jobs_store.delete(test_key)
        except Exception:
            health_status["components"]["storage"] = "unhealthy"
            health_status["status"] = "degraded"
        
        # Vérifier les anonymizers
        try:
            regex_anonymizer.detect("test@example.com")
        except Exception:
            health_status["components"]["anonymizers"] = "unhealthy"
            health_status["status"] = "degraded"
        
        # Vérifier le système de fichiers
        try:
            test_dir = Path("backend/static/uploads")
            test_file = test_dir / f"health_check_{int(time.time())}.tmp"
            test_file.write_text("test")
            test_file.unlink()
        except Exception:
            health_status["components"]["filesystem"] = "unhealthy"
            health_status["status"] = "degraded"
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        return JSONResponse(content=health_status, status_code=status_code)
        
    except Exception as e:
        logger.error(f"Erreur lors du check de santé: {e}")
        return JSONResponse(
            content={
                "status": "unhealthy",
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            },
            status_code=503
        )

class NERConfig(BaseModel):
    model: str = "default"
    confidence: float = 0.5
    device: str = "auto"
    cache_dir: Optional[str] = None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

class RulesConfig(BaseModel):
    regex_rules: List[RegexRule] = []
    ner: NERConfig = NERConfig()
    styles: Dict[str, str] = {}
    presets: Dict[str, Dict[str, Any]] = {}

class JobStatus(BaseModel):
    id: str
    status: str
    progress: int
    mode: str
    entities_detected: int
    eta: Optional[float] = None
    message: Optional[str] = None
    created_at: str
    updated_at: str
    result: Optional[Dict[str, Any]] = None

# Configuration des fichiers
RULES_FILE = Path("backend/rules.json")
PRESETS_FILE = Path("backend/presets.json")

def load_rules() -> RulesConfig:
    """Charger la configuration des règles depuis le fichier JSON."""
    try:
        if RULES_FILE.exists():
            data = json.loads(RULES_FILE.read_text(encoding="utf-8"))
            return RulesConfig.parse_obj(data)
    except Exception as e:
        logger.error(f"Erreur lors du chargement des règles: {e}")
    return RulesConfig()

def save_rules(cfg: RulesConfig) -> None:
    """Sauvegarder la configuration des règles dans le fichier JSON."""
    try:
        RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
        RULES_FILE.write_text(
            json.dumps(cfg.dict(), indent=2, ensure_ascii=False), 
            encoding="utf-8"
        )
        logger.info("Configuration des règles sauvegardée")
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des règles: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde des règles")

def load_presets() -> Dict[str, Any]:
    """Charger les préréglages depuis le fichier JSON."""
    try:
        if PRESETS_FILE.exists():
            return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Erreur lors du chargement des préréglages: {e}")
    
    # Préréglages par défaut
    default_presets = {
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
    
    # Sauvegarder les préréglages par défaut
    try:
        PRESETS_FILE.parent.mkdir(parents=True, exist_ok=True)
        PRESETS_FILE.write_text(
            json.dumps(default_presets, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
    except Exception as e:
        logger.warning(f"Impossible de sauvegarder les préréglages par défaut: {e}")
    
    return default_presets

def merge_entities(a: List[Entity], b: List[Entity]) -> List[Entity]:
    """Fusionner deux listes d'entités en évitant les doublons."""
    seen = set()
    merged = []
    for ent in a + b:
        key = (ent.start, ent.end, ent.type, ent.value)
        if key not in seen:
            seen.add(key)
            merged.append(ent)
    return merged

def cleanup_old_files():
    """Nettoyer les anciens fichiers d'upload et d'export."""
    try:
        now = datetime.now()
        cutoff = now - timedelta(hours=MAX_JOB_AGE_HOURS)
        
        for directory in ["backend/static/uploads", "backend/static/exports"]:
            if not os.path.exists(directory):
                continue
                
            for file_path in Path(directory).glob("*"):
                if file_path.is_file():
                    file_age = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_age < cutoff:
                        try:
                            file_path.unlink()
                            logger.info(f"Fichier nettoyé: {file_path}")
                        except Exception as e:
                            logger.warning(f"Impossible de supprimer {file_path}: {e}")
                            
        logger.info("Nettoyage des anciens fichiers terminé")
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage: {e}")

def cleanup_old_jobs():
    """Nettoyer les anciens jobs du store."""
    try:
        all_jobs = jobs_store.all()
        now = time.time()
        cutoff = now - (MAX_JOB_AGE_HOURS * 3600)
        
        for job_id, job in all_jobs.items():
            try:
                job_time = job.get("created_at", now)
                if isinstance(job_time, str):
                    job_time = datetime.fromisoformat(job_time).timestamp()
                
                if job_time < cutoff:
                    jobs_store.delete(job_id)
                    entities_store.delete(job_id)
                    groups_store.delete(job_id)
                    logger.info(f"Job nettoyé: {job_id}")
            except Exception as e:
                logger.warning(f"Erreur lors du nettoyage du job {job_id}: {e}")
                
        logger.info("Nettoyage des anciens jobs terminé")
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage des jobs: {e}")

# Tâche de nettoyage périodique
async def periodic_cleanup():
    """Tâche de nettoyage périodique."""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)
            cleanup_old_files()
            cleanup_old_jobs()
        except Exception as e:
            logger.error(f"Erreur dans le nettoyage périodique: {e}")

# Routes principales

@app.get("/", response_class=HTMLResponse)
def read_index(request: Request):
    """Render the upload page."""
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        logger.error(f"Erreur lors du rendu de la page index: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement de la page d'accueil")

@app.get("/progress", response_class=HTMLResponse)
def progress_page(request: Request):
    """Page de progression du traitement."""
    try:
        return templates.TemplateResponse("progress.html", {"request": request})
    except Exception as e:
        logger.error(f"Erreur lors du rendu de la page progress: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement de la page de progression")

@app.get("/interface", response_class=HTMLResponse)
def interface_page(request: Request):
    """Interface d'anonymisation avancée."""
    try:
        return templates.TemplateResponse("interface.html", {"request": request})
    except Exception as e:
        logger.error(f"Erreur lors du rendu de la page interface: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement de l'interface d'anonymisation")

# Routes de configuration

@app.get("/rules", response_model=RulesConfig)
def get_rules() -> RulesConfig:
    """Retourner la configuration actuelle des règles d'anonymisation."""
    return load_rules()

@app.put("/rules", response_model=RulesConfig)
def update_rules(cfg: RulesConfig) -> RulesConfig:
    """Mettre à jour la configuration des règles d'anonymisation."""
    save_rules(cfg)
    logger.info("Configuration des règles mise à jour")
    return cfg

@app.get("/presets")
def get_presets() -> Dict[str, Any]:
    """Retourner les préréglages disponibles."""
    return load_presets()

@app.post("/presets/{preset_id}")
def apply_preset(preset_id: str, job_id: str):
    """Appliquer un préréglage à un job."""
    try:
        presets = load_presets()
        if preset_id not in presets:
            raise HTTPException(status_code=404, detail="Préréglage introuvable")
        
        preset = presets[preset_id]
        
        # Filtrer les entités selon le préréglage
        job_entities = entities_store.get(job_id, {})
        allowed_types = set(preset.get("entity_types", []))
        
        filtered_entities = {}
        for ent_id, entity in job_entities.items():
            if entity.get("type") in allowed_types:
                # Appliquer le mode de remplacement du préréglage
                if preset.get("replacement_mode") == "generic":
                    entity["replacement"] = "[DONNÉES SUPPRIMÉES]"
                elif preset.get("replacement_mode") == "type":
                    entity["replacement"] = f"[{entity['type']}]"
                
                filtered_entities[ent_id] = entity
        
        entities_store.set(job_id, filtered_entities)
        
        logger.info(f"Préréglage {preset_id} appliqué au job {job_id}")
        return {"message": f"Préréglage '{preset['name']}' appliqué avec succès"}
        
    except Exception as e:
        logger.error(f"Erreur lors de l'application du préréglage: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'application du préréglage")

# Routes de traitement de fichiers

def _process_file(job_id: str, mode: str, confidence: float, contents: bytes, filename: str):
    """Traitement interne des fichiers avec gestion d'erreurs améliorée."""
    logger.info(f"Démarrage du traitement pour job {job_id}")
    
    def _calc_eta(start: float, progress: int) -> Optional[float]:
        """Estimation simple du temps restant basée sur le progrès."""
        if progress <= 0:
            return None
        elapsed = time.time() - start
        return elapsed * (100 - progress) / progress

    start_time = time.time()
    
    try:
        # Mise à jour initiale du job
        jobs_store.update(job_id, {
            "mode": mode, 
            "entities_detected": 0, 
            "eta": None, 
            "progress": 0,
            "updated_at": datetime.now().isoformat()
        })
        
        # Vérifications initiales
        extension = filename.split(".")[-1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            jobs_store.set(job_id, {
                "status": "error", 
                "message": "Format non pris en charge", 
                "mode": mode, 
                "entities_detected": 0, 
                "eta": 0,
                "updated_at": datetime.now().isoformat()
            })
            return

        size_mb = len(contents) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            jobs_store.set(job_id, {
                "status": "error", 
                "message": f"Fichier trop volumineux ({size_mb:.1f}MB). Maximum: {MAX_FILE_SIZE_MB}MB", 
                "mode": mode, 
                "entities_detected": 0, 
                "eta": 0,
                "updated_at": datetime.now().isoformat()
            })
            return

        if mode not in {"regex", "ai"}:
            jobs_store.set(job_id, {
                "status": "error", 
                "message": "Mode inconnu", 
                "mode": mode, 
                "entities_detected": 0, 
                "eta": 0,
                "updated_at": datetime.now().isoformat()
            })
            return

        logger.info(f"Job {job_id}: Début du traitement ({extension}, {size_mb:.1f}MB)")
        
        jobs_store.update(job_id, {
            "progress": 10, 
            "eta": _calc_eta(start_time, 10),
            "updated_at": datetime.now().isoformat()
        })
        
        # Traitement selon le type de fichier
        if extension == "docx":
            logger.info(f"Job {job_id}: Traitement DOCX")
            _anonymized, regex_entities, mapping, text = regex_anonymizer.anonymize_docx(contents)
            jobs_store.update(job_id, {
                "progress": 60, 
                "eta": _calc_eta(start_time, 60),
                "updated_at": datetime.now().isoformat()
            })
            
            if mode == "ai":
                logger.info(f"Job {job_id}: Mode IA activé")
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            
            logger.info(f"Job {job_id}: {len(entities)} entités détectées")
            jobs_store.update(job_id, {
                "progress": 90, 
                "eta": _calc_eta(start_time, 90),
                "updated_at": datetime.now().isoformat()
            })
            
            # Création des dossiers de sortie
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = int(time.time())
            original_filename = f"{timestamp}_{uuid4().hex}_original_{filename}"
            anonymized_filename = f"{timestamp}_{uuid4().hex}_anonymized_{filename}"
            original_path = output_dir / original_filename
            anonymized_path = output_dir / anonymized_filename
            
            # Sauvegarde des fichiers
            with open(original_path, "wb") as f:
                f.write(contents)
            with open(anonymized_path, "wb") as f:
                f.write(_anonymized)
            
            # Conversion safe des entités et mapping
            safe_entities = []
            for e in entities:
                entity_dict = {
                    "id": getattr(e, 'id', None) or utils.generateId(),
                    "created_at": datetime.now().isoformat()
                }
                for key, value in e.__dict__.items():
                    if value is not None:
                        entity_dict[key] = value
                safe_entities.append(entity_dict)
            
            safe_mapping = []
            for m in mapping:
                try:
                    mapping_dict = m.to_dict()
                    safe_mapping.append(mapping_dict)
                except Exception as e:
                    logger.warning(f"Erreur lors de la conversion du mapping: {e}")
            
            result = {
                "filename": filename,
                "entities": safe_entities,
                "mapping": safe_mapping,
                "original_url": f"/static/uploads/{original_filename}",
                "anonymized_url": f"/static/uploads/{anonymized_filename}",
                "text": text,
                "processing_time": time.time() - start_time,
                "file_size": len(contents),
                "document_type": "docx"
            }
            
        else:  # PDF
            logger.info(f"Job {job_id}: Traitement PDF")
            _anonymized_docx, regex_entities, mapping, text, original_docx = (
                regex_anonymizer.anonymize_pdf(contents)
            )
            jobs_store.update(job_id, {
                "progress": 60, 
                "eta": _calc_eta(start_time, 60),
                "updated_at": datetime.now().isoformat()
            })
            
            if mode == "ai":
                ai_entities = ai_anonymizer.detect(text, confidence)
                entities = merge_entities(regex_entities, ai_entities)
            else:
                entities = regex_entities
            
            logger.info(f"Job {job_id}: {len(entities)} entités détectées")
            jobs_store.update(job_id, {
                "progress": 90, 
                "eta": _calc_eta(start_time, 90),
                "updated_at": datetime.now().isoformat()
            })
            
            output_dir = Path("backend/static/uploads")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = int(time.time())
            original_filename = f"{timestamp}_{uuid4().hex}_original_{Path(filename).stem}.docx"
            anonymized_filename = f"{timestamp}_{uuid4().hex}_anonymized_{Path(filename).stem}.docx"
            pdf_filename = f"{timestamp}_{uuid4().hex}_original_{filename}"
            
            original_path = output_dir / original_filename
            anonymized_path = output_dir / anonymized_filename
            pdf_path = output_dir / pdf_filename
            
            # Sauvegarder les fichiers
            with open(original_path, "wb") as f:
                f.write(original_docx)
            with open(anonymized_path, "wb") as f:
                f.write(_anonymized_docx)
            with open(pdf_path, "wb") as f:
                f.write(contents)
            
            # Conversion safe des entités et mapping
            safe_entities = []
            for e in entities:
                entity_dict = {
                    "id": getattr(e, 'id', None) or utils.generateId(),
                    "created_at": datetime.now().isoformat()
                }
                for key, value in e.__dict__.items():
                    if value is not None:
                        entity_dict[key] = value
                safe_entities.append(entity_dict)
            
            safe_mapping = []
            for m in mapping:
                try:
                    mapping_dict = m.to_dict()
                    safe_mapping.append(mapping_dict)
                except Exception as e:
                    logger.warning(f"Erreur lors de la conversion du mapping: {e}")
                
            result = {
                "filename": f"{Path(filename).stem}.docx",
                "original_filename": filename,
                "entities": safe_entities,
                "mapping": safe_mapping,
                "original_url": f"/static/uploads/{original_filename}",
                "anonymized_url": f"/static/uploads/{anonymized_filename}",
                "pdf_url": f"/static/uploads/{pdf_filename}",
                "text": text,
                "processing_time": time.time() - start_time,
                "file_size": len(contents),
                "document_type": "pdf"
            }
        
        # Sauvegarder les entités dans le store
        entities_data = {}
        for entity_dict in safe_entities:
            entities_data[entity_dict["id"]] = entity_dict
        entities_store.set(job_id, entities_data)
        
        jobs_store.update(job_id, {"entities_detected": len(entities)})
        jobs_store.update(job_id, {
            "status": "completed", 
            "progress": 100, 
            "result": result, 
            "eta": 0,
            "updated_at": datetime.now().isoformat()
        })
        logger.info(f"Job {job_id}: Traitement terminé avec succès en {time.time() - start_time:.2f}s")
        
    except Exception as exc:
        logger.error(f"Job {job_id}: Erreur - {str(exc)}")
        logger.error(f"Job {job_id}: Traceback - {traceback.format_exc()}")
        jobs_store.set(job_id, {
            "status": "error", 
            "message": str(exc), 
            "mode": mode, 
            "entities_detected": 0, 
            "eta": 0,
            "updated_at": datetime.now().isoformat()
        })

@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: str = Form(default="regex"),
    confidence: Optional[float] = Form(default=None),
):
    """Upload et traitement de fichier avec validation améliorée."""
    
    # Validation des paramètres
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Fichier manquant")
    
    if mode not in ["regex", "ai"]:
        raise HTTPException(status_code=400, detail="Mode invalide. Utilisez 'regex' ou 'ai'")
    
    # Validation de la confiance pour le mode IA
    if mode == "ai":
        if confidence is None:
            confidence = ai_anonymizer.confidence
        else:
            try:
                confidence = float(confidence)
                if not 0.0 <= confidence <= 1.0:
                    raise HTTPException(status_code=400, detail="La confiance doit être entre 0 et 1")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Valeur de confiance invalide")
    else:
        confidence = 0.5
    
    # Lire le contenu du fichier
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Erreur lors de la lecture du fichier: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur lors de la lecture du fichier: {str(e)}")
    
    # Vérifications préliminaires
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    
    # Vérifier l'extension
    extension = file.filename.split(".")[-1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Format non supporté. Formats acceptés: {', '.join(ALLOWED_EXTENSIONS).upper()}"
        )
    
    # Vérifier la taille
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400, 
            detail=f"Fichier trop volumineux ({size_mb:.1f}MB). Taille maximale: {MAX_FILE_SIZE_MB}MB"
        )
    
    # Créer un job
    job_id = uuid4().hex
    timestamp = datetime.now().isoformat()
    
    logger.info(f"Nouveau job {job_id} pour fichier {file.filename} (mode: {mode}, confiance: {confidence})")
    
    # Initialiser le job dans le store
    jobs_store.set(job_id, {
        "id": job_id,
        "status": "processing",
        "progress": 0,
        "mode": mode,
        "entities_detected": 0,
        "eta": None,
        "filename": file.filename,
        "filesize": len(contents),
        "confidence": confidence,
        "created_at": timestamp,
        "updated_at": timestamp
    })
    
    # Lancer le traitement en arrière-plan
    background_tasks.add_task(_process_file, job_id, mode, confidence, contents, file.filename)
    
    return {
        "job_id": job_id, 
        "status": "processing", 
        "message": "Traitement démarré",
        "estimated_time": "2-5 minutes selon la taille du document"
    }

@app.get("/status/{job_id}", response_model=JobStatus)
def get_status(job_id: str):
    """Retourner le statut de traitement pour un job donné."""
    try:
        job = jobs_store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job introuvable")
        
        # Protection contre les jobs zombies
        if job.get("status") == "processing":
            created_at = job.get("created_at")
            if created_at:
                try:
                    created_time = datetime.fromisoformat(created_at)
                    if datetime.now() - created_time > timedelta(minutes=30):
                        job["status"] = "error"
                        job["message"] = "Délai de traitement dépassé"
                        jobs_store.set(job_id, job)
                        logger.warning(f"Job {job_id} marqué comme expiré")
                except Exception as e:
                    logger.warning(f"Erreur lors de la vérification de l'expiration du job {job_id}: {e}")
        
        # S'assurer que anonymized_url est toujours présent dans la réponse
        result = job.get("result")
        if result is not None and "anonymized_url" not in result:
            result["anonymized_url"] = None
        
        return JobStatus.parse_obj(job)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération du statut")

# Routes de gestion des entités

@app.get("/entities/{job_id}")
def list_entities(job_id: str) -> List[EntityModel]:
    """Retourner toutes les entités stockées pour un job."""
    try:
        entities_data = entities_store.list(job_id)
        entities = []
        for e in entities_data:
            try:
                entity = EntityModel.parse_obj(e)
                entities.append(entity)
            except Exception as parse_error:
                logger.warning(f"Erreur lors du parsing de l'entité {e}: {parse_error}")
                continue
        return entities
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des entités pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des entités")

@app.post("/entities/{job_id}")
def create_entity(job_id: str, entity: EntityModel) -> EntityModel:
    """Créer une nouvelle entité pour un job."""
    try:
        if not entity.id:
            entity.id = uuid4().hex
        
        entity.created_at = datetime.now().isoformat()
        entity.updated_at = entity.created_at
        
        entities_store.set_nested(job_id, entity.id, entity.dict())
        logger.info(f"Entité créée: {entity.id} pour job {job_id}")
        return entity
    except Exception as e:
        logger.error(f"Erreur lors de la création de l'entité pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création de l'entité")

@app.put("/entities/{job_id}/{entity_id}")
def update_entity(job_id: str, entity_id: str, entity: EntityModel) -> EntityModel:
    """Mettre à jour une entité existante pour un job."""
    try:
        existing = entities_store.get_nested(job_id, entity_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Entité introuvable")
        
        entity.id = entity_id
        entity.updated_at = datetime.now().isoformat()
        entity.created_at = existing.get("created_at", entity.updated_at)
        
        entities_store.set_nested(job_id, entity_id, entity.dict())
        logger.info(f"Entité mise à jour: {entity_id} pour job {job_id}")
        return entity
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de l'entité {entity_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour de l'entité")

@app.delete("/entities/{job_id}/{entity_id}")
def delete_entity(job_id: str, entity_id: str):
    """Supprimer une entité pour un job et la détacher des groupes."""
    try:
        # Vérifier que l'entité existe
        existing = entities_store.get_nested(job_id, entity_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Entité introuvable")
        
        entities_store.delete_nested(job_id, entity_id)
        
        # Supprimer l'entité de tous les groupes
        job_groups = groups_store.get(job_id, {})
        for group in job_groups.values():
            if entity_id in group.get("entities", []):
                group["entities"].remove(entity_id)
                group["updated_at"] = datetime.now().isoformat()
        groups_store.set(job_id, job_groups)
        
        logger.info(f"Entité supprimée: {entity_id} pour job {job_id}")
        return {"status": "deleted", "entity_id": entity_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de l'entité {entity_id} pour job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression de l'entité")

@app.post("/entities/{job_id}/bulk")
def bulk_entity_operation(job_id: str, operation: BulkOperation):
    """Effectuer une opération en lot sur les entités."""
    try:
        if operation.operation == "delete":
            # Supprimer plusieurs entités
            deleted_count = 0
            for entity_id in operation.entity_ids:
                try:
                    delete_entity(job_id, entity_id)
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Erreur lors de la suppression de l'entité {entity_id}: {e}")
            return {"status": "deleted", "count": deleted_count}
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4
from pathlib import Path
from difflib import get_close_matches
from .anonymizer import RegexAnonymizer, Entity, RunInfo
from .ai_anonymizer import AIAnonymizer
from .storage import jobs_store, entities_store, groups_store
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import time
import logging
import traceback
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

# Configuration du logging avancée
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend/logs/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Créer le dossier de logs s'il n'existe pas
os.makedirs("backend/logs", exist_ok=True)

app = FastAPI(
    title="Anonymiseur de documents juridiques - Version avancée",
    description="Interface d'anonymisation complète avec viewer PDF intégré",
    version="2.0.0"
)

# Middleware CORS pour le développement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware de gestion d'erreurs global amélioré
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"{request.method} {request.url} - {response.status_code} - {process_time:.3f}s")
        return response
    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(f"Unhandled exception on {request.method} {request.url} after {process_time:.3f}s: {str(exc)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Erreur interne du serveur: {str(exc)}",
                "timestamp": datetime.now().isoformat(),
                "path": str(request.url)
            }
        )

# Initialisation des anonymizers
regex_anonymizer = RegexAnonymizer()
ai_anonymizer = AIAnonymizer()

# Configuration des fichiers statiques et templates
try:
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
    templates = Jinja2Templates(directory="backend/templates")
except Exception as e:
    logger.error(f"Erreur lors du montage des fichiers statiques: {e}")
    # Créer les dossiers s'ils n'existent pas
    for directory in ["backend/static", "backend/templates", "backend/static/uploads", "backend/static/exports"]:
        os.makedirs(directory, exist_ok=True)
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
    templates = Jinja2Templates(directory="backend/templates")

# Configuration
ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_FILE_SIZE_MB = 25
CLEANUP_INTERVAL_HOURS = 24
MAX_JOB_AGE_HOURS = 72

# Modèles Pydantic améliorés
class EntityModel(BaseModel):
    id: str
    type: str
    value: str
    start: int = 0
    end: int = 0
    page: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    confidence: Optional[float] = None
    replacement: Optional[str] = None
    group_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class GroupModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    entities: List[str] = []
    color: Optional[str] = None
    replacement_pattern: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ExportOptions(BaseModel):
    watermark: Optional[str] = None
    audit: bool = False
    format: str = "docx"
    compression: bool = False
    password_protect: bool = False
    password: Optional[str] = None

class SearchQuery(BaseModel):
    text: Optional[str] = None
    entity_type: Optional[str] = None
    confidence_min: Optional[float] = None
    confidence_max: Optional[float] = None
    page: Optional[int] = None
    group_id: Optional[str] = None

class BulkOperation(BaseModel):
    operation: str  # "delete", "group", "update"
    entity_ids: List[str]
    data: Optional[Dict[str, Any]] = None

# Configuration model pour les règles
class RegexRule(BaseModel):
    pattern: str
    replacement: str
    enabled: bool = True

class NERConfig(BaseModel):
    model: str = "default"
    confidence: float = 0.5
    device: str = "auto"
    cache_dir: Optional[str] = None

app = FastAPI(
    title="Anonymiseur de documents juridiques - Version avancée",
    description="Interface d'anonymisation complète avec viewer PDF intégré", 
    version="2.0.0")
class RulesConfig(BaseModel):
    regex_rules: List[RegexRule] = []
    ner_config: NERConfig = NERConfig()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)