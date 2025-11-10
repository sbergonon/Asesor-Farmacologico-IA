
import React from 'react';
import KeyIcon from './icons/KeyIcon';

interface ApiKeyModalProps {
  t: any;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ t }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      aria-labelledby="api-key-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-lg p-6 text-center"
      >
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
          <KeyIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 id="api-key-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-200">
          {t.api_key_modal_title}
        </h2>
        <div className="mt-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t.api_key_modal_description}
          </p>
        </div>
        <div className="mt-5">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t.api_key_modal_obtaining_link}
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
