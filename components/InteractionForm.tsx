
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { drugDatabase } from '../data/drugNames';
import { drugSynonymMap } from '../data/drugSynonyms';
import { supplementDatabase } from '../data/supplements';
import { pgxGeneGroups } from '../data/pgxGenes';
import { commonConditions } from '../data/conditions';
import { criticalAllergyRules, criticalConditionRules, criticalDrugInteractionRules } from '../data/proactiveAlerts';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import MedicationItem from './MedicationItem';
import type { Medication, ProactiveAlert } from '../types';

interface InteractionFormProps {
  patientId: string; setPatientId: (value: string) => void;
  medications: Medication[]; setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  allergies: string; setAllergies: (value: string) => void;
  otherSubstances: string; setOtherSubstances: (value: string) => void;
  pharmacogenetics: string; setPharmacogenetics: (value: string) => void;
  conditions: string; setConditions: (value: string) => void;
  dateOfBirth: string; setDateOfBirth: (value: string) => void;
  onAnalyze: () => void; onClear: () => void; onSaveProfile: () => void;
  isLoading: boolean; t: any;
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
  const [currentMedication, setCurrentMedication] = useState('');
  const [medSuggestions, setMedSuggestions] = useState<any[]>([]);
  const debouncedMedSearch = useDebounce(currentMedication, 250);

  const [currentSupplement, setCurrentSupplement] = useState('');
  const [supSuggestions, setSupSuggestions] = useState<any[]>([]);
  const debouncedSupSearch = useDebounce(currentSupplement, 250);

  const [currentCondition, setCurrentCondition] = useState('');
  const [condSuggestions, setCondSuggestions] = useState<string[]>([]);
  const debouncedCondSearch = useDebounce(currentCondition, 250);

  const [currentAllergy, setCurrentAllergy] = useState('');

  const [pgxGene, setPgxGene] = useState('');
  const [pgxVariant, setPgxVariant] = useState('');
  const [pgxStatus, setPgxStatus] = useState('');

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

  const handleAddMed = (item: any) => {
    setMedications([...medications, { name: item.term || item.name, dosage: item.data?.commonDosage || '', frequency: item.data?.commonFrequency || '' }]);
    setCurrentMedication('');
    setMedSuggestions([]);
  };

  const handleAddCondition = (name: string) => {
    const currentList = conditions.split(',').map(c => c.trim()).filter(Boolean);
    if (!currentList.some(c => c.toLowerCase() === name.toLowerCase())) setConditions([...currentList, name].join(', '));
    setCurrentCondition('');
    setCondSuggestions([]);
  };

  const handleAddAllergy = () => {
    if (!currentAllergy.trim()) return;
    const currentList = allergies.split(',').map(a => a.trim()).filter(Boolean);
    if (!currentList.some(a => a.toLowerCase() === currentAllergy.toLowerCase())) {
        setAllergies([...currentList, currentAllergy.trim()].join(', '));
    }
    setCurrentAllergy('');
  };

  const handleAddPgx = () => {
    if (!pgxGene) return;
    const factor = `${pgxGene}${pgxVariant ? ` (${pgxVariant})` : ''}${pgxStatus ? `: ${pgxStatus}` : ''}`;
    const currentList = pharmacogenetics.split(';').map(p => p.trim()).filter(Boolean);
    if (!currentList.includes(factor)) setPharmacogenetics([...currentList, factor].join('; '));
    setPgxGene(''); setPgxVariant(''); setPgxStatus('');
  };

  const predefinedSubstances = [
    t.substance_st_johns_wort, t.substance_alcohol, t.substance_tobacco, t.substance_grapefruit_juice, 
    t.substance_cranberry_juice, t.substance_melatonin, t.substance_omega3, t.substance_vitamin_d,
    t.substance_magnesium, t.substance_probiotics, t.substance_collagen, t.substance_mushrooms
  ];

