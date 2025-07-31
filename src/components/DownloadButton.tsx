import React from 'react';
import { Download } from 'lucide-react';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  generating?: boolean;
  count?: number;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ onClick, disabled, generating, count }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {generating ? (
      <>
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
        Génération...
      </>
    ) : (
      <>
        <Download size={16} />
        Générer{typeof count === 'number' ? ` (${count})` : ''}
      </>
    )}
  </button>
);

export default DownloadButton;
