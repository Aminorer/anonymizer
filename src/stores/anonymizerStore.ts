import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addCustomEntity as addCustomEntityApi, createEntityGroup as createEntityGroupApi, modifyEntity as modifyEntityApi, removeEntityGroup as removeEntityGroupApi } from '../services/api';
import { Entity, EntityStats, EntityGroup } from '../types/entities';

interface AnonymizerState {
  // États existants
  sessionId: string | null;
  filename: string | null;
  textPreview: string | null;
  entities: Entity[];
  stats: EntityStats | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 🆕 NOUVEAUX ÉTATS POUR FONCTIONNALITÉS AVANCÉES
  editingEntity: Entity | null;
  selectedEntitiesForGrouping: string[];
  entityGroups: EntityGroup[];
  showGroupModal: boolean;
  showEditModal: boolean;
  showAddEntityModal: boolean;
  sourceFilters: Record<string, boolean>;
  
  // Actions existantes
  setSessionData: (sessionId: string, filename: string, textPreview: string) => void;
  setEntities: (entities: Entity[], stats: EntityStats) => void;
  toggleEntity: (entityId: string) => void;
  updateReplacement: (entityId: string, replacement: string) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getSelectedEntities: () => Entity[];
  
  // 🆕 NOUVELLES ACTIONS POUR FONCTIONNALITÉS AVANCÉES
  setEditingEntity: (entity: Entity | null) => void;
  toggleEntityForGrouping: (entityId: string) => void;
  createEntityGroup: (name: string, replacement: string) => Promise<void>;
  removeEntityGroup: (groupId: string) => Promise<void>;
  modifyEntity: (entityId: string, newText: string, newReplacement?: string) => Promise<void>;
  addCustomEntity: (text: string, type: string, replacement: string) => Promise<void>;
  setSourceFilter: (source: string, enabled: boolean) => void;
  setShowGroupModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setShowAddEntityModal: (show: boolean) => void;
  getFilteredEntities: () => Entity[];
  
  // 🧠 ALGORITHME DE GROUPEMENT INTELLIGENT CORRIGÉ
  applyGroupReplacements: (text: string, replacements: Record<string, string>) => string;
}

