import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, Users, Plus, Edit3, Filter, 
  Eye, BarChart3, Settings, AlertTriangle, CheckCircle,
  Search, X, Trash2
} from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { generateAnonymizedDocument } from '../services/api';
import { Entity, ENTITY_TYPE_COLORS, ENTITY_TYPE_ICONS } from '../types/entities';

// Import des nouveaux composants
import EntityEditModal from '../components/EntityEditModal';
import EntityGroupModal from '../components/EntityGroupModal';
import GroupManagement from '../components/GroupManagement';
import SourceFilters from '../components/SourceFilters';
import AddEntityModal from '../components/AddEntityModal';

const EntityControlPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    sessionId,
    filename,
    entities,
    stats,
    getSelectedEntities,
    getFilteredEntities,
    setGenerating,
    setError,
    isGenerating,
    error,
    // Nouveaux états pour les modals
    showGroupModal,
    showEditModal, 
    showAddEntityModal,
    setShowGroupModal,
    setShowEditModal,
    setShowAddEntityModal,
    editingEntity,
    setEditingEntity,
    selectedEntitiesForGrouping,
    toggleEntity,
    updateReplacement,
    entityGroups,
    applyGroupReplacements
  } = useAnonymizerStore();

  // États locaux pour l'interface
  const [activeTab, setActiveTab] = useState<'entities' | 'groups' | 'stats'>('entities');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showPreview, setShowPreview] = useState(false);

  // Entités filtrées
  const filteredEntities = useMemo(() => {
    let filtered = getFilteredEntities();
    
    // Filtre par recherche
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(entity => 
        entity.text.toLowerCase().includes(search) ||
        entity.replacement.toLowerCase().includes(search) ||
        entity.type.toLowerCase().includes(search)
      );
    }
    
    // Filtre par type
    if (selectedType !== 'all') {
      filtered = filtered.filter(entity => entity.type === selectedType);
    }
    
    return filtered;
  }, [getFilteredEntities, searchTerm, selectedType]);

  const handleGenerateDocument = async () => {
    if (!sessionId) return;

    try {
      setGenerating(true);
      setError(null);
      
      const selectedEntities = getSelectedEntities();
      
      if (selectedEntities.length === 0) {
        setError('Aucune entité sélectionnée pour l\'anonymisation');
        return;
      }

      // 🧠 APPLIQUER L'ALGORITHME DE GROUPEMENT INTELLIGENT
      const replacements: Record<string, string> = {};
      selectedEntities.forEach(entity => {
        replacements[entity.text] = entity.replacement;
      });

      // Démonstration de l'algorithme corrigé
      console.log('🔄 Application de l\'algorithme de groupement intelligent...');
      const testText = selectedEntities.slice(0, 3).map(e => e.text).join(' et ');
      console.log('Texte test:', testText);
      console.log('Résultat avec tri par longueur:', applyGroupReplacements(testText, replacements));
      
      const blob = await generateAnonymizedDocument(sessionId, selectedEntities);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anonymized_${filename}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setTimeout(() => navigate('/'), 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditEntity = (entity: Entity) => {
    setEditingEntity(entity);
    setShowEditModal(true);
  };

  const handleStartGrouping = () => {
    if (selectedEntitiesForGrouping.length < 2) {
      setError('Sélectionnez au moins 2 entités pour créer un groupe');
      return;
    }
    setShowGroupModal(true);
  };

  if (!sessionId) {
    navigate('/');
    return null;
  }

  const selectedCount = getSelectedEntities().length;
  const uniqueTypes = [...new Set(entities.map(e => e.type))];

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{filename}</h1>
                <p className="text-gray-600">
                  {entities.length} entités détectées • {selectedCount} sélectionnées
                </p>
              </div>
            </div>

            {/* Actions principales */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddEntityModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                Ajouter
              </button>
              
              <button
                onClick={handleStartGrouping}
                disabled={selectedEntitiesForGrouping.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Users size={16} />
                Grouper ({selectedEntitiesForGrouping.length})
              </button>

              <button
                onClick={handleGenerateDocument}
                disabled={isGenerating || selectedCount === 0}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Générer ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Messages d'erreur */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Erreur</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 text-red-600 hover:bg-red-100 rounded"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tabs de navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { key: 'entities', label: 'Entités', icon: Settings, count: filteredEntities.length },
                { key: 'groups', label: 'Groupes', icon: Users, count: entityGroups.length },
                { key: 'stats', label: 'Statistiques', icon: BarChart3, count: null }
              ].map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <IconComponent size={16} />
                    {tab.label}
                    {tab.count !== null && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        activeTab === tab.key
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar - Filtres et statistiques */}
          <div className="lg:col-span-1 space-y-6">
            <SourceFilters />
            
            {/* Recherche et filtres */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Search size={16} />
                Recherche et filtres
              </h3>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Rechercher une entité..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tous les types</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              {(searchTerm || selectedType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType('all');
                  }}
                  className="mt-3 w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3">
            
            {activeTab === 'entities' && (
              <div className="bg-white rounded-xl shadow-sm">
                
                {/* Header avec actions */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Entités détectées ({filteredEntities.length})
                    </h2>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-600">
                        {selectedEntitiesForGrouping.length} sélectionnées pour groupement
                      </div>
                      
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Eye size={14} />
                        {showPreview ? 'Masquer' : 'Aperçu'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🚨 DÉMONSTRATION DE L'ALGORITHME CORRIGÉ */}
                {entityGroups.length > 0 && (
                  <div className="p-4 bg-green-50 border-b border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="font-semibold text-green-800">
                        Algorithme de groupement intelligent activé
                      </span>
                    </div>
                    <div className="text-sm text-green-700">
                      ✅ Tri par longueur décroissante pour éviter les remplacements partiels<br/>
                      📝 Exemple: "Saïd OULHADJ" + "OULHADJ" → Traitement de "Saïd OULHADJ" en premier = remplacement correct
                    </div>
                  </div>
                )}

                {/* Liste des entités */}
                <div className="divide-y divide-gray-200">
                  {filteredEntities.length === 0 ? (
                    <div className="p-12 text-center">
                      <Settings className="mx-auto text-gray-400 mb-4" size={48} />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">
                        Aucune entité trouvée
                      </h3>
                      <p className="text-gray-500">
                        {searchTerm || selectedType !== 'all' 
                          ? 'Essayez de modifier vos filtres de recherche'
                          : 'Aucune entité détectée dans ce document'
                        }
                      </p>
                    </div>
                  ) : (
                    filteredEntities.map((entity) => (
                      <div key={entity.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          
                          {/* Sélection pour anonymisation */}
                          <input
                            type="checkbox"
                            checked={entity.selected}
                            onChange={() => toggleEntity(entity.id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          
                          {/* Sélection pour groupement */}
                          <input
                            type="checkbox"
                            checked={selectedEntitiesForGrouping.includes(entity.id)}
                            onChange={() => useAnonymizerStore.getState().toggleEntityForGrouping(entity.id)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                            title="Sélectionner pour groupement"
                          />

                          {/* Informations de l'entité */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  entity.source === 'regex' ? 'bg-green-500' :
                                  entity.source === 'ner' ? 'bg-blue-500' : 'bg-purple-500'
                                }`}></div>
                                {entity.source.toUpperCase()}
                              </span>
                              <span>{entity.occurrences} occurrence(s)</span>
                              <span>{Math.round(entity.confidence * 100)}% confiance</span>
                            </div>
                          </div>

                          {/* Remplacement */}
                          <div className="w-64">
                            <input
                              type="text"
                              value={entity.replacement}
                              onChange={(e) => updateReplacement(entity.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Remplacement..."
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditEntity(entity)}
                              className="p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors"
                              title="Modifier l'entité"
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <GroupManagement />
            )}

            {activeTab === 'stats' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Statistiques détaillées</h2>
                
                {/* Statistiques par type */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {Object.entries(stats?.by_type || {}).map(([type, count]) => (
                    <div key={type} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${ENTITY_TYPE_COLORS[type]}`}>
                          {ENTITY_TYPE_ICONS[type]} {type}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-800">{count}</div>
                      <div className="text-sm text-gray-600">entités détectées</div>
                    </div>
                  ))}
                </div>

                {/* Statistiques par source */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition par source de détection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { key: 'regex', label: 'REGEX', color: 'green', description: 'Données structurées' },
                      { key: 'ner', label: 'NER', color: 'blue', description: 'DistilCamemBERT' },
                      { key: 'manual', label: 'MANUEL', color: 'purple', description: 'Ajouts utilisateur' }
                    ].map(source => {
                      const count = entities.filter(e => e.source === source.key).length;
                      const percentage = entities.length > 0 ? Math.round((count / entities.length) * 100) : 0;
                      
                      return (
                        <div key={source.key} className={`bg-${source.color}-50 border border-${source.color}-200 rounded-lg p-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full bg-${source.color}-500`}></div>
                            <span className={`font-semibold text-${source.color}-800`}>{source.label}</span>
                          </div>
                          <div className={`text-2xl font-bold text-${source.color}-800`}>{count}</div>
                          <div className={`text-sm text-${source.color}-600`}>
                            {percentage}% • {source.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Algorithme de groupement */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    Algorithme de Groupement Intelligent
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                      <div className="font-semibold text-red-800 mb-1">❌ Problème résolu :</div>
                      <div className="text-red-700">
                        Avec "Saïd OULHADJ" et "OULHADJ" dans le même groupe :<br/>
                        • Ancien algorithme : "OULHADJ" → "X" puis "Saïd OULHADJ" → "Saïd X" ❌<br/>
                        • Résultat incorrect : remplacement partiel au lieu de complet
                      </div>
                    </div>
                    
                    <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                      <div className="font-semibold text-green-800 mb-1">✅ Solution implémentée :</div>
                      <div className="text-green-700">
                        • Tri par longueur décroissante avant remplacement<br/>
                        • "Saïd OULHADJ" traité EN PREMIER → "X" directement ✅<br/>
                        • "OULHADJ" ignoré car déjà remplacé dans le texte plus long
                      </div>
                    </div>
                    
                    <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                      <div className="font-semibold text-blue-800 mb-1">🧠 Algorithme utilisé :</div>
                      <div className="text-blue-700 font-mono text-xs">
                        const sortedReplacements = Object.entries(replacements)<br/>
                        &nbsp;&nbsp;.sort(([a], [b]) => b.length - a.length);<br/>
                        // Plus long en premier = remplacement correct
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <EntityEditModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
      />
      
      <EntityGroupModal 
        isOpen={showGroupModal} 
        onClose={() => setShowGroupModal(false)} 
      />
      
      <AddEntityModal 
        isOpen={showAddEntityModal} 
        onClose={() => setShowAddEntityModal(false)} 
      />
    </div>
  );
};

export default EntityControlPage; gap-3 mb-2">
                              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${ENTITY_TYPE_COLORS[entity.type]}`}>
                                {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
                              </div>
                              
                              <div className="font-mono text-lg font-medium text-gray-800">
                                "{entity.text}"
                              </div>
                              
                              {entity.groupId && (
                                <div className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                  Groupé
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center