import React from 'react';
import KeyIcon from './icons/KeyIcon';
import XIcon from './icons/XIcon';

interface ApiKeyModalProps {
  t: any;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ t, onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      aria-labelledby="api-key-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-lg p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t.terms_close_button_aria}
        >
            <XIcon className="h-6 w-6" />
        </button>

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
           <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {t.api_key_modal_warning}
          </p>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row-reverse gap-3">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t.api_key_modal_obtaining_link}
          </a>
           <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 sm:text-sm"
          >
            {t.api_key_modal_close_button}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;