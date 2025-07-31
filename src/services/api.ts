// src/services/api.ts - Configuration corrigée
/// <reference types="vite/client" />
import axios from 'axios';
import { AnalyzeResponse, Entity, CustomEntity, EntityGroup } from '../types/entities';

// 🔧 CORRECTION : Port backend aligné avec uvicorn (8080)
const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:8080/api')  // ← PORT 8080
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Configuration des interceptors pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error: any) => {
    console.error('🚨 Erreur API:', error);
    
    // Erreur de connexion réseau
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      throw new Error('❌ Impossible de se connecter au serveur backend. Vérifiez que FastAPI fonctionne sur le port 8080.');
    }
    
    // Erreur HTTP avec détail du serveur
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    
    // Erreur générique
    if (error.message) {
      throw new Error(error.message);
    }
    
    throw new Error('Erreur de connexion au serveur');
  }
);

// Test de connectivité
export const testConnection = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    console.log('✅ Connexion backend OK:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Connexion backend échouée:', error);
    return false;
  }
};

// Reste des fonctions API inchangées...
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

// ... autres fonctions API inchangées
export default api;