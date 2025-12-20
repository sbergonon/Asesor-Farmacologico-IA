
import React, { useEffect } from 'react';
import XIcon from './icons/XIcon';
import { translations } from '../lib/translations';

interface ManualModalProps {
  onClose: () => void;
}

const ManualModal: React.FC<ManualModalProps> = ({ onClose }) => {
  const lang = navigator.language.split('-')[0] === 'es' ? 'es' : 'en';
  // Fix: Cast translations[lang] to any to prevent property access errors from incomplete en translation object
  const t = (translations as any)[lang];
  const m = t.manual_content;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="manual-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <h2 id="manual-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {t.manual_button_title}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-slate-700 dark:text-slate-300 space-y-6 text-base leading-relaxed">
            <section>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">{m.intro_title}</h3>
                <p>{m.intro_text}</p>
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-sm mb-1">{m.roles_title}</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                        <li><strong>{m.role_personal}</strong></li>
                        <li><strong>{m.role_professional}</strong></li>
                        <li><strong>{m.role_admin}</strong></li>
                    </ul>
                </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">{m.personal_guide_title}</h3>
                <ol className="list-decimal pl-5 space-y-2 mt-2">
                    <li>{m.personal_step1}</li>
                    <li>{m.personal_step2}</li>
                    <li>{m.personal_step3}</li>
                    <li>{m.personal_step4}</li>
                    <li>{m.personal_step5}</li>
                </ol>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-teal-600 dark:text-teal-400 mb-2">{m.pro_guide_title}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                        <h4 className="text-lg font-semibold">{t.tab_patients}</h4>
                        <p className="text-sm">{m.pro_patients}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                        <h4 className="text-lg font-semibold">{t.mode_batch}</h4>
                        <p className="text-sm">{m.pro_batch}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                        <h4 className="text-lg font-semibold">{t.tab_investigator}</h4>
                        <p className="text-sm">{m.pro_investigator}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                        <h4 className="text-lg font-semibold">{t.tab_dashboard}</h4>
                        <p className="text-sm">{m.pro_dashboard}</p>
                    </div>
                </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">{m.admin_guide_title}</h3>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li>{m.admin_sources}</li>
                    <li>{m.admin_users}</li>
                    <li>{m.admin_global}</li>
                </ul>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            {m.coexistence_title && (
              <section className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                  <h3 className="text-2xl font-bold text-amber-700 dark:text-amber-400 mb-2">{m.coexistence_title}</h3>
                  <p className="text-sm italic">{m.coexistence_text}</p>
              </section>
            )}
        </div>

        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
           <button 
            onClick={onClose} 
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200"
          >
            {t.terms_close_button}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualModal;
