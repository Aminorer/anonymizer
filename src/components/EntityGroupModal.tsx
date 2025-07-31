import React, { useState, useMemo } from 'react';
import { X, Users, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_ICONS } from '../types/entities';

interface EntityGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EntityGroupModal: React.FC<EntityGroupModalProps> = ({ isOpen, onClose }) => {
  const { 
    entities, 
    selectedEntitiesForGrouping,
    toggleEntityForGrouping,
    createEntityGroup,
    textPreview,
    applyGroupReplacements
  } = useAnonymizerStore();
  
  const [groupName, setGroupName] = useState('');
  const [groupReplacement, setGroupReplacement] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Entités sélectionnées pour le groupement
  const selectedEntities = useMemo(() => {
    return entities.filter(entity => selectedEntitiesForGrouping.includes(entity.id));
  }, [entities, selectedEntitiesForGrouping]);

  // 🧠 DÉMONSTRATION DE L'ALGORITHME CORRIGÉ
  const algorithmDemo = useMemo(() => {
    if (selectedEntities.length === 0 || !groupReplacement.trim()) return null;
    
    const replacements: Record<string, string> = {};
    selectedEntities.forEach(entity => {
      replacements[entity.text] = groupReplacement.trim();
    });
    
    // Texte d'exemple pour démontrer le problème
    const exampleText = selectedEntities.map(e => e.text).join(' et ') + 
                       (selectedEntities.length > 1 ? ` - ainsi que ${selectedEntities[0].text}` : '');
    
    // Version incorrecte (problème actuel)
    const incorrectResult = (() => {
      let result = exampleText;
      // Ordre alphabétique = problème avec "OULHADJ" avant "Saïd OULHADJ"
      const incorrectOrder = Object.entries(replacements).sort(([a], [b]) => a.localeCompare(b));
      for (const [original, replacement] of incorrectOrder) {
        result = result.replace(new RegExp(original, 'gi'), replacement);
      }
      return result;
    })();
    
    // Version corrigée (longueur décroissante)
    const correctResult = applyGroupReplacements(exampleText, replacements);
    
    return {
      originalText: exampleText,
      incorrectResult,
      correctResult,
      showDifference: incorrectResult !== correctResult
    };
  }, [selectedEntities, groupReplacement, applyGroupReplacements]);

  if (!isOpen) return null;

  const handleCreateGroup = () => {
    if (!groupName.trim() || !groupReplacement.trim() || selectedEntities.length === 0) {
      return;
    }
    
    createEntityGroup(groupName.trim(), groupReplacement.trim());
    setGroupName('');
    setGroupReplacement('');
    onClose();
  };

  const previewText = useMemo(() => {
    if (!textPreview || !groupReplacement.trim() || selectedEntities.length === 0) return null;
    
    const replacements: Record<string, string> = {};
    selectedEntities.forEach(entity => {
      replacements[entity.text] = groupReplacement.trim();
    });
    
    return applyGroupReplacements(textPreview.substring(0, 800), replacements);
  }, [textPreview, selectedEntities, groupReplacement, applyGroupReplacements]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold">Grouper des entités</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* 🚨 EXPLICATION DU PROBLÈME CRITIQUE */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-800 mb-2">
                  Problème résolu : Algorithme de groupement intelligent
                </h3>
                <p className="text-red-700 text-sm mb-3">
                  <strong>Ancien problème :</strong> "Saïd OULHADJ" + "OULHADJ" → "Saïd X" au lieu de "X"
                </p>
                <p className="text-green-700 text-sm font-medium">
                  ✅ <strong>Solution :</strong> Tri par longueur décroissante avant remplacement
                </p>
              </div>
            </div>
          </div>

          {/* Sélection des entités disponibles */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">
              Sélectionner les entités à grouper ({selectedEntities.length} sélectionnées)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {entities
                .filter(entity => !entity.groupId) // Exclure les entités déjà groupées
                .map((entity) => (
                  <div
                    key={entity.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedEntitiesForGrouping.includes(entity.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleEntityForGrouping(entity.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEntitiesForGrouping.includes(entity.id)}
                        disabled
                        className="w-4 h-4 text-blue-600 rounded cursor-not-allowed opacity-60"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm truncate">
                          "{entity.text}"
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${ENTITY_TYPE_COLORS[entity.type]}`}>
                            {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {entity.source} • {Math.round(entity.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Configuration du groupe */}
          {selectedEntities.length > 0 && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800">Configuration du groupe</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du groupe
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: Famille OULHADJ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remplacement unifié
                  </label>
                  <input
                    type="text"
                    value={groupReplacement}
                    onChange={(e) => setGroupReplacement(e.target.value)}
                    placeholder="Ex: FAMILLE_X"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Aperçu des entités groupées */}
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Entités qui seront remplacées par "{groupReplacement}":
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEntities.map((entity, index) => (
                    <div key={entity.id} className="flex items-center gap-1">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        "{entity.text}"
                      </span>
                      {index < selectedEntities.length - 1 && (
                        <ArrowRight size={12} className="text-gray-400" />
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <ArrowRight size={12} className="text-green-600" />
                    <span className="font-mono text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                      "{groupReplacement}"
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🧠 DÉMONSTRATION DE L'ALGORITHME CORRIGÉ */}
          {algorithmDemo && algorithmDemo.showDifference && (
            <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                <CheckCircle size={16} />
                Démonstration de l'algorithme corrigé
              </h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-gray-700 mb-1">📝 Texte original :</div>
                  <div className="bg-white p-2 rounded border font-mono">
                    {algorithmDemo.originalText}
                  </div>
                </div>
                
                <div>
                  <div className="font-medium text-red-700 mb-1">❌ Ancien algorithme (incorrect) :</div>
                  <div className="bg-red-100 p-2 rounded border font-mono text-red-800">
                    {algorithmDemo.incorrectResult}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Problème : remplacement partiel, ordre alphabétique
                  </div>
                </div>
                
                <div>
                  <div className="font-medium text-green-700 mb-1">✅ Nouvel algorithme (corrigé) :</div>
                  <div className="bg-green-100 p-2 rounded border font-mono text-green-800">
                    {algorithmDemo.correctResult}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Solution : tri par longueur décroissante
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aperçu du texte avec groupement */}
          {previewText && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <CheckCircle size={14} />
                  {showPreview ? 'Masquer' : 'Aperçu du groupement'}
                </button>
              </div>
              
              {showPreview && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-800 mb-2 font-medium">
                    Aperçu du texte avec groupement appliqué :
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed font-mono bg-white p-3 rounded border">
                    {previewText}...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || !groupReplacement.trim() || selectedEntities.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Users size={16} />
              Créer le groupe ({selectedEntities.length} entités)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityGroupModal;