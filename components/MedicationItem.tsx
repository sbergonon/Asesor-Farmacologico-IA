
import React, { useState } from 'react';
import type { Medication } from '../types';
import TrashIcon from './icons/TrashIcon';
import ProBadge from './ProBadge';

interface MedicationItemProps {
  medication: Medication;
  index: number;
  onRemove: () => void;
  onChange: (field: keyof Medication, value: string) => void;
  t: any;
}

const MedicationItem: React.FC<MedicationItemProps> = ({ 
  medication, 
  index, 
  onRemove, 
  onChange, 
  t 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{medication.name}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 -mt-1 -mr-1 flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
          title={t.form_remove_med_sr.replace('{med}', medication.name)}
        >
          <span className="sr-only">{t.form_remove_med_sr.replace('{med}', medication.name)}</span>
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <label htmlFor={`dosage-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t.form_dosage_label}
          </label>
          <input
            id={`dosage-${index}`}
            type="text"
            list={`dosage-options-${index}`}
            value={medication.dosage}
            onChange={(e) => onChange('dosage', e.target.value)}
            placeholder={t.form_dosage_placeholder}
            className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
          />
          <datalist id={`dosage-options-${index}`}>
              {t.medication_dosages && t.medication_dosages.map((dose: string) => (
                  <option key={dose} value={dose} />
              ))}
          </datalist>
        </div>
        <div>
          <label htmlFor={`frequency-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t.form_frequency_label}
          </label>
          <input
            id={`frequency-${index}`}
            type="text"
            list={`frequency-options-${index}`}
            value={medication.frequency}
            onChange={(e) => onChange('frequency', e.target.value)}
            placeholder={t.form_frequency_placeholder}
            className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
          />
          <datalist id={`frequency-options-${index}`}>
              {t.medication_frequencies && t.medication_frequencies.map((freq: string) => (
                  <option key={freq} value={freq} />
              ))}
          </datalist>
        </div>
      </div>

      <div className="mt-2 flex items-center">
        <button 
          type="button" 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none flex items-center"
        >
          {isExpanded ? t.form_hide_optional_details : t.form_add_optional_details}
        </button>
        <div className="ml-2 transform scale-90 origin-left">
             <ProBadge />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
          <div>
            <label htmlFor={`effects-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.form_effects_label}
            </label>
            <textarea
              id={`effects-${index}`}
              rows={2}
              value={medication.potentialEffects || ''}
              onChange={(e) => onChange('potentialEffects', e.target.value)}
              placeholder={t.form_effects_placeholder}
              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
            />
          </div>
          <div>
            <label htmlFor={`recommendations-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.form_recommendations_label}
            </label>
            <textarea
              id={`recommendations-${index}`}
              rows={2}
              value={medication.recommendations || ''}
              onChange={(e) => onChange('recommendations', e.target.value)}
              placeholder={t.form_recommendations_placeholder}
              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
            />
          </div>
          <div>
            <label htmlFor={`references-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.form_references_label}
            </label>
            <input
              id={`references-${index}`}
              type="text"
              value={medication.references || ''}
              onChange={(e) => onChange('references', e.target.value)}
              placeholder={t.form_references_placeholder}
              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationItem;
