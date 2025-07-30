import React from 'react';
import { Filter, Cpu, Brain, User, BarChart3 } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';

interface SourceFiltersProps {
  className?: string;
}

const SourceFilters: React.FC<SourceFiltersProps> = ({ className = '' }) => {
  const { 
    entities, 
    sourceFilters, 
    setSourceFilter,
    stats
  } = useAnonymizerStore();

  // Statistiques par source
  const sourceStats = React.useMemo(() => {
    const stats = { regex: 0, ner: 0, manual: 0 };
    entities.forEach(entity => {
      if (entity.source in stats) {
        stats[entity.source]++;
      }
    });
    return stats;
  }, [entities]);

  const sourceConfig = [
    {
      key: 'regex',
      label: 'REGEX',
      description: 'Données structurées',
      icon: Cpu,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      details: 'Téléphones, emails, SIRET, adresses, références juridiques'
    },
    {
      key: 'ner',
      label: 'NER',
      description: 'DistilCamemBERT',
      icon: Brain,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      details: 'Noms de personnes, organisations détectés par IA'
    },
    {
      key: 'manual',
      label: 'MANUEL',
      description: 'Ajouts utilisateur',
      icon: User,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      details: 'Entités ajoutées manuellement par l\'utilisateur'
    }
  ];

  const totalEntities = entities.length;
  const filteredCount = entities.filter(entity => sourceFilters[entity.source] !== false).length;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      
      {/* En-tête */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="text-gray-600" size={18} />
        <h3 className="font-semibold text-gray-800">Filtres par source</h3>
        <div className="ml-auto text-sm text-gray-500">
          {filteredCount}/{totalEntities} entités affichées
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">{totalEntities}</div>
          <div className="text-xs text-gray-600">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">{filteredCount}</div>
          <div className="text-xs text-gray-600">Affichées</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">
            {entities.filter(e => e.selected && sourceFilters[e.source] !== false).length}
          </div>
          <div className="text-xs text-gray-600">Sélectionnées</div>
        </div>
      </div>

      {/* Filtres par source */}
      <div className="space-y-3">
        {sourceConfig.map((source) => {
          const count = sourceStats[source.key as keyof typeof sourceStats];
          const isEnabled = sourceFilters[source.key] !== false;
          const IconComponent = source.icon;
          
          return (
            <div
              key={source.key}
              className={`border rounded-lg p-3 transition-all ${
                isEnabled 
                  ? `${source.bgColor} ${source.borderColor}` 
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setSourceFilter(source.key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <div className="flex items-center gap-2">
                      <IconComponent 
                        size={18} 
                        className={isEnabled ? source.color : 'text-gray-400'} 
                      />
                      <div>
                        <div className={`font-semibold text-sm ${isEnabled ? source.color : 'text-gray-400'}`}>
                          {source.label}
                        </div>
                        <div className={`text-xs ${isEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                          {source.description}
                        </div>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="text-right">
                  <div className={`text-lg font-semibold ${isEnabled ? source.color : 'text-gray-400'}`}>
                    {count}
                  </div>
                  <div className="text-xs text-gray-500">
                    {totalEntities > 0 ? Math.round((count / totalEntities) * 100) : 0}%
                  </div>
                </div>
              </div>

              {/* Détails de la source */}
              <div className={`text-xs mt-2 ${isEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                {source.details}
              </div>

              {/* Barre de progression */}
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isEnabled ? source.color.replace('text-', 'bg-') : 'bg-gray-300'
                    }`}
                    style={{
                      width: totalEntities > 0 ? `${(count / totalEntities) * 100}%` : '0%'
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions rapides */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            setSourceFilter('regex', true);
            setSourceFilter('ner', true);
            setSourceFilter('manual', true);
          }}
          className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tout afficher
        </button>
        <button
          onClick={() => {
            setSourceFilter('regex', false);
            setSourceFilter('ner', false);
            setSourceFilter('manual', false);
          }}
          className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Tout masquer
        </button>
      </div>

      {/* Séparation REGEX/NER explicite */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={14} className="text-yellow-600" />
          <div className="text-xs font-semibold text-yellow-800">
            Séparation stricte REGEX/NER
          </div>
        </div>
        <div className="text-xs text-yellow-700 space-y-1">
          <div>• <strong>REGEX :</strong> Données structurées fiables (téléphone, SIRET...)</div>
          <div>• <strong>NER :</strong> Entités complexes (noms, organisations)</div>
          <div>• <strong>MANUEL :</strong> Ajouts utilisateur personnalisés</div>
        </div>
      </div>
    </div>
  );
};

export default SourceFilters;