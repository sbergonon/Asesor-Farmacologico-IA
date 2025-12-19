
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Medication } from '../types';
import TrashIcon from './icons/TrashIcon';
import ProBadge from './ProBadge';
import { drugDatabase } from '../data/drugNames';
import ChevronDownIcon from './icons/ChevronDownIcon';

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
  const [showDosageDropdown, setShowDosageDropdown] = useState(false);
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  
  const dosageRef = useRef<HTMLDivElement>(null);
  const freqRef = useRef<HTMLDivElement>(null);

  const drugInfo = useMemo(() => 
    drugDatabase.find(d => d.name.toLowerCase() === medication.name.toLowerCase()),
    [medication.name]
  );

  const dosageSuggestions = useMemo(() => {
    const generic = t.medication_dosages || [];
    const query = medication.dosage.toLowerCase();
    let list = [...generic];
    
    // Add drug-specific dosage if available and not in generic list
    if (drugInfo?.commonDosage && !list.some(d => d.toLowerCase() === drugInfo.commonDosage?.toLowerCase())) {
        list.unshift(drugInfo.commonDosage);
    }
    
    return query ? list.filter(s => s.toLowerCase().includes(query)) : list;
  }, [t.medication_dosages, drugInfo, medication.dosage]);

  const frequencySuggestions = useMemo(() => {
    const generic = t.medication_frequencies || [];
    const query = medication.frequency.toLowerCase();
    let list = [...generic];
    
    if (drugInfo?.commonFrequency && !list.some(f => f.toLowerCase() === drugInfo.commonFrequency?.toLowerCase())) {
        list.unshift(drugInfo.commonFrequency);
    }
    
    return query ? list.filter(s => s.toLowerCase().includes(query)) : list;
  }, [t.medication_frequencies, drugInfo, medication.frequency]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dosageRef.current && !dosageRef.current.contains(event.target as Node)) {
        setShowDosageDropdown(false);
      }
      if (freqRef.current && !freqRef.current.contains(event.target as Node)) {
        setShowFreqDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{medication.name}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 -mt-1 -mr-1 flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none transition-colors duration-200"
          title={t.form_remove_med_sr.replace('{med}', medication.name)}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {/* Dosage Field with Custom Autocomplete */}
        <div className="relative" ref={dosageRef}>
          <label htmlFor={`dosage-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t.form_dosage_label}
          </label>
          <div className="relative">
            <input
              id={`dosage-${index}`}
              type="text"
              value={medication.dosage}
              onChange={(e) => {
                onChange('dosage', e.target.value);
                setShowDosageDropdown(true);
              }}
              onFocus={() => setShowDosageDropdown(true)}
              placeholder={t.form_dosage_placeholder}
              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              autoComplete="off"
            />
            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>
          
          {showDosageDropdown && dosageSuggestions.length > 0 && (
            <ul className="absolute z-40 mt-1 max-h-40 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {dosageSuggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="cursor-pointer select-none py-2 px-3 text-slate-900 dark:text-slate-200 hover:bg-blue-500 hover:text-white transition-colors"
                  onClick={() => {
                    onChange('dosage', suggestion);
                    setShowDosageDropdown(false);
                  }}
                >
                  <span className="font-medium">{suggestion}</span>
                  {suggestion === drugInfo?.commonDosage && (
                    <span className="ml-2 text-[8px] uppercase tracking-tighter opacity-70">(Default)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Frequency Field with Custom Autocomplete */}
        <div className="relative" ref={freqRef}>
          <label htmlFor={`frequency-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t.form_frequency_label}
          </label>
          <div className="relative">
            <input
              id={`frequency-${index}`}
              type="text"
              value={medication.frequency}
              onChange={(e) => {
                onChange('frequency', e.target.value);
                setShowFreqDropdown(true);
              }}
              onFocus={() => setShowFreqDropdown(true)}
              placeholder={t.form_frequency_placeholder}
              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              autoComplete="off"
            />
            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {showFreqDropdown && frequencySuggestions.length > 0 && (
            <ul className="absolute z-40 mt-1 max-h-40 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {frequencySuggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="cursor-pointer select-none py-2 px-3 text-slate-900 dark:text-slate-200 hover:bg-blue-500 hover:text-white transition-colors"
                  onClick={() => {
                    onChange('frequency', suggestion);
                    setShowFreqDropdown(false);
                  }}
                >
                  <span className="font-medium">{suggestion}</span>
                  {suggestion === drugInfo?.commonFrequency && (
                    <span className="ml-2 text-[8px] uppercase tracking-tighter opacity-70">(Default)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
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