export const useAnonymizerStore = create<AnonymizerState>()(persist((set, get) => ({
  // États existants
  sessionId: null,
  filename: null,
  textPreview: null,
  entities: [],
  stats: null,
  isAnalyzing: false,
  isGenerating: false,
  isLoading: false,
  error: null,
  
  // 🆕 Nouveaux états initialisés
  editingEntity: null,
  selectedEntitiesForGrouping: [],
  entityGroups: [],
  showGroupModal: false,
  showEditModal: false,
  showAddEntityModal: false,
  sourceFilters: {
    regex: true,
    ner: true,
    manual: true
  },
  
  // Actions existantes
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
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  getSelectedEntities: () => {
    const state = get();
    return state.entities.filter((entity) => entity.selected);
  },
  
  // 🆕 NOUVELLES ACTIONS IMPLÉMENTÉES
  
  setEditingEntity: (entity) => set({ editingEntity: entity }),
  setShowGroupModal: (show) => set({ showGroupModal: show }),
  setShowEditModal: (show) => set({ showEditModal: show }),
  setShowAddEntityModal: (show) => set({ showAddEntityModal: show }),
  
  toggleEntityForGrouping: (entityId) => {
    set((state) => {
      const isSelected = state.selectedEntitiesForGrouping.includes(entityId);
      return {
        selectedEntitiesForGrouping: isSelected
          ? state.selectedEntitiesForGrouping.filter(id => id !== entityId)
          : [...state.selectedEntitiesForGrouping, entityId]
      };
    });
  },
  
  createEntityGroup: async (name, replacement) => {
    const state = get();
    const entityIds = state.selectedEntitiesForGrouping;
    if (entityIds.length === 0 || !state.sessionId) return;
    try {
      set({ isLoading: true, error: null });
      const res = await createEntityGroupApi(state.sessionId, name, replacement, entityIds);
      const newGroup: EntityGroup = {
        id: res.group_id,
        name,
        replacement,
        entities: entityIds,
        createdAt: new Date().toISOString()
      };
      const updatedEntities = state.entities.map(e =>
        entityIds.includes(e.id) ? { ...e, replacement, groupId: res.group_id } : e
      );
      set({
        entityGroups: [...state.entityGroups, newGroup],
        entities: updatedEntities,
        selectedEntitiesForGrouping: [],
        showGroupModal: false,
        isLoading: false
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  removeEntityGroup: async (groupId) => {
    const state = get();
    if (!state.sessionId) return;
    try {
      set({ isLoading: true, error: null });
      await removeEntityGroupApi(state.sessionId, groupId);
      const updatedEntities = state.entities.map(entity => {
        if (entity.groupId === groupId) {
          const { groupId: _, ...entityWithoutGroup } = entity as any;
          return {
            ...entityWithoutGroup,
            replacement: generateDefaultReplacement(entity.type, entity.text)
          };
        }
        return entity;
      });
      set({
        entityGroups: state.entityGroups.filter(g => g.id !== groupId),
        entities: updatedEntities,
        isLoading: false
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  modifyEntity: async (entityId, newText, newReplacement) => {
    const state = get();
    if (!state.sessionId) return;
    try {
      set({ isLoading: true, error: null });
      const res = await modifyEntityApi(state.sessionId, entityId, newText, newReplacement);
      const updated = res.entity;
      set({
        entities: state.entities.map(e => (e.id === entityId ? updated : e)),
        isLoading: false,
        showEditModal: false
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  addCustomEntity: async (text, type, replacement) => {
    const state = get();
    if (!state.sessionId) return;
    try {
      set({ isLoading: true, error: null });
      const res = await addCustomEntityApi(state.sessionId, {
        text,
        entity_type: type as any,
        replacement
      });
      set({
        entities: [...state.entities, res.entity],
        showAddEntityModal: false,
        isLoading: false
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },
  
  setSourceFilter: (source, enabled) => {
    set((state) => ({
      sourceFilters: {
        ...state.sourceFilters,
        [source]: enabled
      }
    }));
  },
  
  getFilteredEntities: () => {
    const state = get();
    return state.entities.filter(entity => 
      state.sourceFilters[entity.source] !== false
    );
  },
  
  // 🧠 ALGORITHME DE GROUPEMENT INTELLIGENT CORRIGÉ
  applyGroupReplacements: (text: string, replacements: Record<string, string>) => {
    // 🚨 CORRECTION CRITIQUE : Trier par longueur décroissante
    // Cela évite "Saïd OULHADJ" → "Saïd X" au lieu de "X"
    const sortedReplacements = Object.entries(replacements)
      .sort(([a], [b]) => b.length - a.length); // Plus long en premier
    
    let result = text;
    
    for (const [original, replacement] of sortedReplacements) {
      // Échapper les caractères spéciaux regex
      const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Remplacement global avec préservation de la casse
      const regex = new RegExp(escapedOriginal, 'gi');
      result = result.replace(regex, replacement);
    }
    
    return result;
  }
}), {
  name: 'anonymizer-store',
  partialize: (state) => ({
    sessionId: state.sessionId,
    filename: state.filename,
    textPreview: state.textPreview,
    entities: state.entities,
    stats: state.stats,
    entityGroups: state.entityGroups
  })
}));

// Fonction utilitaire pour générer des remplacements par défaut
const generateDefaultReplacement = (type: string, originalText: string): string => {
  const hash = Math.abs(originalText.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0)) % 1000;
  
  const replacements: Record<string, string> = {
    'PERSONNE': `M. PERSONNE_${hash}`,
    'ORGANISATION': `ORGANISATION_${hash}`,
    'TELEPHONE': '0X XX XX XX XX',
    'EMAIL': 'contact@anonyme.fr',
    'SECU_SOCIALE': 'X XX XX XX XXX XXX XX',
    'SIRET': `XXX XXX XXX XXXXX`,
    'ADRESSE': `${hash % 99 + 1} rue de la Paix, 75001 Paris`,
    'REFERENCE_JURIDIQUE': `N° RG ${hash}`
  };
  
  return replacements[type] || `ANONYME_${hash}`;
};