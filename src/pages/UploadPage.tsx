// src/pages/UploadPage.tsx - Avec test de connexion backend
import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Shield, Upload, AlertCircle, CheckCircle, WifiOff } from 'lucide-react';
import { analyzeDocument, testConnection } from '../services/api';
import { useAnonymizerStore } from '../stores/anonymizerStore';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'standard' | 'approfondi'>('standard');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const { setSessionData, setEntities, setAnalyzing, setError, error, isAnalyzing } = useAnonymizerStore();

  // Test de connexion au démarrage
  useEffect(() => {
    const checkBackend = async () => {
      const isConnected = await testConnection();
      setBackendStatus(isConnected ? 'connected' : 'disconnected');
    };
    checkBackend();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Vérifier la connexion avant upload
    if (backendStatus !== 'connected') {
      setError('❌ Backend non connecté. Vérifiez que FastAPI fonctionne sur le port 8080.');
      return;
    }

    try {
      setError(null);
      setAnalyzing(true);

      console.log('🚀 Upload du fichier:', file.name, 'Mode:', mode);
      const response = await analyzeDocument(file, mode);
      
      console.log('✅ Réponse reçue:', response);
      setSessionData(response.session_id, response.filename, response.text_preview);
      setEntities(response.entities, response.stats);
      
      navigate('/control');
      
    } catch (err) {
      console.error('❌ Erreur upload:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'analyse du document';
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  }, [mode, navigate, setSessionData, setEntities, setAnalyzing, setError, backendStatus]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isAnalyzing || backendStatus !== 'connected'
  });

  const retryConnection = async () => {
    setBackendStatus('checking');
    const isConnected = await testConnection();
    setBackendStatus(isConnected ? 'connected' : 'disconnected');
  };

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
        
        {/* Statut de connexion backend */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {backendStatus === 'checking' && (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span className="text-sm opacity-75">Vérification du backend...</span>
            </>
          )}
          {backendStatus === 'connected' && (
            <>
              <CheckCircle size={16} className="text-green-300" />
              <span className="text-sm opacity-75">Backend connecté (port 8080)</span>
            </>
          )}
          {backendStatus === 'disconnected' && (
            <>
              <WifiOff size={16} className="text-red-300" />
              <span className="text-sm opacity-75">Backend déconnecté</span>
              <button
                onClick={retryConnection}
                className="ml-2 text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 transition-colors"
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6">
        {/* Message d'erreur de connexion */}
        {backendStatus === 'disconnected' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <WifiOff size={24} className="text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800 mb-2">Backend non connecté</h3>
                <div className="text-red-700 text-sm space-y-2">
                  <p>Vérifiez que FastAPI fonctionne correctement :</p>
                  <div className="bg-red-100 rounded p-3 font-mono text-xs">
                    <div>1. Ouvrir un terminal dans le dossier /api</div>
                    <div>2. Exécuter : <strong>uvicorn main:app --host 0.0.0.0 --port 8080</strong></div>
                    <div>3. Vérifier que le serveur démarre sur http://localhost:8080</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : isAnalyzing || backendStatus !== 'connected'
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
            ) : backendStatus !== 'connected' ? (
              <>
                <WifiOff size={64} className="mx-auto mb-4 text-red-400" />
                <h3 className="text-2xl font-semibold mb-2 text-red-600">
                  Backend non disponible
                </h3>
                <p className="text-red-600">
                  Démarrez FastAPI sur le port 8080 avant de continuer
                </p>
              </>
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

          {!isAnalyzing && backendStatus === 'connected' && (
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