  const activeAlerts = useMemo<ProactiveAlert[]>(() => {
    const alerts: ProactiveAlert[] = [];
    
    // Función para resolver una marca a su genérico para las reglas proactivas
    const resolveToGeneric = (name: string) => {
      if (!name) return '';
      const lower = name.toLowerCase().trim();
      // Búsqueda directa en el mapa de sinónimos
      const fromMap = drugSynonymMap[lower];
      if (fromMap) return fromMap.toLowerCase();
      // Búsqueda por subcadena para mayor flexibilidad (ej: "Ibuprofeno 600" -> "ibuprofen")
      for (const [brand, generic] of Object.entries(drugSynonymMap)) {
          if (lower.includes(brand.toLowerCase())) return generic.toLowerCase();
      }
      return lower;
    };

    const resolvedMeds = medications.map(m => resolveToGeneric(m.name));
    const allergyList = allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
    const conditionList = conditions.toLowerCase().split(',').map(c => c.trim()).filter(Boolean);

    // 1. Alergias Críticas
    allergyList.forEach(userAllergy => {
      for (const groupKey in criticalAllergyRules) {
        if (userAllergy.includes(groupKey) || groupKey.includes(userAllergy)) {
          medications.forEach((m, idx) => {
            const gen = resolvedMeds[idx];
            if (criticalAllergyRules[groupKey].some(ruleDrug => gen.includes(ruleDrug.toLowerCase()) || ruleDrug.toLowerCase().includes(gen))) {
              alerts.push({ 
                id: `a-${m.name}-${groupKey}`, 
                type: 'allergy', 
                title: t.allergy_alert_title, 
                message: t.allergy_alert_text.replace('{medication}', m.name).replace('{allergyGroup}', groupKey) 
              });
            }
          });
        }
      }
    });

    // 2. Contraindicaciones por Condición
    conditionList.forEach(userCondition => {
      for (const conditionKey in criticalConditionRules) {
        if (userCondition.includes(conditionKey) || conditionKey.includes(userCondition)) {
          medications.forEach((m, idx) => {
            const gen = resolvedMeds[idx];
            const rule = criticalConditionRules[conditionKey];
            if (rule.drugs.some(d => gen.includes(d.toLowerCase()) || d.toLowerCase().includes(gen))) {
              alerts.push({
                id: `c-${m.name}-${conditionKey}`,
                type: 'condition',
                title: t.condition_alert_title,
                message: t.condition_alert_text.replace('{medication}', m.name).replace('{condition}', conditionKey).replace('{reason}', t[rule.reasonKey] || rule.reasonKey)
              });
            }
          });
        }
      }
    });

    // 3. Interacciones Fármaco-Fármaco
    criticalDrugInteractionRules.forEach(rule => {
      const idx1 = resolvedMeds.findIndex(m => m !== '' && (m.includes(rule.pair[0].toLowerCase()) || rule.pair[0].toLowerCase().includes(m)));
      const idx2 = resolvedMeds.findIndex(m => m !== '' && (m.includes(rule.pair[1].toLowerCase()) || rule.pair[1].toLowerCase().includes(m)));
      
      if (idx1 !== -1 && idx2 !== -1 && idx1 !== idx2) {
        alerts.push({ 
          id: `ddi-${rule.pair.join('-')}`, 
          type: 'drug-drug', 
          title: t.ddi_alert_title, 
          message: t.ddi_alert_text.replace('{med1}', medications[idx1].name).replace('{med2}', medications[idx2].name).replace('{reason}', t[rule.reasonKey] || rule.reasonKey) 
        });
      }
    });

    // Eliminar duplicados por ID de alerta
    return Array.from(new Map(alerts.map(a => [a.id, a])).values());
  }, [medications, allergies, conditions, t]);

