
import React, { useEffect } from 'react';
import XIcon from './icons/XIcon';

interface TermsModalProps {
  onClose: () => void;
  t: any;
}

const TermsModal: React.FC<TermsModalProps> = ({ onClose, t }) => {
  // Close modal on escape key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="terms-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="terms-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {t.terms_title}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t.terms_close_button_aria}
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-slate-600 dark:text-slate-300 space-y-4 text-base">
          <p className="font-semibold">{t.terms_intro}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s1_title}</h3>
          <p>{t.terms_s1_text}</p>

          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s2_title}</h3>
          <p dangerouslySetInnerHTML={{ __html: t.terms_s2_text }}></p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s3_title}</h3>
          <p>{t.terms_s3_text}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s4_title}</h3>
          <p>{t.terms_s4_text}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s5_title}</h3>
          <p>{t.terms_s5_text}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s6_title}</h3>
          <p>{t.terms_s6_text}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s7_title}</h3>
          <p>{t.terms_s7_text}</p>
          
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 pt-2">{t.terms_s8_title}</h3>
          <p>{t.terms_s8_text}</p>
        </div>

        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
           <button 
            onClick={onClose} 
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors duration-200"
          >
            {t.terms_close_button}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;