
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { drugDatabase, type DrugInfo } from '../data/drugNames';
import { drugSynonymMap } from '../data/drugSynonyms';
import { supplementDatabase, type SupplementInfo } from '../data/supplements';
import { pgxGeneGroups } from '../data/pgxGenes';
import { commonConditions } from '../data/conditions';
import { criticalAllergyRules, criticalConditionRules, criticalDrugInteractionRules } from '../data/proactiveAlerts';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import MedicationItem from './MedicationItem';
import { analyzeSupplementInteractions, getDetailedInteractionInfo } from '../services/geminiService';
import type { Medication, SupplementInteraction, ProactiveAlert } from '../types';

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

const InteractionForm: React.FC<InteractionFormProps> = ({
  patientId, setPatientId, medications, setMedications, allergies, setAllergies, 
  otherSubstances, setOtherSubstances, pharmacogenetics, setPharmacogenetics, 
  conditions, setConditions, dateOfBirth, setDateOfBirth, onAnalyze, onClear, 
  onSaveProfile, isLoading, t,
}) => {
  // Autocomplete state for Meds
  const [currentMedication, setCurrentMedication] = useState('');
  const [medSuggestions, setMedSuggestions] = useState<any[]>([]);
  const debouncedMedSearch = useDebounce(currentMedication, 250);

  // Autocomplete state for Supplements
  const [currentSupplement, setCurrentSupplement] = useState('');
  const [supSuggestions, setSupSuggestions] = useState<SupplementInfo[]>([]);
  const debouncedSupSearch = useDebounce(currentSupplement, 250);

  // Autocomplete state for Conditions
  const [currentCondition, setCurrentCondition] = useState('');
  const [condSuggestions, setCondSuggestions] = useState<string[]>([]);
  const debouncedCondSearch = useDebounce(currentCondition, 250);

  // PGx local state for entry
  const [pgxGene, setPgxGene] = useState('');
  const [pgxVariant, setPgxVariant] = useState('');
  const [pgxStatus, setPgxStatus] = useState('');

  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [supplementInteractionCache, setSupplementInteractionCache] = useState<Record<string, any>>({});

  // Indices for Fuse.js
  const drugIndex = useMemo(() => {
    const list: any[] = [];
    drugDatabase.forEach(d => list.push({ term: d.name, type: 'generic', genericName: d.name, data: d }));
    Object.entries(drugSynonymMap).forEach(([brand, generic]) => {
      list.push({ term: brand, type: 'brand', genericName: generic, data: drugDatabase.find(d => d.name.toLowerCase() === generic.toLowerCase()) || { name: generic } });
    });
    return list;
  }, []);

  const fuseMeds = useMemo(() => new Fuse(drugIndex, { keys: ['term'], threshold: 0.35 }), [drugIndex]);
  const fuseSups = useMemo(() => new Fuse(supplementDatabase, { keys: ['name'], threshold: 0.35 }), []);
  const fuseConds = useMemo(() => new Fuse(commonConditions, { threshold: 0.35 }), []);

  useEffect(() => {
    if (debouncedMedSearch.length < 2) setMedSuggestions([]);
    else setMedSuggestions(fuseMeds.search(debouncedMedSearch).slice(0, 8).map(r => r.item));
  }, [debouncedMedSearch, fuseMeds]);

  useEffect(() => {
    if (debouncedSupSearch.length < 2) setSupSuggestions([]);
    else setSupSuggestions(fuseSups.search(debouncedSupSearch).slice(0, 8).map(r => r.item));
  }, [debouncedSupSearch, fuseSups]);

  useEffect(() => {
    if (debouncedCondSearch.length < 2) setCondSuggestions([]);
    else setCondSuggestions(fuseConds.search(debouncedCondSearch).slice(0, 8).map(r => r.item));
  }, [debouncedCondSearch, fuseConds]);

  // Handlers
  const handleAddMed = (item: any) => {
    setMedications([...medications, { name: item.term || item.name, dosage: item.data?.commonDosage || '', frequency: item.data?.commonFrequency || '' }]);
    setCurrentMedication('');
    setMedSuggestions([]);
  };

  const handleAddCondition = (name: string) => {
    const currentList = conditions.split(',').map(c => c.trim()).filter(Boolean);
    if (!currentList.some(c => c.toLowerCase() === name.toLowerCase())) {
      setConditions([...currentList, name].join(', '));
    }
    setCurrentCondition('');
    setCondSuggestions([]);
  };

  const handleAddPgx = () => {
    if (!pgxGene) return;
    const factor = `${pgxGene}${pgxVariant ? ` (${pgxVariant})` : ''}${pgxStatus ? `: ${pgxStatus}` : ''}`;
    const currentList = pharmacogenetics.split(';').map(p => p.trim()).filter(Boolean);
    if (!currentList.includes(factor)) {
        setPharmacogenetics([...currentList, factor].join('; '));
    }
    setPgxGene(''); setPgxVariant(''); setPgxStatus('');
  };

  const handleAddAllergy = (val: string) => {
    const current = allergies.split(',').map(a => a.trim()).filter(Boolean);
    if (!current.some(a => a.toLowerCase() === val.toLowerCase())) {
      setAllergies([...current, val].join(', '));
    }
  };

  // Real-time analysis for supplements
  const predefinedSubstances = [
    t.substance_st_johns_wort, 
    t.substance_alcohol, 
    t.substance_tobacco, 
    t.substance_grapefruit_juice, 
    t.substance_cranberry_juice,
    t.substance_melatonin,
    t.substance_omega3,
    t.substance_vitamin_d,
    t.substance_magnesium,
    t.substance_probiotics,
    t.substance_collagen,
    t.substance_mushrooms
  ];
  
  const activeSupplements = useMemo(() => {
    return otherSubstances.split(',').map(s => s.trim()).filter(Boolean);
  }, [otherSubstances]);

  const fetchSupInteraction = useCallback(async (sup: string) => {
    if (medications.length === 0 || supplementInteractionCache[sup]) return;
    setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'loading' } }));
    try {
      const res = await analyzeSupplementInteractions(sup, medications, t.lang_code);
      setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'completed', data: res } }));
    } catch (e: any) {
      setSupplementInteractionCache(prev => ({ ...prev, [sup]: { status: 'error', error: e.message } }));
    }
  }, [medications, supplementInteractionCache, t.lang_code]);

  useEffect(() => {
    activeSupplements.forEach(s => fetchSupInteraction(s));
  }, [activeSupplements, fetchSupInteraction]);

  // Local Proactive Alerts
  const activeAlerts = useMemo<ProactiveAlert[]>(() => {
    const alerts: ProactiveAlert[] = [];
    const normalize = (name: string) => {
      const lower = name.toLowerCase().trim();
      return drugSynonymMap[lower] ? drugSynonymMap[lower].toLowerCase() : lower;
    };
    const medNamesNorm = medications.map(m => normalize(m.name));
    const allergyList = allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
    const condList = conditions.toLowerCase().split(',').map(c => c.trim()).filter(Boolean);

    allergyList.forEach(a => {
      for (const group in criticalAllergyRules) {
        if (a.includes(group) || group.includes(a)) {
          medications.forEach(m => {
            if (criticalAllergyRules[group].some(ruleMed => normalize(ruleMed) === normalize(m.name))) {
              alerts.push({ id: `a-${m.name}-${group}`, type: 'allergy', title: t.allergy_alert_title, message: t.allergy_alert_text.replace('{medication}', m.name).replace('{allergyGroup}', group) });
            }
          });
        }
      }
    });

    criticalDrugInteractionRules.forEach(rule => {
      if (medNamesNorm.includes(normalize(rule.pair[0])) && medNamesNorm.includes(normalize(rule.pair[1]))) {
        alerts.push({ id: `ddi-${rule.pair.join('-')}`, type: 'drug-drug', title: t.ddi_alert_title, message: t.ddi_alert_text.replace('{med1}', rule.pair[0]).replace('{med2}', rule.pair[1]).replace('{reason}', t[rule.reasonKey] || rule.reasonKey) });
      }
    });

    condList.forEach(uCond => {
      for (const rCond in criticalConditionRules) {
        if (uCond.includes(rCond) || rCond.includes(uCond)) {
          medications.forEach(m => {
            if (criticalConditionRules[rCond].drugs.some(d => normalize(d) === normalize(m.name))) {
              alerts.push({ id: `c-${m.name}-${rCond}`, type: 'condition', title: t.condition_alert_title, message: t.condition_alert_text.replace('{medication}', m.name).replace('{condition}', rCond).replace('{reason}', t[criticalConditionRules[rCond].reasonKey] || criticalConditionRules[rCond].reasonKey) });
            }
          });
        }
      }
    });
    return Array.from(new Map(alerts.map(a => [a.id, a])).values());
  }, [medications, allergies, conditions, t]);

  return (
    <div className="space-y-8">
      {/* 1. Patient ID */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_patient_id_label}</label>
        <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder={t.form_patient_id_placeholder} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
      </section>

      {/* 2. Medications */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_medications_label}</label>
        <div className="relative">
          <div className="flex gap-2">
            <input type="text" value={currentMedication} onChange={(e) => setCurrentMedication(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && currentMedication && handleAddMed({name: currentMedication})} placeholder={t.form_medications_placeholder} className="flex-grow px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900" />
            <button onClick={() => currentMedication && handleAddMed({name: currentMedication})} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><PlusIcon className="h-5 w-5"/></button>
          </div>
          {medSuggestions.length > 0 && (
            <ul className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto">
              {medSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleAddMed(s)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm flex flex-col border-b last:border-0 dark:border-slate-700">
                  <span className="font-bold">{s.term}</span>
                  {s.type === 'brand' && <span className="text-[10px] text-slate-400 uppercase">Genérico: {s.genericName}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {medications.map((m, i) => <MedicationItem key={i} medication={m} index={i} onRemove={() => setMedications(medications.filter((_, idx) => idx !== i))} onChange={(f, v) => { const n = [...medications]; (n[i] as any)[f] = v; setMedications(n); }} t={t} />)}
        </div>
      </section>

      {/* 3. Allergies */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_allergies_label}</label>
        <input type="text" onKeyDown={(e) => e.key === 'Enter' && (handleAddAllergy((e.target as any).value), (e.target as any).value = '')} placeholder={t.form_allergies_placeholder} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900" />
        <div className="mt-2 flex flex-wrap gap-2">
          {allergies.split(',').map(a => a.trim()).filter(Boolean).map(a => (
            <span key={a} className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded-full border border-red-100 dark:border-red-900 flex items-center">{a}<button onClick={() => setAllergies(allergies.split(',').filter(x => x.trim() !== a).join(', '))} className="ml-1 hover:text-red-900"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
      </section>

      {/* 4. Date of Birth */}
      <section className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_dob_label}</label>
        <input type="text" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder={t.form_dob_placeholder} className="w-full max-w-xs px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900" />
        <p className="mt-1 text-[10px] text-slate-400 italic">{t.form_dob_note}</p>
      </section>

      {/* 5. Substances & Supplements */}
      <section className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.form_substances_label}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-3 mb-6">
          {predefinedSubstances.map(s => (
            <label key={s} className="flex items-center space-x-2 text-sm cursor-pointer hover:text-blue-600 transition-colors group">
              <input type="checkbox" checked={otherSubstances.split(',').map(x => x.trim()).includes(s)} onChange={(e) => {
                const current = otherSubstances.split(',').map(x => x.trim()).filter(Boolean);
                const updated = e.target.checked ? [...current, s] : current.filter(x => x !== s);
                setOtherSubstances(updated.join(', '));
              }} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800" />
              <span className="group-hover:translate-x-0.5 transition-transform">{s}</span>
            </label>
          ))}
        </div>
        
        <label className="block text-xs font-bold text-slate-400 mb-2">{t.form_supplements_label}</label>
        <div className="relative">
          <input type="text" value={currentSupplement} onChange={(e) => setCurrentSupplement(e.target.value)} placeholder={t.form_supplements_placeholder} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900" />
          {supSuggestions.length > 0 && (
            <ul className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto">
              {supSuggestions.map((s, i) => (
                <li key={i} onClick={() => {
                  const current = otherSubstances.split(',').map(x => x.trim()).filter(Boolean);
                  if(!current.includes(s.name)) setOtherSubstances([...current, s.name].join(', '));
                  setCurrentSupplement(''); setSupSuggestions([]);
                }} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm">
                  {s.name} <span className="text-[10px] text-slate-400 ml-2">({s.type})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 6. Pharmacogenetics */}
      <section className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.form_pharmacogenetics_label}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <select value={pgxGene} onChange={(e) => setPgxGene(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">{t.form_pgx_select_gene}</option>
            {Object.entries(pgxGeneGroups).map(([group, genes]) => (
              <optgroup key={group} label={group}>
                {genes.map(g => <option key={g} value={g}>{g}</option>)}
              </optgroup>
            ))}
          </select>
          <input type="text" value={pgxVariant} onChange={(e) => setPgxVariant(e.target.value)} placeholder={t.form_pgx_variant_placeholder} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={pgxStatus} onChange={(e) => setPgxStatus(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">{t.form_pgx_select_status}</option>
            <option value={t.form_pgx_status_poor}>{t.form_pgx_status_poor}</option>
            <option value={t.form_pgx_status_intermediate}>{t.form_pgx_status_intermediate}</option>
            <option value={t.form_pgx_status_normal}>{t.form_pgx_status_normal}</option>
            <option value={t.form_pgx_status_rapid}>{t.form_pgx_status_rapid}</option>
            <option value={t.form_pgx_status_carrier}>{t.form_pgx_status_carrier}</option>
          </select>
        </div>
        <button onClick={handleAddPgx} disabled={!pgxGene} className="w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors uppercase tracking-widest disabled:opacity-50">
            {t.form_pgx_add_button}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          {pharmacogenetics.split(';').map(p => p.trim()).filter(Boolean).map((p, i) => (
            <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md border border-indigo-100 dark:border-indigo-800 flex items-center">{p}<button onClick={() => setPharmacogenetics(pharmacogenetics.split(';').filter(x => x.trim() !== p).join('; '))} className="ml-1"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
      </section>

      {/* 7. Conditions (Searchable) */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_conditions_label}</label>
        <div className="relative">
          <input type="text" value={currentCondition} onChange={(e) => setCurrentCondition(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddCondition(currentCondition); } }} placeholder={t.form_conditions_placeholder} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900" />
          {condSuggestions.length > 0 && (
            <ul className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-auto">
              {condSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleAddCondition(s)} className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold border-b last:border-0 dark:border-slate-700 transition-colors">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {conditions.split(',').map(c => c.trim()).filter(Boolean).map(c => (
            <span key={c} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-full border border-slate-200 dark:border-slate-700 flex items-center">{c}<button onClick={() => setConditions(conditions.split(',').filter(x => x.trim() !== c).join(', '))} className="ml-1"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
      </section>

      {/* Risk Panel */}
      {(medications.length > 0 || activeSupplements.length > 0) && (
        <div className="p-5 bg-white dark:bg-slate-900 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center mb-4">
            <AlertTriangleIcon className="h-6 w-6 mr-2 text-amber-500" />
            {t.realtime_risk_panel_title}
          </h3>
          
          <div className="space-y-4">
            {activeAlerts.length === 0 && activeSupplements.length === 0 && (
              <p className="text-xs text-slate-400 italic">No se detectan riesgos críticos directos inmediatos.</p>
            )}

            {activeAlerts.map(alert => (
              <div key={alert.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">{alert.title}</h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">{alert.message}</p>
                </div>
                <button onClick={async () => {
                  if(explanations[alert.id]) { setExplanations(prev => { const n = {...prev}; delete n[alert.id]; return n; }); return; }
                  setExplainingId(alert.id);
                  try { const d = await getDetailedInteractionInfo(alert.title + ": " + alert.message, medications, conditions, t.lang_code); setExplanations(prev => ({...prev, [alert.id]: d})); } catch(e){} finally { setExplainingId(null); }
                }} className="flex-shrink-0 px-2 py-1 bg-white dark:bg-slate-800 border dark:border-slate-600 text-[10px] font-bold rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  {explainingId === alert.id ? <ArrowPathIcon className="h-3 w-3 animate-spin" /> : explanations[alert.id] ? "Ocultar" : "IA Info"}
                </button>
              </div>
            ))}

            {activeSupplements.map(sup => {
              const cache = supplementInteractionCache[sup];
              if (!cache) return null;
              if (cache.status === 'loading') return <div key={sup} className="p-3 bg-slate-50 dark:bg-slate-800/30 animate-pulse rounded-lg text-[10px] italic">Analizando {sup}...</div>;
              if (cache.status === 'error') return null;
              return cache.data.map((int: any, idx: number) => (
                <div key={`${sup}-${idx}`} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sup} + {int.medication}</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1"><strong>{int.riskLevel}:</strong> {int.potentialEffects}</p>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onClear} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">{t.form_clear_button}</button>
        <button onClick={onSaveProfile} disabled={!patientId.trim()} className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-all">{t.form_save_profile_button}</button>
        <button onClick={onAnalyze} disabled={isLoading} className="px-8 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center">
          {isLoading ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" /> : <SparklesIcon className="h-5 w-5 mr-2" />}
          {isLoading ? t.form_analyzing_button : t.form_analyze_button}
        </button>
      </div>
    </div>
  );
};

export default InteractionForm;
