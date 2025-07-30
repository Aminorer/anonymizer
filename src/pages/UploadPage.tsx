import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Shield, Upload, AlertCircle } from 'lucide-react';
import { analyzeDocument } from '../services/api';
import { useAnonymizerStore } from '../stores/anonymizerStore';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'standard' | 'approfondi'>('standard');
  const { setSessionData, setEntities, setAnalyzing, setError, error, isAnalyzing } = useAnonymizerStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setError(null);
      setAnalyzing(true);

      const response = await analyzeDocument(file, mode);
      
      setSessionData(response.session_id, response.filename, response.text_preview);
      setEntities(response.entities, response.stats);
      
      navigate('/control');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'analyse du document';
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  }, [mode, navigate, setSessionData, setEntities, setAnalyzing, setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isAnalyzing
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      <header className="text-center py-12 text-white">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-4">
          <Shield size={48} className="text-blue-200" />
          Anonymiseur Juridique RGPD v2.0
        </h1>
        <p className="text-xl mt-4 opacity-90">
          Architecture Vercel + DistilCamemBERT • Séparation REGEX/NER
        </p>
      </header>

      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : isAnalyzing
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
            }`}
          >
            <input {...getInputProps()} />
            
            {isAnalyzing ? (
              <div className="space-y-4">
                <div className="animate-spin mx-auto w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <h3 className="text-2xl font-semibold text-gray-600">
                  Analyse en cours...
                </h3>
                <p className="text-gray-500">
                  {mode === 'standard' ? 'Mode standard : 2-5 secondes' : 'Mode approfondi : 5-15 secondes'}
                </p>
              </div>
            ) : (
              <>
                <Upload size={64} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-2xl font-semibold mb-2">
                  Glissez votre document ici
                </h3>
                <p className="text-gray-600 mb-6">
                  <strong>Formats :</strong> PDF, DOCX • <strong>Max :</strong> 50MB
                </p>
                
                <button 
                  type="button"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Sélectionner un fichier
                </button>
              </>
            )}
          </div>

          {!isAnalyzing && (
            <div className="bg-gray-50 rounded-lg p-6 mt-6">
              <h4 className="font-semibold mb-4">Mode d'analyse :</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="standard"
                    checked={mode === 'standard'}
                    onChange={(e) => setMode(e.target.value as 'standard')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium">Standard (2-5s)</div>
                    <div className="text-sm text-gray-600">
                      REGEX uniquement • Données structurées
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="approfondi"
                    checked={mode === 'approfondi'}
                    onChange={(e) => setMode(e.target.value as 'approfondi')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium">Approfondi (5-15s)</div>
                    <div className="text-sm text-gray-600">
                      REGEX + NER DistilCamemBERT • Noms et organisations
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Erreur</h4>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;