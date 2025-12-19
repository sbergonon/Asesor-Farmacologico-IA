import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { drugDatabase, type DrugInfo } from '../data/drugNames';
import { supplementDatabase, type SupplementInfo } from '../data/supplements';
import { pgxGeneGroups } from '../data/pgxGenes';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import SaveIcon from './icons/SaveIcon';
import type { Medication, SupplementInteraction, ProactiveAlert } from '../types';
import { analyzeSupplementInteractions, getDetailedInteractionInfo } from '../services/geminiService';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import { drugSynonymMap } from '../data/drugSynonyms';
import ProBadge from './ProBadge';
import { criticalAllergyRules, criticalConditionRules, criticalDrugInteractionRules } from '../data/proactiveAlerts';
import MedicationItem from './MedicationItem';
import ChevronDownIcon from './icons/ChevronDownIcon';
// Added missing import for ArrowPathIcon
import ArrowPathIcon from './icons/ArrowPathIcon';

interface InteractionFormProps {
  patientId: string;
  setPatientId: (value: string) => void;
  medications: Medication[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  allergies: string;
  setAllergies: (value: string) => void;
  otherSubstances: string;
  setOtherSubstances: (value: string) => void;
  pharmacogenetics: string;
  setPharmacogenetics: (value: string) => void;
  conditions: string;
  setConditions: (value: string) => void;
  dateOfBirth: string;
  setDateOfBirth: (value: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onSaveProfile: () => void;
  existingPatientIds: Set<string>;
  isLoading: boolean;
  isApiKeyMissing: boolean;
  onApiKeyError: () => void;
  t: any;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface DisplaySuggestion extends DrugInfo {
  subtitle?: string;
  source: 'local' | 'api';
  matchScore: number;
  matchedTerm?: string;
  type?: 'generic' | 'brand';
  genericName?: string;
}

const InteractionForm: React.FC<InteractionFormProps> = ({
  patientId, setPatientId, medications, setMedications, allergies, setAllergies, 
  otherSubstances, setOtherSubstances, pharmacogenetics, setPharmacogenetics, 
  conditions, setConditions, dateOfBirth, setDateOfBirth, onAnalyze, onClear, 
  onSaveProfile, existingPatientIds, isLoading, isApiKeyMissing, onApiKeyError, t,
}) => {
  const [currentMedication, setCurrentMedication] = useState('');
  const [suggestions, setSuggestions] = useState<DisplaySuggestion[]>([]);
  const debouncedMedSearch = useDebounce(currentMedication, 250);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const searchIndex = useMemo(() => {
      const list = [];
      drugDatabase.forEach(d => list.push({ term: d.name, type: 'generic', genericName: d.name, data: d }));
      Object.entries(drugSynonymMap).forEach(([brand, generic]) => {
          const gInfo = drugDatabase.find(d => d.name.toLowerCase() === generic.toLowerCase()) || { name: generic };
          list.push({ term: brand, type: 'brand', genericName: gInfo.name, data: gInfo });
      });
      return list;
  }, []);

  const fuse = useMemo(() => new Fuse(searchIndex, { keys: ['term'], threshold: 0.3 }), [searchIndex]);

  useEffect(() => {
    if (debouncedMedSearch.length < 2) { setSuggestions([]); return; }
    const results = fuse.search(debouncedMedSearch).slice(0, 10).map(r => ({
        ...r.item.data,
        name: r.item.type === 'brand' ? r.item.term : r.item.genericName,
        source: 'local',
        type: r.item.type,
        genericName: r.item.genericName,
        matchScore: 1
    }));
    setSuggestions(results as any);
  }, [debouncedMedSearch, fuse]);

  const [currentAllergy, setCurrentAllergy] = useState('');
  const allergyTags = useMemo(() => allergies.split(',').map(a => a.trim()).filter(Boolean), [allergies]);
  
  const handleAddAllergy = () => {
    if (currentAllergy.trim() && !allergyTags.includes(currentAllergy.trim())) {
        setAllergies([...allergyTags, currentAllergy.trim()].join(', '));
    }
    setCurrentAllergy('');
  };

  const [supplementInteractionCache, setSupplementInteractionCache] = useState<Record<string, any>>({});

  const predefinedSubstanceList = useMemo(() => [
    t.substance_st_johns_wort, t.substance_melatonin, t.substance_omega3, t.substance_vitamin_d,
    t.substance_magnesium, t.substance_probiotics, t.substance_collagen, t.substance_mushrooms,
    t.substance_grapefruit_juice, t.substance_cranberry_juice, t.substance_alcohol, t.substance_tobacco,
  ], [t]);

  const { checkedSubstances, customSupplements } = useMemo(() => {
    const allItems = otherSubstances.split(',').map(s => s.trim()).filter(Boolean);
    const checked = new Set(allItems.filter(item => predefinedSubstanceList.includes(item)));
    const custom = allItems.filter(item => !predefinedSubstanceList.includes(item));
    return { checkedSubstances: checked, customSupplements: custom };
  }, [otherSubstances, predefinedSubstanceList]);

  const fetchInteractionForSupplement = useCallback(async (sup: string) => {
      if (medications.length === 0) return;
      setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'loading', data: [] } }));
      try {
          const res = await analyzeSupplementInteractions(sup, medications, t.lang_code);
          setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'completed', data: res } }));
      } catch (e: any) {
          setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'error', data: [], error: e.message } }));
      }
  }, [medications, t.lang_code]);

  useEffect(() => {
    const all = [...customSupplements, ...Array.from(checkedSubstances)];
    all.forEach(sup => {
        if (!supplementInteractionCache[sup]) fetchInteractionForSupplement(sup);
    });
  }, [medications, customSupplements, checkedSubstances, fetchInteractionForSupplement]);

  const activeAlerts = useMemo<ProactiveAlert[]>(() => {
    const alerts: ProactiveAlert[] = [];
    const normalize = (name: string) => {
        const lower = name.toLowerCase().trim();
        return drugSynonymMap[lower] ? drugSynonymMap[lower].toLowerCase() : lower;
    };

    const medNames = medications.map(m => normalize(m.name));
    const allergyList = allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
    const conditionList = conditions.toLowerCase().split(',').map(c => c.trim()).filter(Boolean);

    // Allergies
    allergyList.forEach(a => {
        for (const group in criticalAllergyRules) {
            if (a.includes(group)) {
                medications.forEach(m => {
                    const normMed = normalize(m.name);
                    if (criticalAllergyRules[group].some(ruleMed => normalize(ruleMed) === normMed)) {
                        alerts.push({ id: `a-${m.name}-${group}`, type: 'allergy', title: t.allergy_alert_title, message: t.allergy_alert_text.replace('{medication}', m.name).replace('{allergyGroup}', group) });
                    }
                });
            }
        }
    });

    // Drug-Drug
    criticalDrugInteractionRules.forEach(rule => {
        if (medNames.includes(normalize(rule.pair[0])) && medNames.includes(normalize(rule.pair[1]))) {
            alerts.push({ id: `ddi-${rule.pair.join('-')}`, type: 'drug-drug', title: t.ddi_alert_title, message: t.ddi_alert_text.replace('{med1}', rule.pair[0]).replace('{med2}', rule.pair[1]).replace('{reason}', t[rule.reasonKey] || rule.reasonKey) });
        }
    });

    // Condition
    conditionList.forEach(c => {
        for (const cond in criticalConditionRules) {
            if (c.includes(cond)) {
                const rule = criticalConditionRules[cond];
                medications.forEach(m => {
                    if (rule.drugs.some(d => normalize(d) === normalize(m.name))) {
                        alerts.push({ id: `c-${m.name}-${cond}`, type: 'condition', title: t.condition_alert_title, message: t.condition_alert_text.replace('{medication}', m.name).replace('{condition}', cond).replace('{reason}', t[rule.reasonKey] || rule.reasonKey) });
                    }
                });
            }
        }
    });

    return alerts;
  }, [medications, allergies, conditions, t]);

  const handleExplainFinding = async (findingId: string, title: string) => {
    if (explanations[findingId]) { 
        setExplanations(prev => { const n = {...prev}; delete n[findingId]; return n; }); 
        return; 
    }
    setExplainingId(findingId);
    try {
        const detail = await getDetailedInteractionInfo(title, medications, conditions, t.lang_code);
        setExplanations(prev => ({ ...prev, [findingId]: detail }));
    } catch (e) {} finally { setExplainingId(null); }
  };

  const hasAnySupplements = [...customSupplements, ...Array.from(checkedSubstances)].length > 0;
  const showRiskPanel = medications.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_patient_id_label}</label>
        <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder={t.form_patient_id_placeholder} className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-blue-500 sm:text-sm transition-all" />
      </div>
      
      <div ref={autocompleteRef}>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_medications_label}</label>
        <div className="flex items-center space-x-2 relative">
          <input 
            type="text" 
            value={currentMedication} 
            onChange={(e) => setCurrentMedication(e.target.value)} 
            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); if(currentMedication.trim()){ setMedications([...medications, { name: currentMedication.trim(), dosage: '', frequency: '' }]); setCurrentMedication(''); } } }}
            placeholder={t.form_medications_placeholder} 
            className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 rounded-md sm:text-sm transition-all" 
          />
          <button onClick={() => { if(currentMedication.trim()){ setMedications([...medications, { name: currentMedication.trim(), dosage: '', frequency: '' }]); setCurrentMedication(''); } }} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"><PlusIcon className="h-5 w-5" /></button>
          {suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-slate-800 shadow-xl rounded-md py-1 border border-slate-200 dark:border-slate-700">
              {suggestions.map((s, idx) => (
                <li key={idx} onClick={() => { setMedications([...medications, { name: s.name, dosage: s.commonDosage || '', frequency: s.commonFrequency || '' }]); setCurrentMedication(''); setSuggestions([]); }} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex flex-col">
                  <span className="font-bold">{s.name}</span> 
                  {s.genericName && s.genericName !== s.name && <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Genérico: {s.genericName}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {medications.map((m, i) => <MedicationItem key={`${m.name}-${i}`} medication={m} index={i} onRemove={() => setMedications(medications.filter((_, idx) => idx !== i))} onChange={(f, v) => { const n = [...medications]; (n[i] as any)[f] = v; setMedications(n); }} t={t} />)}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_allergies_label}</label>
        <div className="flex items-center space-x-2">
            <input type="text" value={currentAllergy} onChange={(e) => setCurrentAllergy(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddAllergy(); } }} placeholder={t.form_allergies_placeholder} className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 rounded-md sm:text-sm transition-all" />
            <button onClick={handleAddAllergy} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all"><PlusIcon className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
            {allergyTags.map(a => <span key={a} className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-xs rounded-full flex items-center border border-red-200 dark:border-red-800">{a}<button onClick={() => setAllergies(allergyTags.filter(x => x !== a).join(', '))} className="ml-1 hover:text-red-900"><TrashIcon className="h-3 w-3"/></button></span>)}
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{t.form_substances_label}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {predefinedSubstanceList.map(s => (
            <label key={s} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded transition-colors">
              <input type="checkbox" checked={checkedSubstances.has(s)} onChange={(e) => { const n = new Set(checkedSubstances); if(e.target.checked) n.add(s); else n.delete(s); setOtherSubstances([...Array.from(n), ...customSupplements].join(', ')); }} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_conditions_label}</label>
        <input type="text" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder={t.form_conditions_placeholder} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 rounded-md transition-all focus:ring-blue-500" />
      </div>

      {showRiskPanel && (
        <div className="mt-8 p-4 bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-900/30 rounded-xl shadow-inner animate-fade-in">
           <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center mb-2">
             <AlertTriangleIcon className="h-6 w-6 mr-2 text-amber-500" />
             {t.realtime_risk_panel_title}
           </h3>
           <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t.realtime_risk_panel_desc}</p>
           
           <div className="space-y-4">
              {activeAlerts.length === 0 && !hasAnySupplements && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center text-xs text-slate-500 italic">
                      <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
                      No se detectan riesgos críticos directos entre los fármacos y condiciones actuales.
                  </div>
              )}

              {activeAlerts.map(alert => (
                <div key={alert.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg flex justify-between items-start gap-2">
                   <div>
                       <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">{alert.title}</h4>
                       <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{alert.message}</p>
                       {explanations[alert.id] && (
                           <div className="mt-2 p-2 bg-white/80 dark:bg-slate-900/80 rounded border border-red-100 text-[10px] text-slate-800 dark:text-slate-200 shadow-sm animate-fade-in whitespace-pre-wrap">
                               {explanations[alert.id]}
                           </div>
                       )}
                   </div>
                   <button 
                    onClick={() => handleExplainFinding(alert.id, alert.title + ": " + alert.message)} 
                    disabled={explainingId === alert.id}
                    className="flex-shrink-0 text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                   >
                       {explainingId === alert.id ? <><ArrowPathIcon className="h-3 w-3 animate-spin inline mr-1"/>...</> : explanations[alert.id] ? "Ocultar" : "IA Info"}
                   </button>
                </div>
              ))}

              {[...customSupplements, ...Array.from(checkedSubstances)].map(sup => {
                 const cache = supplementInteractionCache[sup];
                 if (!cache) return null;
                 if (cache.status === 'loading') return <div key={sup} className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 animate-pulse rounded-lg text-xs italic text-slate-400">Analizando {sup}...</div>;
                 if (cache.status === 'error') return <div key={sup} className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-center"><AlertTriangleIcon className="h-4 w-4 mr-2"/> Error al analizar {sup}: {cache.error?.includes('API key') ? 'Clave API inválida' : 'Servicio no disponible'}</div>;
                 
                 return cache.data.length > 0 ? cache.data.map((int: any, idx: number) => (
                    <div key={`${sup}-${idx}`} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sup} + {int.medication}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1"><strong>{int.riskLevel}:</strong> {int.potentialEffects}</p>
                    </div>
                 )) : (
                     <div key={sup} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center text-xs text-slate-500 italic">
                        <InfoCircleIcon className="h-4 w-4 mr-2 text-blue-500" />
                        No se detectaron interacciones significativas para {sup}.
                    </div>
                 );
              })}
           </div>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button onClick={onClear} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:underline transition-colors">{t.form_clear_button}</button>
        <button onClick={onSaveProfile} disabled={!patientId.trim()} className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-bold shadow-sm hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition-all">{t.form_save_profile_button}</button>
        <button onClick={onAnalyze} disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold shadow-lg flex items-center hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all">
            {isLoading ? <><svg className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full" viewBox="0 0 24 24"></svg> {t.form_analyzing_button}</> : <><SparklesIcon className="h-5 w-5 mr-2"/> {t.form_analyze_button}</>}
        </button>
      </div>
    </div>
  );
};

export default InteractionForm;