
import React, { useState } from 'react';
import KeyIcon from './icons/KeyIcon';
import XIcon from './icons/XIcon';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  onClose: () => void;
  error: string | null;
  t: any;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onClose, error, t }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    onSave(apiKey);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="api-key-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 sm:h-12 sm:w-12">
              <KeyIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <h2 id="api-key-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {t.api_key_modal_title}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t.terms_close_button_aria}
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t.api_key_modal_description}{' '}
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t.api_key_modal_obtaining_link}
            </a>.
          </p>
          <div>
            <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.api_key_modal_input_label}
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t.api_key_modal_placeholder}
              className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
           <button 
            onClick={handleSave} 
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors duration-200 disabled:opacity-50"
            disabled={!apiKey.trim()}
          >
            {t.api_key_modal_save_button}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
