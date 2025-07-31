import re
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from functools import lru_cache
import time
import hashlib
import logging

logger = logging.getLogger(__name__)

@dataclass
class Entity:
    id: str
    text: str
    type: str
    start: int
    end: int
    confidence: float
    replacement: str
    source: str  # 'regex' ou 'ner'
    selected: bool = True
    occurrences: int = 1

class HybridAnalyzer:
    """
    🧠 Analyzer hybride avec séparation stricte selon vos spécifications :
    
    ✅ REGEX : UNIQUEMENT pour données STRUCTURÉES simples et fiables
    - 📞 Numéros de téléphone (formats français)
    - 📧 Adresses email  
    - 🏭 SIRET/SIREN (avec validation checksum)
    - 🆔 Numéros de sécurité sociale
    - 🏠 Adresses postales françaises
    - ⚖️ Références juridiques (N° RG, articles...)
    
    ✅ NER : UNIQUEMENT pour entités COMPLEXES nécessitant compréhension contextuelle
    - 👤 Noms de personnes (Jean Dupont, Maître Martin...)
    - 🏢 Organisations/entreprises (Cabinet Durand, SARL TechCorp...)
    
    ❌ INTERDICTIONS STRICTES :
    - ❌ Regex sur noms/organisations (trop complexe, faux positifs)
    - ❌ NER sur données structurées (overkill, moins précis)
    
    🤖 MODÈLE NER : cmarkea/distilcamembert-base-ner (~250MB, français optimisé)
    """
    
    def __init__(self):
        # PARTIE 1 : Patterns regex UNIQUEMENT pour données structurées
        self.structured_patterns = self._compile_structured_patterns()
        logger.info("✅ Patterns REGEX compilés pour données structurées uniquement")
        
        # PARTIE 2 : Modèle NER DistilCamemBERT (lazy loading pour économiser RAM)
        self._ner_pipeline = None
        self.ner_model_name = "cmarkea/distilcamembert-base-ner"
        logger.info("🤖 Modèle NER DistilCamemBERT configuré (lazy loading)")
        
        # Cache pour éviter de recompiler les patterns
        self._pattern_cache = {}
    
    def _compile_structured_patterns(self) -> Dict[str, List[re.Pattern]]:
        """
        Compile UNIQUEMENT les patterns pour données STRUCTURÉES fiables
        
        ❌ PAS de patterns pour noms/organisations (volontairement laissé au NER)
        ✅ SEULEMENT pour formats standardisés français avec validation
        """
        patterns = {
            'TELEPHONE': [
                # Formats français standards avec indicatifs
                r'\b0[1-9](?:[\s.-]?\d{2}){4}\b',
                r'\+33\s?[1-9](?:[\s.-]?\d{2}){4}\b',
                r'\+33\s?\(0\)\s?[1-9](?:[\s.-]?\d{2}){4}\b',
                # Avec séparateurs variables
                r'\b0[1-9][\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}\b'
            ],
            'EMAIL': [
                # Email standard avec validation stricte
                r'\b[A-Za-z0-9]([A-Za-z0-9._%-]*[A-Za-z0-9])?@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b'
            ],
            'SIRET': [
                # SIRET : 14 chiffres (avec validation checksum)
                r'\b(?:SIRET\s*:?\s*)?(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5})\b',
                # SIREN : 9 chiffres (avec validation checksum)
                r'\b(?:SIREN\s*:?\s*)?(\d{3}[\s\.]?\d{3}[\s\.]?\d{3})\b',
                # RCS avec numéro d'identification
                r'RCS\s+[A-Z][a-zA-Z\s-]+\s+(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}(?:[\s\.]?\d{5})?)',
                # Numéro TVA intracommunautaire français
                r'(?:n°\s*TVA\s*:?\s*|TVA\s+intra\w*\s*:?\s*)?FR\s*(\d{2}\s?\d{9})',
                # Code APE/NAF
                r'(?:APE|NAF)\s*:?\s*(\d{4}[A-Z])'
            ],
            'SECU_SOCIALE': [
                # Format sécurité sociale français complet : 1 23 45 67 890 123 45
                r'\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b',
                # Format avec tirets ou points
                r'\b[12][\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{3}[\s.-]\d{3}[\s.-]\d{2}\b'
            ],
            'ADRESSE': [
                # Adresses françaises complètes avec numéro + type voie + nom + ville
                r'\d+(?:\s+(?:bis|ter|quater))?\s+(?:rue|avenue|boulevard|place|impasse|allée|square|passage|chemin|route|cours|quai)\s+[^,\n.]{5,}(?:\s+\d{5}\s+[A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ][a-zàáâäçéèêëïîôöùúûüñ\s-]+)?',
                # Code postal + ville (format français)
                r'\b\d{5}\s+[A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ][A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ\s-]{2,}\b',
                # Format avec virgules (adresse sur plusieurs lignes)
                r'\d+(?:\s+(?:bis|ter|quater))?\s+(?:rue|avenue|boulevard|place|impasse|allée|square|passage|chemin|route)\s+[^,\n]{5,},\s*\d{5}\s+[A-ZÀÁÂÄÇÉÈÊËÏÎÔÖÙÚÛÜÑ][a-zàáâäçéèêëïîôöùúûüñ\s-]+'
            ],
            'REFERENCE_JURIDIQUE': [
                # Références spécifiques au domaine juridique français
                r'N°\s?RG\s?\d+[\/\-\s]*\d*',
                r'(?:Dossier|Affaire)\s+n°\s?\d+[\/\-\s]*\d*',
                r'Article\s+\d+(?:\s+du\s+Code\s+[a-zA-ZÀ-ÿ\s]+)?',
                r'Arrêt\s+n°\s?\d+[\/\-\s]*\d*',
                r'Ordonnance\s+n°\s?\d+[\/\-\s]*\d*',
                r'Jugement\s+n°\s?\d+[\/\-\s]*\d*',
                r'Réquisitoire\s+n°\s?\d+[\/\-\s]*\d*'
            ]
        }
        
        # Compiler tous les patterns avec gestion d'erreur
        compiled_patterns = {}
        for entity_type, pattern_list in patterns.items():
            compiled_patterns[entity_type] = []
            for pattern in pattern_list:
                try:
                    compiled_pattern = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                    compiled_patterns[entity_type].append(compiled_pattern)
                except re.error as e:
                    logger.warning(f"Pattern invalide pour {entity_type}: {e}")
        
        total_patterns = sum(len(patterns) for patterns in compiled_patterns.values())
        logger.info(f"✅ {total_patterns} patterns REGEX compilés pour données structurées")
        logger.info("❌ AUCUN pattern regex pour noms/organisations (volontairement exclus)")
        
        return compiled_patterns
    
    @property
    def ner_pipeline(self):
        """
        Lazy loading du modèle DistilCamemBERT pour économiser RAM
        Chargement seulement quand le mode "approfondi" est utilisé
        """
        if self._ner_pipeline is None:
            logger.info("🔄 Chargement du modèle DistilCamemBERT...")
            try:
                self._ner_pipeline = pipeline(
                    "ner",
                    model=self.ner_model_name,
                    tokenizer=self.ner_model_name,
                    aggregation_strategy="simple",
                    device=-1,  # CPU pour compatibilité Vercel
                    return_all_scores=False  # Économie mémoire
                )
                logger.info("✅ Modèle DistilCamemBERT chargé avec succès")
            except Exception as e:
                logger.error(f"❌ Erreur chargement DistilCamemBERT: {e}")
                self._ner_pipeline = None
                
        return self._ner_pipeline
    
    async def analyze(self, text: str, mode: str = "standard") -> List[Entity]:
        """
        🎯 Analyse hybride avec séparation claire selon vos spécifications :
        
        📋 MODE STANDARD (2-5s):
        - REGEX uniquement sur données structurées (téléphone, SIRET, email, adresse)
        - AUCUNE détection de noms/organisations
        - Optimal pour la plupart des documents
        
        🔬 MODE APPROFONDI (5-15s):
        - REGEX pour données structurées (téléphone, SIRET, email, adresse)  
        - NER DistilCamemBERT pour détecter noms et organisations
        - Validation contextuelle des résultats NER
        """
        start_time = time.time()
        logger.info(f"🚀 Analyse {mode.upper()} démarrée - {len(text)} caractères")
        
        all_entities = []
        
        # ÉTAPE 1 : REGEX (TOUJOURS) - SEULEMENT données structurées
        logger.info("📋 Extraction données structurées via REGEX...")
        structured_entities = self._extract_structured_entities(text)
        all_entities.extend(structured_entities)
        logger.info(f"✅ {len(structured_entities)} entités structurées trouvées (téléphone, SIRET, email, adresse, références)")
        
        # ÉTAPE 2 : NER (TOUS MODES SAUF STANDARD) - SEULEMENT noms et organisations
        if mode != "standard":
            logger.info("🧠 Extraction entités complexes via NER DistilCamemBERT...")
            ner_entities = await self._extract_ner_entities(text)
            all_entities.extend(ner_entities)
            logger.info(f"✅ {len(ner_entities)} entités NER trouvées (noms de personnes, organisations)")
        else:
            logger.info("📋 Mode STANDARD : Aucune détection noms/organisations (volontairement)")
        
        # ÉTAPE 3 : Déduplication et finalisation
        final_entities = self._deduplicate_and_finalize(all_entities, text)
        
        processing_time = time.time() - start_time
        logger.info(f"🎯 Analyse {mode} terminée en {processing_time:.2f}s - {len(final_entities)} entités finales")
        
        return final_entities
    
    def _extract_structured_entities(self, text: str) -> List[Entity]:
        """
        🔧 Extraction REGEX uniquement pour données structurées fiables
        
        ✅ Types traités : téléphone, email, SIRET, sécurité sociale, adresse, références juridiques
        ❌ Types exclus : noms, organisations (laissés au NER)
        """
        entities = []
        entity_counter = 0
        
        for entity_type, compiled_patterns in self.structured_patterns.items():
            for pattern in compiled_patterns:
                try:
                    matches = pattern.finditer(text)
                    
                    for match in matches:
                        matched_text = match.group(0).strip()
                        if len(matched_text) < 2:
                            continue
                        
                        # Validation spécifique selon le type avec confiance ajustée
                        is_valid, confidence = self._validate_structured_entity(matched_text, entity_type)
                        
                        if is_valid:
                            entity_counter += 1
                            entity = Entity(
                                id=f"regex_{entity_counter}",
                                text=matched_text,
                                type=entity_type,
                                start=match.start(),
                                end=match.end(),
                                confidence=confidence,
                                replacement=self._generate_replacement(entity_type, matched_text),
                                source='regex',
                                occurrences=text.lower().count(matched_text.lower())
                            )
                            entities.append(entity)
                            
                except Exception as e:
                    logger.debug(f"Erreur pattern {entity_type}: {e}")
                    continue
        
        return entities
    
    async def _extract_ner_entities(self, text: str) -> List[Entity]:
        """
        🧠 Extraction NER avec DistilCamemBERT UNIQUEMENT pour entités complexes
        
        ✅ Types traités : noms de personnes, organisations/entreprises
        ❌ Types exclus : données structurées (laissées au REGEX)
        """
        entities = []
        entity_counter = 0
        
        if not self.ner_pipeline:
            logger.warning("⚠️ Modèle DistilCamemBERT non disponible")
            return entities
        
        try:
            # Chunking intelligent pour éviter les limites de tokens
            chunks = self._split_text_for_ner(text, max_length=400)
            logger.info(f"📄 Texte découpé en {len(chunks)} chunks pour NER")
            
            for chunk_idx, chunk in enumerate(chunks):
                chunk_start = text.find(chunk)
                if chunk_start == -1:
                    continue
                
                # Prédiction NER avec DistilCamemBERT
                ner_results = self.ner_pipeline(chunk)
                
                for result in ner_results:
                    # Mapper les labels DistilCamemBERT vers nos types
                    entity_type = self._map_ner_label(result['entity_group'])
                    
                    if not entity_type:
                        continue  # Label non pertinent
                    
                    # Validation contextuelle pour éviter les faux positifs
                    if not self._validate_ner_entity(result['word'], entity_type, chunk):
                        continue
                    
                    entity_counter += 1
                    entity = Entity(
                        id=f"ner_{entity_counter}",
                        text=result['word'].strip(),
                        type=entity_type,
                        start=chunk_start + result['start'],
                        end=chunk_start + result['end'],
                        confidence=result['score'],
                        replacement=self._generate_replacement(entity_type, result['word']),
                        source='ner',
                        occurrences=text.lower().count(result['word'].lower())
                    )
                    entities.append(entity)
        
        except Exception as e:
            logger.error(f"⚠️ Erreur NER DistilCamemBERT: {e}")
            # Mode dégradé : continuer sans NER
        
        return entities
    
    def _validate_structured_entity(self, text: str, entity_type: str) -> Tuple[bool, float]:
        """
        🔍 Validation spécifique avec confiance ajustée pour chaque type d'entité structurée
        
        Returns: (is_valid, confidence_score)
        """
        if entity_type == 'TELEPHONE':
            # Validation téléphone français
            digits = ''.join(filter(str.isdigit, text))
            if 10 <= len(digits) <= 15:
                # Validation format français
                if digits.startswith('0') or digits.startswith('33'):
                    return True, 0.98
                else:
                    return True, 0.85
            return False, 0.0
        
        elif entity_type == 'EMAIL':
            # Validation email basique mais stricte
            if '@' in text and '.' in text and len(text) >= 5:
                # Vérifications supplémentaires
                if text.count('@') == 1 and not text.startswith('@') and not text.endswith('@'):
                    return True, 0.97
            return False, 0.0
        
        elif entity_type == 'SIRET':
            # Validation SIRET/SIREN avec checksum
            digits = ''.join(filter(str.isdigit, text))
            if len(digits) == 14:  # SIRET
                is_valid = self._validate_siret_checksum(digits)
                return is_valid, 0.99 if is_valid else 0.70
            elif len(digits) == 9:  # SIREN
                is_valid = self._validate_siren_checksum(digits)
                return is_valid, 0.98 if is_valid else 0.70
            elif len(digits) in [5, 11]:  # APE/NAF ou TVA
                return True, 0.95
            return False, 0.0
        
        elif entity_type == 'SECU_SOCIALE':
            # Validation sécurité sociale française
            digits = ''.join(filter(str.isdigit, text))
            if len(digits) == 13:
                # Validation format (1 ou 2 en premier chiffre)
                if digits[0] in ['1', '2']:
                    return True, 0.99
            return False, 0.0
        
        elif entity_type == 'ADRESSE':
            # Validation adresse française
            if (len(text.strip()) >= 10 and 
                any(char.isdigit() for char in text) and
                any(char.isalpha() for char in text)):
                return True, 0.85
            return False, 0.0
        
        elif entity_type == 'REFERENCE_JURIDIQUE':
            # Validation références juridiques
            if any(word in text.lower() for word in ['rg', 'dossier', 'affaire', 'article', 'arrêt']):
                return True, 0.94
            return False, 0.0
        
        # Par défaut : validation basique
        return len(text.strip()) >= 3, 0.80
    
    def _luhn_checksum(self, number: str) -> bool:
        """Algorithme de Luhn générique utilisé pour SIRET/SIREN"""
        try:
            total = 0
            reverse_digits = number[::-1]
            for i, digit in enumerate(reverse_digits):
                n = int(digit)
                if i % 2 == 1:
                    n *= 2
                    if n > 9:
                        n -= 9
                total += n
            return total % 10 == 0
        except Exception:
            return False

    def _validate_siret_checksum(self, siret: str) -> bool:
        """Validation checksum SIRET"""
        return len(siret) == 14 and self._luhn_checksum(siret)

    def _validate_siren_checksum(self, siren: str) -> bool:
        """Validation checksum SIREN"""
        return len(siren) == 9 and self._luhn_checksum(siren)
    
    def _map_ner_label(self, label: str) -> Optional[str]:
        """
        🏷️ Mapping des labels DistilCamemBERT vers nos types d'entités
        
        Référence modèle : https://huggingface.co/cmarkea/distilcamembert-base-ner
        """
        label_mapping = {
            'PER': 'PERSONNE',      # Personnes physiques
            'PERSON': 'PERSONNE',   # Variante anglaise
            'ORG': 'ORGANISATION',  # Organisations/entreprises
            # Ignorer les autres labels (LOC, MISC) car traités par REGEX
        }
        
        return label_mapping.get(label.upper())
    
    def _validate_ner_entity(self, text: str, entity_type: str, context: str) -> bool:
        """
        🔍 Validation contextuelle pour entités NER afin d'éviter les faux positifs
        """
        text_clean = text.strip()
        
        # Filtres généraux
        if len(text_clean) < 2 or len(text_clean) > 80:
            return False
        
        # Exclure les mots trop courts ou courants
        common_words = {
            'le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'donc', 'car',
            'un', 'une', 'ce', 'cette', 'dans', 'sur', 'avec', 'pour', 'par'
        }
        
        if text_clean.lower() in common_words:
            return False
        
        if entity_type == 'PERSONNE':
            # Validation noms de personnes
            # Au moins une majuscule (nom propre)
            if not any(c.isupper() for c in text_clean):
                return False
            
            # Éviter les faux positifs courants
            false_positives = {
                'article', 'maître', 'monsieur', 'madame', 'docteur', 
                'professeur', 'avocat', 'notaire'
            }
            if text_clean.lower() in false_positives:
                return False
            
            # Vérifier que ça ressemble à un nom (lettres + espaces/tirets seulement)
            if not re.match(r"^[A-Za-zÀ-ÿ\s'\-]+$", text_clean):
                return False
            
            return True
        
        elif entity_type == 'ORGANISATION':
            # Validation organisations/entreprises
            # Au moins une majuscule
            if not any(c.isupper() for c in text_clean):
                return False
            
            # Longueur minimum pour une organisation
            if len(text_clean) < 3:
                return False
            
            # Éviter mots isolés trop génériques
            generic_words = {
                'société', 'entreprise', 'cabinet', 'tribunal', 'cour',
                'ministère', 'direction', 'service'
            }
            if text_clean.lower() in generic_words:
                return False
            
            return True
        
        return True
    
    def _split_text_for_ner(self, text: str, max_length: int = 400) -> List[str]:
        """
        📄 Découpe intelligente du texte pour NER (éviter les limites de tokens)
        
        Stratégie : Découper par phrases plutôt que par caractères pour préserver le contexte
        """
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        
        # Découpe par paragraphes d'abord
        paragraphs = text.split('\n\n')
        current_chunk = ""
        
        for paragraph in paragraphs:
            # Si ajouter ce paragraphe dépasse la limite
            if len(current_chunk) + len(paragraph) > max_length:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = paragraph
                else:
                    # Paragraphe trop long, découper par phrases
                    sentences = re.split(r'[.!?]+', paragraph)
                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) > max_length:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = sentence + ". "
                        else:
                            current_chunk += sentence + ". "
            else:
                current_chunk += "\n\n" + paragraph
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        logger.info(f"📄 Texte découpé en {len(chunks)} chunks (max {max_length} chars chacun)")
        return chunks
    
    def _generate_replacement(self, entity_type: str, original_text: str) -> str:
        """
        🔄 Génère un remplacement approprié et cohérent selon le type d'entité
        """
        # Utiliser un hash du texte original pour la cohérence
        hash_suffix = abs(hash(original_text.lower())) % 1000
        
        replacements = {
            'PERSONNE': f'M. PERSONNE_{hash_suffix}',
            'ORGANISATION': f'ORGANISATION_{hash_suffix}',
            'TELEPHONE': '0X XX XX XX XX',
            'EMAIL': 'contact@anonyme.fr',
            'SECU_SOCIALE': 'X XX XX XX XXX XXX XX',
            'SIRET': f'XXX XXX XXX XXXXX',
            'ADRESSE': f'{hash_suffix % 99 + 1} rue de la Paix, 75001 Paris',
            'REFERENCE_JURIDIQUE': f'N° RG {hash_suffix}'
        }
        
        return replacements.get(entity_type, f'ANONYME_{hash_suffix}')
    
    def _deduplicate_and_finalize(self, entities: List[Entity], full_text: str) -> List[Entity]:
        """
        🧹 Déduplication intelligente avec priorité REGEX > NER et finalisation
        """
        seen = {}
        deduplicated = []
        
        # Trier par source (regex en premier pour priorité) puis par position
        entities.sort(key=lambda e: (e.source != 'regex', e.start))
        
        for entity in entities:
            # Clé de déduplication basée sur le texte normalisé et le type
            key = f"{entity.text.lower().strip()}_{entity.type}"
            
            if key not in seen:
                seen[key] = entity
                deduplicated.append(entity)
            else:
                # Garder REGEX si conflit avec NER (selon vos spécifications)
                existing = seen[key]
                if entity.source == 'regex' and existing.source == 'ner':
                    idx = deduplicated.index(existing)
                    deduplicated[idx] = entity
                    seen[key] = entity
                    logger.debug(f"🔄 Priorité REGEX sur NER pour: {entity.text}")
        
        # Finaliser les occurrences pour chaque entité
        for entity in deduplicated:
            try:
                # Recompter les occurrences dans tout le texte
                occurrences = full_text.lower().count(entity.text.lower())
                entity.occurrences = max(1, min(occurrences, 50))  # Limite raisonnable
            except:
                entity.occurrences = 1
        
        logger.info(f"🧹 Déduplication terminée: {len(entities)} → {len(deduplicated)} entités")
        return deduplicated

# Instance globale pour l'application
hybrid_analyzer = HybridAnalyzer()