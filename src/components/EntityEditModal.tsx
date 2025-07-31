import React, { useState, useEffect } from 'react';
import { X, Edit3, Eye, AlertCircle } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { PREDEFINED_REPLACEMENTS, ENTITY_TYPE_COLORS, ENTITY_TYPE_ICONS } from '../types/entities';

interface EntityEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EntityEditModal: React.FC<EntityEditModalProps> = ({ isOpen, onClose }) => {
  const { 
    editingEntity,
    textPreview,
    modifyEntity
  } = useAnonymizerStore();
  
  const [newText, setNewText] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (editingEntity) {
      setNewText(editingEntity.text);
      setNewReplacement(editingEntity.replacement);
      setSelectedText(editingEntity.text);
    }
  }, [editingEntity]);

  if (!isOpen || !editingEntity) return null;

  const handleSave = () => {
    if (!newText.trim()) return;
    
    modifyEntity(editingEntity.id, newText.trim(), newReplacement.trim());
    onClose();
  };

  const handleTextSelection = () => {
    if (!textPreview) return;
    
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim()) {
      setSelectedText(selection.trim());
      setNewText(selection.trim());
    }
  };

  const predefinedReplacements = PREDEFINED_REPLACEMENTS[editingEntity.type] || [];
  
  const previewText = textPreview?.replace(
    new RegExp(editingEntity.text, 'gi'), 
    `[${newReplacement || newText}]`
  ).substring(0, 500);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${ENTITY_TYPE_COLORS[editingEntity.type]}`}>
              {ENTITY_TYPE_ICONS[editingEntity.type]} {editingEntity.type}
            </div>
            <h2 className="text-xl font-semibold">Modifier l'entité</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Entité actuelle */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Edit3 size={16} className="text-gray-600" />
              <span className="font-medium text-gray-700">Entité actuelle</span>
            </div>
            <div className="font-mono text-lg bg-white px-3 py-2 rounded border">
              "{editingEntity.text}"
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {editingEntity.occurrences} occurrence(s) • Confiance: {Math.round(editingEntity.confidence * 100)}%
            </div>
          </div>

          {/* Sélection de texte */}
          {textPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Sélectionner du texte dans l'aperçu</span>
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Sélectionnez du texte ci-dessous pour le modifier
                </div>
              </div>
              <div 
                className="bg-white border rounded-lg p-4 max-h-32 overflow-y-auto cursor-text select-text"
                onMouseUp={handleTextSelection}
              >
                <div className="text-sm text-gray-700 leading-relaxed">
                  {textPreview.substring(0, 1000)}...
                </div>
              </div>
              {selectedText && selectedText !== editingEntity.text && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm text-green-800">
                    ✅ Texte sélectionné: <span className="font-mono">"{selectedText}"</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modification du texte */}
          <div className="space-y-3">
            <label className="block font-medium text-gray-700">
              Texte à anonymiser
            </label>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Texte à anonymiser..."
            />
          </div>

          {/* Remplacement personnalisé */}
          <div className="space-y-3">
            <label className="block font-medium text-gray-700">
              Remplacement
            </label>
            <input
              type="text"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Texte de remplacement..."
            />
            
            {/* Remplacements prédéfinis */}
            {predefinedReplacements.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Remplacements suggérés:</div>
                <div className="flex flex-wrap gap-2">
                  {predefinedReplacements.map((replacement, index) => (
                    <button
                      key={index}
                      onClick={() => setNewReplacement(replacement)}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {replacement}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Aperçu des modifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Eye size={14} />
                {showPreview ? 'Masquer' : 'Aperçu des modifications'}
              </button>
            </div>
            
            {showPreview && previewText && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={14} />
                  Aperçu du texte avec modifications
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {previewText}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!newText.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Enregistrer les modifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityEditModal;