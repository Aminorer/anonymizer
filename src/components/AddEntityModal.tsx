import React, { useState } from 'react';
import { X, Plus, Eye, AlertCircle } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { EntityType, ENTITY_TYPE_COLORS, ENTITY_TYPE_ICONS, PREDEFINED_REPLACEMENTS } from '../types/entities';

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddEntityModal: React.FC<AddEntityModalProps> = ({ isOpen, onClose }) => {
  const { 
    textPreview, 
    addCustomEntity,
    entities
  } = useAnonymizerStore();
  
  const [entityText, setEntityText] = useState('');
  const [entityType, setEntityType] = useState<string>(EntityType.PERSONNE);
  const [replacement, setReplacement] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setEntityText('');
      setEntityType(EntityType.PERSONNE);
      setReplacement('');
      setErrors({});
      setShowPreview(false);
    }
  }, [isOpen]);

  const handleTextSelection = () => {
    if (!textPreview) return;
    
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim()) {
      setEntityText(selection.trim());
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!entityText.trim()) {
      newErrors.text = 'Le texte à anonymiser est obligatoire';
    } else if (entityText.trim().length < 2) {
      newErrors.text = 'Le texte doit contenir au moins 2 caractères';
    } else if (entityText.trim().length > 100) {
      newErrors.text = 'Le texte ne peut pas dépasser 100 caractères';
    }
    
    // Vérifier si l'entité existe déjà
    const existingEntity = entities.find(e => 
      e.text.toLowerCase() === entityText.trim().toLowerCase()
    );
    if (existingEntity) {
      newErrors.text = 'Cette entité existe déjà dans la liste';
    }
    
    if (!replacement.trim()) {
      newErrors.replacement = 'Le remplacement est obligatoire';
    } else if (replacement.trim().length > 50) {
      newErrors.replacement = 'Le remplacement ne peut pas dépasser 50 caractères';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    addCustomEntity(
      entityText.trim(),
      entityType,
      replacement.trim()
    );
    
    onClose();
  };

  const previewText = React.useMemo(() => {
    if (!textPreview || !entityText.trim() || !replacement.trim()) return null;
    
    const regex = new RegExp(entityText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return textPreview.replace(regex, `[${replacement.trim()}]`).substring(0, 500);
  }, [textPreview, entityText, replacement]);

  const predefinedReplacements = PREDEFINED_REPLACEMENTS[entityType] || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Plus className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold">Ajouter une entité manuelle</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Sélection de texte dans l'aperçu */}
          {textPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Sélectionner du texte dans l'aperçu</span>
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Sélectionnez du texte ci-dessous pour l'ajouter automatiquement
                </div>
              </div>
              <div 
                className="bg-gray-50 border rounded-lg p-4 max-h-40 overflow-y-auto cursor-text select-text"
                onMouseUp={handleTextSelection}
              >
                <div className="text-sm text-gray-700 leading-relaxed">
                  {textPreview.substring(0, 1200)}...
                </div>
              </div>
            </div>
          )}

          {/* Formulaire d'ajout */}
          <div className="space-y-4">
            
            {/* Texte à anonymiser */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Texte à anonymiser <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={entityText}
                onChange={(e) => {
                  setEntityText(e.target.value);
                  if (errors.text) {
                    setErrors(prev => ({ ...prev, text: '' }));
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.text ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Entrez le texte à anonymiser..."
              />
              {errors.text && (
                <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.text}
                </div>
              )}
            </div>

            {/* Type d'entité */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Type d'entité
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.values(EntityType).map((type) => (
                  <label
                    key={type}
                    className={`cursor-pointer border rounded-lg p-3 text-center transition-all ${
                      entityType === type
                        ? `${ENTITY_TYPE_COLORS[type]} border-2`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="entityType"
                      value={type}
                      checked={entityType === type}
                      onChange={(e) => {
                        setEntityType(e.target.value);
                        setReplacement(''); // Reset replacement when type changes
                      }}
                      className="sr-only"
                    />
                    <div className="text-lg mb-1">{ENTITY_TYPE_ICONS[type]}</div>
                    <div className="text-xs font-medium">{type}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Remplacement */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Remplacement <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={replacement}
                onChange={(e) => {
                  setReplacement(e.target.value);
                  if (errors.replacement) {
                    setErrors(prev => ({ ...prev, replacement: '' }));
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.replacement ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Texte de remplacement..."
              />
              {errors.replacement && (
                <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.replacement}
                </div>
              )}
              
              {/* Remplacements prédéfinis */}
              {predefinedReplacements.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-gray-600">Suggestions pour {entityType} :</div>
                  <div className="flex flex-wrap gap-2">
                    {predefinedReplacements.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setReplacement(suggestion)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Résumé de l'entité */}
          {entityText.trim() && replacement.trim() && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Résumé de l'entité</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-700">📝 Texte:</span>
                  <span className="font-mono bg-white px-2 py-1 rounded border">
                    "{entityText.trim()}"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">🏷️ Type:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${ENTITY_TYPE_COLORS[entityType]}`}>
                    {ENTITY_TYPE_ICONS[entityType]} {entityType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">🔄 Remplacement:</span>
                  <span className="font-mono bg-white px-2 py-1 rounded border">
                    "{replacement.trim()}"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">📊 Occurrences:</span>
                  <span className="text-green-800">
                    ~{textPreview?.toLowerCase().split(entityText.toLowerCase()).length - 1 || 0} dans le document
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Aperçu des modifications */}
          {previewText && (
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
              
              {showPreview && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800 mb-2 font-medium">
                    Aperçu du texte avec votre ajout :
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
              onClick={handleSubmit}
              disabled={!entityText.trim() || !replacement.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter l'entité
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEntityModal;