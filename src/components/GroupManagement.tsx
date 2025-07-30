import React from 'react';
import { Users, Trash2, Edit3, ChevronDown, ChevronRight } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_ICONS } from '../types/entities';

interface GroupManagementProps {
  className?: string;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ className = '' }) => {
  const { 
    entityGroups, 
    entities, 
    removeEntityGroup,
    setEditingEntity,
    setShowEditModal
  } = useAnonymizerStore();

  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleRemoveGroup = (groupId: string, groupName: string) => {
    if (confirm(`Supprimer le groupe "${groupName}" ? Les entités retrouveront leurs remplacements individuels.`)) {
      removeEntityGroup(groupId);
    }
  };

  const getGroupEntities = (entityIds: string[]) => {
    return entities.filter(entity => entityIds.includes(entity.id));
  };

  if (entityGroups.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 text-center ${className}`}>
        <Users className="mx-auto text-gray-400 mb-3" size={32} />
        <h3 className="text-gray-600 font-medium mb-2">Aucun groupe créé</h3>
        <p className="text-gray-500 text-sm">
          Sélectionnez plusieurs entités et créez un groupe pour les anonymiser de manière cohérente
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-600" size={20} />
        <h3 className="font-semibold text-gray-800">
          Groupes d'entités ({entityGroups.length})
        </h3>
      </div>

      {entityGroups.map((group) => {
        const groupEntities = getGroupEntities(group.entities);
        const isExpanded = expandedGroups.has(group.id);

        return (
          <div
            key={group.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* En-tête du groupe */}
            <div className="p-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-blue-600" />
                    ) : (
                      <ChevronRight size={16} className="text-blue-600" />
                    )}
                  </button>
                  
                  <div>
                    <h4 className="font-semibold text-blue-800">{group.name}</h4>
                    <div className="text-sm text-blue-600">
                      {group.entities.length} entité(s) → "{group.replacement}"
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-blue-600">
                    Créé le {new Date(group.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                  <button
                    onClick={() => handleRemoveGroup(group.id, group.name)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Supprimer le groupe"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Contenu du groupe (collapsible) */}
            {isExpanded && (
              <div className="p-4 space-y-3">
                
                {/* Résumé du remplacement */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-800 mb-2">
                    🔄 Remplacement unifié
                  </div>
                  <div className="font-mono text-green-700">
                    Toutes les entités ci-dessous → "{group.replacement}"
                  </div>
                </div>

                {/* Liste des entités groupées */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Entités incluses dans ce groupe :
                  </div>
                  
                  {groupEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 text-xs rounded-full ${ENTITY_TYPE_COLORS[entity.type]}`}>
                          {ENTITY_TYPE_ICONS[entity.type]} {entity.type}
                        </div>
                        
                        <div>
                          <div className="font-mono text-sm">
                            "{entity.text}"
                          </div>
                          <div className="text-xs text-gray-500">
                            {entity.occurrences} occurrence(s) • {entity.source} • {Math.round(entity.confidence * 100)}%
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingEntity(entity);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-white hover:text-blue-600 rounded-lg transition-colors"
                        title="Modifier cette entité"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Statistiques du groupe */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {group.entities.length}
                      </div>
                      <div className="text-xs text-gray-600">Entités</div>
                    </div>
                    
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {groupEntities.reduce((sum, entity) => sum + entity.occurrences, 0)}
                      </div>
                      <div className="text-xs text-gray-600">Occurrences</div>
                    </div>
                    
                    <div>
                      <div className="text-lg font-semibold text-purple-600">
                        {Math.round(groupEntities.reduce((sum, entity) => sum + entity.confidence, 0) / groupEntities.length * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Confiance moy.</div>
                    </div>
                    
                    <div>
                      <div className="text-lg font-semibold text-orange-600">
                        {new Set(groupEntities.map(e => e.source)).size}
                      </div>
                      <div className="text-xs text-gray-600">Source(s)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Action rapide pour créer un nouveau groupe */}
      <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg p-4 text-center">
        <div className="text-blue-600 mb-2">
          <Users size={24} className="mx-auto" />
        </div>
        <div className="text-sm text-blue-800 font-medium mb-1">
          Créer un nouveau groupe
        </div>
        <div className="text-xs text-blue-600">
          Sélectionnez plusieurs entités dans la liste principale, puis cliquez sur "Grouper"
        </div>
      </div>
    </div>
  );
};

export default GroupManagement;