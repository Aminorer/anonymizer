import React from 'react';

interface ButtonAnalyseProps {
  onClick: () => void;
  disabled?: boolean;
}

const ButtonAnalyse: React.FC<ButtonAnalyseProps> = ({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Analyser
  </button>
);

export default ButtonAnalyse;
