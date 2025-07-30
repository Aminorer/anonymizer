import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useAnonymizerStore } from '../stores/anonymizerStore';
import { generateAnonymizedDocument } from '../services/api';

const EntityControlPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    sessionId,
    filename,
    entities,
    getSelectedEntities,
    setGenerating,
    setError,
    isGenerating
  } = useAnonymizerStore();

  const handleGenerateDocument = async () => {
    if (!sessionId) return;

    try {
      setGenerating(true);
      const selectedEntities = getSelectedEntities();
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

  if (!sessionId) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{filename}</h1>
              <p className="text-gray-600">{entities.length} entités détectées</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Entités détectées</h2>
          
          {entities.length === 0 ? (
            <p className="text-gray-500">Aucune entité détectée</p>
          ) : (
            <div className="space-y-4">
              {entities.map((entity) => (
                <div key={entity.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={entity.selected}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-mono">"{entity.text}"</div>
                      <div className="text-sm text-gray-500">
                        {entity.type} • {entity.source} • {Math.round(entity.confidence * 100)}%
                      </div>
                    </div>
                    <input
                      type="text"
                      value={entity.replacement}
                      className="px-3 py-1 border rounded"
                      placeholder="Remplacement"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={handleGenerateDocument}
              disabled={isGenerating}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Génération...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Générer document anonymisé
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityControlPage;