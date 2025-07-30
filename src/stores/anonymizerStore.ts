import { create } from 'zustand';
import { Entity, EntityStats } from '../types/entities';

interface AnonymizerState {
  sessionId: string | null;
  filename: string | null;
  textPreview: string | null;
  entities: Entity[];
  stats: EntityStats | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  error: string | null;
  
  setSessionData: (sessionId: string, filename: string, textPreview: string) => void;
  setEntities: (entities: Entity[], stats: EntityStats) => void;
  toggleEntity: (entityId: string) => void;
  updateReplacement: (entityId: string, replacement: string) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  getSelectedEntities: () => Entity[];
}

export const useAnonymizerStore = create<AnonymizerState>((set, get) => ({
  sessionId: null,
  filename: null,
  textPreview: null,
  entities: [],
  stats: null,
  isAnalyzing: false,
  isGenerating: false,
  error: null,
  
  setSessionData: (sessionId, filename, textPreview) => {
    set({ sessionId, filename, textPreview });
  },
  
  setEntities: (entities, stats) => {
    set({ entities, stats });
  },
  
  toggleEntity: (entityId) => {
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.id === entityId
          ? { ...entity, selected: !entity.selected }
          : entity
      ),
    }));
  },
  
  updateReplacement: (entityId, replacement) => {
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.id === entityId
          ? { ...entity, replacement }
          : entity
      ),
    }));
  },
  
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  
  getSelectedEntities: () => {
    const state = get();
    return state.entities.filter((entity) => entity.selected);
  },
}));