  return (
    <div className="space-y-8">
      {/* 1. Patient ID */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_patient_id_label}</label>
        <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder={t.form_patient_id_placeholder} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
      </section>

      {/* 2. Medications */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_medications_label}</label>
        <div className="relative">
          <div className="flex gap-2">
            <input type="text" value={currentMedication} onChange={(e) => setCurrentMedication(e.target.value)} placeholder={t.form_medications_placeholder} className="flex-grow px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
            <button onClick={() => { if(currentMedication) handleAddMed({term: currentMedication}); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><PlusIcon className="h-5 w-5"/></button>
          </div>
          {medSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto">
              {medSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleAddMed(s)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm flex flex-col border-b last:border-0">
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

      {/* 3. Alergias (Sistema de Tags) */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_allergies_label}</label>
        <div className="flex gap-2">
            <input 
                type="text" 
                value={currentAllergy} 
                onChange={(e) => setCurrentAllergy(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleAddAllergy()}
                placeholder={t.form_allergies_placeholder} 
                className="flex-grow px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
            <button onClick={handleAddAllergy} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"><PlusIcon className="h-5 w-5"/></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {allergies.split(',').map(a => a.trim()).filter(Boolean).map(a => (
            <span key={a} className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold rounded-full border border-red-100 dark:border-red-900/40 flex items-center">{a}<button onClick={() => setAllergies(allergies.split(',').filter(x => x.trim() !== a).join(', '))} className="ml-1"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1 italic">{t.form_allergies_note}</p>
      </section>

      {/* 4. Date of Birth */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_dob_label}</label>
        <input type="text" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder={t.form_dob_placeholder} className="w-full max-w-xs px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
        <p className="text-[10px] text-slate-400 mt-1 italic">{t.form_dob_note}</p>
      </section>

      {/* 5. Substances & Supplements */}
      <section className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t.form_substances_label}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3 mb-6">
          {predefinedSubstances.map(s => (
            <label key={s} className="flex items-center space-x-2 text-sm cursor-pointer">
              <input type="checkbox" checked={otherSubstances.includes(s)} onChange={(e) => {
                const current = otherSubstances.split(',').map(x => x.trim()).filter(Boolean);
                const updated = e.target.checked ? [...current, s] : current.filter(x => x !== s);
                setOtherSubstances(updated.join(', '));
              }} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
              <span className="font-medium">{s}</span>
            </label>
          ))}
        </div>
        
        <div className="relative">
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">{t.form_supplements_label}</label>
          <div className="flex gap-2">
            <input type="text" value={currentSupplement} onChange={(e) => setCurrentSupplement(e.target.value)} placeholder={t.form_supplements_placeholder} className="flex-grow px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button onClick={() => { if(currentSupplement) setOtherSubstances([...otherSubstances.split(',').filter(Boolean), currentSupplement].join(', ')); setCurrentSupplement(''); }} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 transition-colors"><PlusIcon className="h-4 w-4"/></button>
          </div>
          {supSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {supSuggestions.map((s, i) => (
                <li key={i} onClick={() => { setOtherSubstances([...otherSubstances.split(',').filter(Boolean), s.name].join(', ')); setCurrentSupplement(''); }} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold border-b last:border-0">{s.name} <span className="text-[10px] font-normal text-slate-400">({s.type})</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {otherSubstances.split(',').map(s => s.trim()).filter(Boolean).map(s => (
            <span key={s} className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-700 flex items-center">{s}<button onClick={() => setOtherSubstances(otherSubstances.split(',').filter(x => x.trim() !== s).join(', '))} className="ml-1 text-red-500"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
      </section>

      {/* 6. Farmacogenética */}
      <section className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
        <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-4">{t.form_pharmacogenetics_label}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <select value={pgxGene} onChange={(e) => setPgxGene(e.target.value)} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-1 focus:ring-purple-500 outline-none">
                <option value="">{t.form_pgx_select_gene}</option>
                {Object.entries(pgxGeneGroups).map(([group, genes]) => (
                    <optgroup key={group} label={group}>{genes.map(g => <option key={g} value={g}>{g}</option>)}</optgroup>
                ))}
            </select>
            <input type="text" value={pgxVariant} onChange={(e) => setPgxVariant(e.target.value)} placeholder={t.form_pgx_variant_placeholder} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" />
            <select value={pgxStatus} onChange={(e) => setPgxStatus(e.target.value)} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                <option value="">{t.form_pgx_select_status}</option>
                <option value={t.form_pgx_status_poor}>{t.form_pgx_status_poor}</option>
                <option value={t.form_pgx_status_intermediate}>{t.form_pgx_status_intermediate}</option>
                <option value={t.form_pgx_status_normal}>{t.form_pgx_status_normal}</option>
                <option value={t.form_pgx_status_rapid}>{t.form_pgx_status_rapid}</option>
            </select>
        </div>
        <button onClick={handleAddPgx} disabled={!pgxGene} className="w-full py-2 bg-purple-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-50">{t.form_pgx_add_button}</button>
        <div className="mt-2 flex flex-wrap gap-2">
            {pharmacogenetics.split(';').map(p => p.trim()).filter(Boolean).map(p => (
                <span key={p} className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full border border-purple-200 flex items-center">
                    {p} <button onClick={() => setPharmacogenetics(pharmacogenetics.split(';').filter(x => x.trim() !== p).join('; '))} className="ml-1 hover:text-red-500"><TrashIcon className="h-3 w-3"/></button>
                </span>
            ))}
        </div>
      </section>

      {/* 7. Conditions */}
      <section>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.form_conditions_label}</label>
        <div className="relative">
          <div className="flex gap-2">
              <input type="text" value={currentCondition} onChange={(e) => setCurrentCondition(e.target.value)} placeholder={t.form_conditions_placeholder} className="flex-grow px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
              <button onClick={() => { if(currentCondition) handleAddCondition(currentCondition); }} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"><PlusIcon className="h-5 w-5"/></button>
          </div>
          {condSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-auto">
              {condSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleAddCondition(s)} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold border-b last:border-0">{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {conditions.split(',').map(c => c.trim()).filter(Boolean).map(c => (
            <span key={c} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-full border border-slate-200 flex items-center">{c}<button onClick={() => setConditions(conditions.split(',').filter(x => x.trim() !== c).join(', '))} className="ml-1"><TrashIcon className="h-3 w-3"/></button></span>
          ))}
        </div>
      </section>

      {/* Real-time Risk Panel */}
      {activeAlerts.length > 0 && (
        <div className="p-5 bg-white dark:bg-slate-900 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center mb-4">
            <AlertTriangleIcon className="h-6 w-6 mr-2 text-amber-500" />
            {t.realtime_risk_panel_title}
          </h3>
          <div className="space-y-4">
            {activeAlerts.map(alert => (
              <div key={alert.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl">
                <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">{alert.title}</h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">{alert.message}</p>
              </div>
            ))}
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
