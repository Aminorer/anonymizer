import axios from 'axios';
import { AnalyzeResponse, Entity, CustomEntity } from '../types/entities';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes pour les gros fichiers
});

api.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    if (error.message) {
      throw new Error(error.message);
    }
    throw new Error('Erreur de connexion au serveur');
  }
);

// 📋 ENDPOINTS EXISTANTS

export const analyzeDocument = async (
  file: File, 
  mode: 'standard' | 'approfondi' = 'standard'
): Promise<AnalyzeResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);

  const response = await api.post<AnalyzeResponse>('/analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const generateAnonymizedDocument = async (
  sessionId: string,
  selectedEntities: Entity[]
): Promise<Blob> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('selected_entities', JSON.stringify(selectedEntities));

  const response = await api.post('/generate', formData, {
    responseType: 'blob',
  });

  return response.data;
};

// 🆕 NOUVEAUX ENDPOINTS POUR FONCTIONNALITÉS AVANCÉES

export const addCustomEntity = async (
  sessionId: string,
  entityData: CustomEntity
): Promise<{ success: boolean; entity: Entity }> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('text', entityData.text);
  formData.append('entity_type', entityData.entity_type);
  formData.append('replacement', entityData.replacement);

  const response = await api.post('/add-entity', formData);
  return response.data;
};

export const modifyEntity = async (
  sessionId: string,
  entityId: string,
  newText: string,
  newReplacement?: string
): Promise<{ success: boolean; entity: Entity }> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('entity_id', entityId);
  formData.append('new_text', newText);
  if (newReplacement) {
    formData.append('new_replacement', newReplacement);
  }

  const response = await api.post('/modify-entity', formData);
  return response.data;
};

export const createEntityGroup = async (
  sessionId: string,
  groupName: string,
  replacement: string,
  entityIds: string[]
): Promise<{ success: boolean; group_id: string }> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('group_name', groupName);
  formData.append('replacement', replacement);
  formData.append('entity_ids', JSON.stringify(entityIds));

  const response = await api.post('/group-entities', formData);
  return response.data;
};

export const removeEntityGroup = async (
  sessionId: string,
  groupId: string
): Promise<{ success: boolean }> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('group_id', groupId);

  const response = await api.delete('/remove-group', { data: formData });
  return response.data;
};

// 📊 ENDPOINTS DE STATISTIQUES ET MONITORING

export const getSessionInfo = async (
  sessionId: string
): Promise<{
  success: boolean;
  session_id: string;
  filename: string;
  created_at: string;
  expires_at: string;
  entities_count: number;
  text_length: number;
}> => {
  const response = await api.get(`/session/${sessionId}`);
  return response.data;
};

export const getApplicationStats = async (): Promise<{
  success: boolean;
  application: {
    name: string;
    version: string;
    architecture: string;
    rgpd_compliant: boolean;
    supported_formats: string[];
    processing_modes: string[];
    separation_strategy: string;
  };
  sessions: any;
  entity_types: {
    total_types: number;
    structured_types: string[];
    complex_types: string[];
    model_ner: string;
  };
  performance: {
    mode_standard: string;
    mode_approfondi: string;
    max_file_size: string;
    session_duration: string;
    rgpd_retention: string;
  };
}> => {
  const response = await api.get('/stats');
  return response.data;
};

// 🔧 ENDPOINTS POUR LE BACKEND (à implémenter côté FastAPI)

/*
ENDPOINTS À AJOUTER AU BACKEND FastAPI :

@app.post("/api/modify-entity")
async def modify_entity(
    session_id: str = Form(...),
    entity_id: str = Form(...),
    new_text: str = Form(...),
    new_replacement: str = Form(None)
):
    # Modifier une entité existante dans une session
    pass

@app.post("/api/group-entities")  
async def group_entities(
    session_id: str = Form(...),
    group_name: str = Form(...),
    replacement: str = Form(...),
    entity_ids: str = Form(...)  # JSON array
):
    # Créer un groupe d'entités avec remplacement unifié
    # IMPORTANT: Utiliser l'algorithme de tri par longueur décroissante
    pass

@app.delete("/api/remove-group")
async def remove_group(
    session_id: str = Form(...),
    group_id: str = Form(...)
):
    # Supprimer un groupe et restaurer les remplacements individuels
    pass

@app.post("/api/group-entities-by-text")
async def group_entities_by_text(
    text: str = Form(...),
    replacements: str = Form(...)  # JSON object
):
    # Démonstration de l'algorithme de groupement intelligent
    # Retourne le texte avec remplacements appliqués par ordre de longueur décroissante
    
    import json
    replacements_dict = json.loads(replacements)
    
    # 🧠 ALGORITHME CORRIGÉ : Tri par longueur décroissante
    sorted_replacements = sorted(
        replacements_dict.items(), 
        key=lambda x: len(x[0]), 
        reverse=True  # Plus long en premier
    )
    
    result = text
    for original, replacement in sorted_replacements:
        import re
        escaped_original = re.escape(original)
        result = re.sub(escaped_original, replacement, result, flags=re.IGNORECASE)
    
    return {
        "success": True,
        "original_text": text,
        "anonymized_text": result,
        "replacements_applied": len(sorted_replacements),
        "algorithm": "length_descending_sort"
    }
*/

// 🧪 FONCTIONS UTILITAIRES POUR TESTS

export const testGroupingAlgorithm = (
  text: string,
  replacements: Record<string, string>
): { original: string; result: string; algorithm: string } => {
  // Version locale de l'algorithme pour tests (côté frontend)
  const sortedReplacements = Object.entries(replacements)
    .sort(([a], [b]) => b.length - a.length);
  
  let result = text;
  for (const [original, replacement] of sortedReplacements) {
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOriginal, 'gi');
    result = result.replace(regex, replacement);
  }
  
  return {
    original: text,
    result,
    algorithm: 'length_descending_sort'
  };
};

export const demonstrateGroupingProblem = () => {
  const testText = "Saïd OULHADJ et OULHADJ sont dans le même dossier. OULHADJ a contacté Saïd OULHADJ.";
  const replacements = { "Saïd OULHADJ": "FAMILLE_X", "OULHADJ": "FAMILLE_X" };
  
  // Algorithme incorrect (ordre alphabétique)
  const incorrectResult = (() => {
    let result = testText;
    const alphabeticalOrder = Object.entries(replacements).sort(([a], [b]) => a.localeCompare(b));
    for (const [original, replacement] of alphabeticalOrder) {
      result = result.replace(new RegExp(original, 'gi'), replacement);
    }
    return result;
  })();
  
  // Algorithme corrigé (longueur décroissante)
  const correctResult = testGroupingAlgorithm(testText, replacements).result;
  
  console.log('🧪 DÉMONSTRATION DU PROBLÈME DE GROUPEMENT');
  console.log('📝 Texte original:', testText);
  console.log('❌ Résultat incorrect (alphabétique):', incorrectResult);
  console.log('✅ Résultat correct (longueur desc.):', correctResult);
  
  return {
    originalText: testText,
    replacements,
    incorrectResult,
    correctResult,
    problemSolved: incorrectResult !== correctResult
  };
};

export default api;