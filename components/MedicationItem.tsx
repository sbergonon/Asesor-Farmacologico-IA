
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Medication } from '../types';
import TrashIcon from './icons/TrashIcon';
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

  // Lógica mejorada: Si el valor es el sugerido o está vacío, mostrar TODA la lista.
  const dosageSuggestions = useMemo(() => {
    const list = [...(t.medication_dosages || [])];
    const suggested = drugInfo?.commonDosage;
    if (suggested && !list.includes(suggested)) list.unshift(suggested);
    
    if (!medication.dosage || medication.dosage === suggested) return list;
    return list.filter(s => s.toLowerCase().includes(medication.dosage.toLowerCase()));
  }, [t.medication_dosages, drugInfo, medication.dosage]);

  const frequencySuggestions = useMemo(() => {
    const list = [...(t.medication_frequencies || [])];
    const suggested = drugInfo?.commonFrequency;
    if (suggested && !list.includes(suggested)) list.unshift(suggested);
    
    if (!medication.frequency || medication.frequency === suggested) return list;
    return list.filter(s => s.toLowerCase().includes(medication.frequency.toLowerCase()));
  }, [t.medication_frequencies, drugInfo, medication.frequency]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dosageRef.current && !dosageRef.current.contains(event.target as Node)) setShowDosageDropdown(false);
      if (freqRef.current && !freqRef.current.contains(event.target as Node)) setShowFreqDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:ring-1 hover:ring-blue-500/30">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base truncate">{medication.name}</h4>
        <button type="button" onClick={onRemove} className="inline-flex items-center justify-center h-8 w-8 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Selector de Dosis */}
        <div className="relative" ref={dosageRef}>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">{t.form_dosage_label}</label>
          <div className="relative group">
            <input 
                type="text" 
                value={medication.dosage} 
                onChange={(e) => { onChange('dosage', e.target.value); setShowDosageDropdown(true); }} 
                onFocus={() => setShowDosageDropdown(true)} 
                placeholder={t.form_dosage_placeholder} 
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" 
                autoComplete="off" 
            />
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          {showDosageDropdown && dosageSuggestions.length > 0 && (
            <ul className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 py-1.5 text-sm shadow-2xl ring-1 ring-black/5 border border-slate-200 dark:border-slate-700">
              {dosageSuggestions.map((s, i) => (
                <li key={i} className="cursor-pointer py-2.5 px-4 hover:bg-blue-600 hover:text-white transition-colors flex justify-between items-center" onClick={() => { onChange('dosage', s); setShowDosageDropdown(false); }}>
                  <span>{s}</span>
                  {s === drugInfo?.commonDosage && <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded uppercase font-black">Sugerido</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selector de Frecuencia */}
        <div className="relative" ref={freqRef}>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">{t.form_frequency_label}</label>
          <div className="relative group">
            <input 
                type="text" 
                value={medication.frequency} 
                onChange={(e) => { onChange('frequency', e.target.value); setShowFreqDropdown(true); }} 
                onFocus={() => setShowFreqDropdown(true)} 
                placeholder={t.form_frequency_placeholder} 
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" 
                autoComplete="off" 
            />
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          {showFreqDropdown && frequencySuggestions.length > 0 && (
            <ul className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 py-1.5 text-sm shadow-2xl ring-1 ring-black/5 border border-slate-200 dark:border-slate-700">
              {frequencySuggestions.map((s, i) => (
                <li key={i} className="cursor-pointer py-2.5 px-4 hover:bg-blue-600 hover:text-white transition-colors flex justify-between items-center" onClick={() => { onChange('frequency', s); setShowFreqDropdown(false); }}>
                  <span>{s}</span>
                  {s === drugInfo?.commonFrequency && <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded uppercase font-black">Sugerido</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="mt-3 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase hover:text-blue-700 flex items-center tracking-widest">
        {isExpanded ? t.form_hide_optional_details : t.form_add_optional_details}
        <ChevronDownIcon className={`ml-1 h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.form_effects_label}</label>
            <textarea rows={2} value={medication.potentialEffects || ''} onChange={(e) => onChange('potentialEffects', e.target.value)} placeholder={t.form_effects_placeholder} className="block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.form_recommendations_label}</label>
            <textarea rows={2} value={medication.recommendations || ''} onChange={(e) => onChange('recommendations', e.target.value)} placeholder={t.form_recommendations_placeholder} className="block w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationItem;
