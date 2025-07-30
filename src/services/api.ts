import axios from 'axios';
import { AnalyzeResponse, Entity } from '../types/entities';

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

export default api;