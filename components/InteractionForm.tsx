
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
import { ApiKeyError } from '../types';
import { translations } from '../lib/translations';
import { analyzeSupplementInteractions, getDetailedInteractionInfo } from '../services/geminiService';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { drugSynonymMap } from '../data/drugSynonyms';
import { commonConditions } from '../data/conditions';
import ProBadge from './ProBadge';
import { criticalAllergyRules, criticalConditionRules, criticalDrugInteractionRules } from '../data/proactiveAlerts';
import { useAuth } from '../contexts/AuthContext';
import LockIcon from './icons/LockIcon';
import MedicationItem from './MedicationItem';
import ChevronDownIcon from './icons/ChevronDownIcon';

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

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
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

interface SearchItem {
    term: string;
    type: 'generic' | 'brand';
    genericName: string;
    data: DrugInfo;
}

const calculateRelevance = (item: DisplaySuggestion, query: string, lang: string, fuseScore?: number): number => {
    let score = 0;
    const matchedTerm = (item.matchedTerm || item.name).toLowerCase();
    const q = query.toLowerCase();

    if (matchedTerm === q) score += 1000;
    else if (matchedTerm.startsWith(q)) score += 500;
    else if (matchedTerm.includes(q)) score += 200;
    
    if (fuseScore !== undefined) {
        score += (1 - fuseScore) * 150;
    }

    if (item.source === 'local') score += 500;
    score -= Math.abs(matchedTerm.length - q.length) * 2;
    return score;
};

const InteractionForm: React.FC<InteractionFormProps> = ({
  patientId,
  setPatientId,
  medications,
  setMedications,
  allergies,
  setAllergies,
  otherSubstances,
  setOtherSubstances,
  pharmacogenetics,
  setPharmacogenetics,
  conditions,
  setConditions,
  dateOfBirth,
  setDateOfBirth,
  onAnalyze,
  onClear,
  onSaveProfile,
  existingPatientIds,
  isLoading,
  isApiKeyMissing,
  onApiKeyError,
  t,
}) => {
  const { permissions } = useAuth();
  const [currentMedication, setCurrentMedication] = useState('');
  const [suggestions, setSuggestions] = useState<DisplaySuggestion[]>([]);
  const [isFetchingMeds, setIsFetchingMeds] = useState(false);
  const debouncedMedSearch = useDebounce(currentMedication, 250);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [dobError, setDobError] = useState<string | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [duplicateMedError, setDuplicateMedError] = useState<string | null>(null);

  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const searchIndex = useMemo<SearchItem[]>(() => {
      const list: SearchItem[] = [];
      drugDatabase.forEach(d => {
          list.push({ term: d.name, type: 'generic', genericName: d.name, data: d });
      });
      Object.entries(drugSynonymMap).forEach(([brand, generic]) => {
          const genericInfo = drugDatabase.find(d => d.name.toLowerCase() === generic.toLowerCase()) 
              || { name: generic, dosage: '', frequency: '' };
          list.push({ term: brand, type: 'brand', genericName: genericInfo.name, data: genericInfo });
      });
      return list;
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(searchIndex, {
      keys: ['term'],
      threshold: 0.3,
      includeScore: true,
      distance: 50,
      minMatchCharLength: 2,
    });
  }, [searchIndex]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (debouncedMedSearch.length < 2) {
      setSuggestions([]);
      setIsFetchingMeds(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsFetchingMeds(true);
      const queryStr = debouncedMedSearch.toLowerCase();
      const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
      
      try {
        const combinedMap = new Map<string, DisplaySuggestion>();
        const fuseResults = fuse.search(debouncedMedSearch);
        let maxLocalScore = 0;

        fuseResults.forEach(result => {
            const genericName = result.item.genericName;
            const genericKey = genericName.toLowerCase();
            const isBrandMatch = result.item.type === 'brand';
            const matchedNameTitle = toTitleCase(result.item.term);
            
            const suggestion: DisplaySuggestion = { 
              ...result.item.data, 
              name: isBrandMatch ? matchedNameTitle : genericName, 
              source: 'local', 
              matchedTerm: result.item.term, 
              type: result.item.type, 
              genericName: genericName,
              matchScore: 0
            };

            const score = calculateRelevance(suggestion, debouncedMedSearch, t.lang_code, result.score);
            suggestion.matchScore = score;
            maxLocalScore = Math.max(maxLocalScore, score);

            const existing = combinedMap.get(genericKey);
            if (!existing || (score > existing.matchScore)) {
                if (isBrandMatch) suggestion.subtitle = genericName;
                combinedMap.set(genericKey, suggestion);
            }
        });

        if (maxLocalScore < 700 && combinedMap.size < 5) {
            const apiQuery = `(openfda.brand_name:"${queryStr}"^2 OR openfda.generic_name:"${queryStr}" OR openfda.substance_name:"${queryStr}")`;
            try {
                const response = await fetch(`https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(apiQuery)}&limit=6`, { signal });
                if (response.ok) {
                    const data = await response.json();
                    (data.results || []).forEach((drug: any) => {
                        const namesToTry = [...(drug.brand_name || []), ...(drug.generic_name || [])];
                        namesToTry.forEach(nameRaw => {
                            const name = toTitleCase(nameRaw.split(',')[0].trim());
                            if (name.length > 50 || name.length < 2) return;
                            const key = name.toLowerCase();
                            if (combinedMap.has(key)) return;
                            const suggestion: DisplaySuggestion = { name, source: 'api', type: 'generic', matchScore: 0 };
                            suggestion.matchScore = calculateRelevance(suggestion, debouncedMedSearch, t.lang_code);
                            combinedMap.set(key, suggestion);
                        });
                    });
                }
            } catch (error: any) { 
                if (error.name !== 'AbortError') console.warn("FDA API Search failed", error); 
            }
        }

        if (signal.aborted) return;

        const alreadyAdded = new Set(medications.map(m => m.name.toLowerCase()));
        const finalSuggestions = Array.from(combinedMap.values())
            .filter(s => !alreadyAdded.has(s.name.toLowerCase()))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10);

        setSuggestions(finalSuggestions);
      } catch (err) { 
        console.error("Autocomplete process error", err); 
      } finally { 
        if (!signal.aborted) setIsFetchingMeds(false); 
      }
    };

    fetchSuggestions();
    return () => controller.abort();
  }, [debouncedMedSearch, medications, fuse, t]);

  const handleSaveProfile = () => {
    onSaveProfile();
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };
  
  const [currentAllergy, setCurrentAllergy] = useState('');
  const allergyTags = useMemo(() => allergies.split(',').map(a => a.trim()).filter(Boolean), [allergies]);

  const handleAddAllergy = () => {
    const newAllergies = currentAllergy.split(',').map(a => a.trim()).filter(Boolean);
    if (newAllergies.length === 0) { setCurrentAllergy(''); return; }
    const currentTagsLower = allergyTags.map(a => a.toLowerCase());
    const uniqueNewTags = newAllergies.filter(newTag => !currentTagsLower.includes(newTag.toLowerCase()));
    if (uniqueNewTags.length > 0) {
        setAllergies([...allergyTags, ...uniqueNewTags].join(', '));
    }
    setCurrentAllergy('');
  };
  
  const handleRemoveAllergy = (allergyToRemove: string) => {
    setAllergies(allergyTags.filter(a => a !== allergyToRemove).join(', '));
  };

  const [currentCondition, setCurrentCondition] = useState('');
  const [conditionSuggestions, setConditionSuggestions] = useState<string[]>([]);
  const [activeConditionSuggestionIndex, setActiveConditionSuggestionIndex] = useState(0);
  const conditionAutocompleteRef = useRef<HTMLDivElement>(null);
  const conditionTags = useMemo(() => conditions.split(',').map(c => c.trim()).filter(Boolean), [conditions]);
  
  const handleConditionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentCondition(value);
    setActiveConditionSuggestionIndex(0);
    if (value.length > 1) {
        const lowerCaseValue = value.toLowerCase();
        const addedConditionsSet = new Set(conditionTags.map(c => c.toLowerCase()));
        const filtered = commonConditions.filter(
            condition => condition.toLowerCase().includes(lowerCaseValue) && !addedConditionsSet.has(condition.toLowerCase())
        );
        setConditionSuggestions(filtered.slice(0, 10));
    } else { setConditionSuggestions([]); }
  };

  const handleAddCondition = (condition?: string) => {
    const conditionToAdd = (condition || currentCondition).trim();
    if (conditionToAdd && !conditionTags.includes(conditionToAdd)) {
        setConditions([...conditionTags, conditionToAdd].join(', '));
    }
    setCurrentCondition('');
    setConditionSuggestions([]);
  };
  
  const handleConditionSuggestionClick = (suggestion: string) => { handleAddCondition(suggestion); };

  const handleConditionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (conditionSuggestions.length > 0 && e.key !== 'Tab') {
      if (e.key === 'Enter') {
          e.preventDefault();
          if(conditionSuggestions[activeConditionSuggestionIndex]){
            handleConditionSuggestionClick(conditionSuggestions[activeConditionSuggestionIndex]);
          }
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveConditionSuggestionIndex(prev => (prev === 0 ? conditionSuggestions.length - 1 : prev - 1));
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveConditionSuggestionIndex(prev => (prev === conditionSuggestions.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') { setConditionSuggestions([]); }
    } else if (e.key === 'Enter') { e.preventDefault(); handleAddCondition(); }
  };

  const handleRemoveCondition = (conditionToRemove: string) => {
    setConditions(conditionTags.filter(c => c !== conditionToRemove).join(', '));
  };

  const [pgxFactors, setPgxFactors] = useState<string[]>([]);
  const [selectedGene, setSelectedGene] = useState('');
  const [variantAllele, setVariantAllele] = useState('');
  const [metabolizerStatus, setMetabolizerStatus] = useState('');

  useEffect(() => {
    setPgxFactors(pharmacogenetics.split(',').map(s => s.trim()).filter(Boolean));
  }, [pharmacogenetics]);

  const handleAddPgxFactor = () => {
    if (!selectedGene) return;
    let newFactor = selectedGene;
    const trimmedVariant = variantAllele.trim();
    if (trimmedVariant) { newFactor += ` ${trimmedVariant}`; }
    if (metabolizerStatus) { newFactor += ` (${metabolizerStatus})`; }
    if (!pgxFactors.includes(newFactor)) {
      const updatedFactors = [...pgxFactors, newFactor];
      setPgxFactors(updatedFactors);
      setPharmacogenetics(updatedFactors.join(', '));
    }
    setSelectedGene('');
    setVariantAllele('');
    setMetabolizerStatus('');
  };

  const handleRemovePgxFactor = (factorToRemove: string) => {
    const updatedFactors = pgxFactors.filter(f => f !== factorToRemove);
    setPgxFactors(updatedFactors);
    setPharmacogenetics(updatedFactors.join(', '));
  };

  const [currentSupplement, setCurrentSupplement] = useState('');
  const [supplementSuggestions, setSupplementSuggestions] = useState<SupplementInfo[]>([]);
  const supplementAutocompleteRef = useRef<HTMLDivElement>(null);
  const [supplementInteractionCache, setSupplementInteractionCache] = useState<Record<string, { status: 'loading' | 'completed' | 'error', data: SupplementInteraction[], error?: string }>>({});

  const predefinedSubstanceList = useMemo(() => [
    t.substance_st_johns_wort, t.substance_melatonin, t.substance_omega3, t.substance_vitamin_d,
    t.substance_magnesium, t.substance_probiotics, t.substance_collagen, t.substance_mushrooms,
    t.substance_grapefruit_juice, t.substance_cranberry_juice, t.substance_alcohol, t.substance_tobacco,
  ], [t]);

  const { checkedSubstances, customSupplements } = useMemo<{ checkedSubstances: Set<string>; customSupplements: string[] }>(() => {
    const allItems = otherSubstances.split(',').map(s => s.trim()).filter(Boolean);
    const checked = new Set<string>(allItems.filter(item => predefinedSubstanceList.includes(item)));
    const custom = allItems.filter(item => !predefinedSubstanceList.includes(item));
    return { checkedSubstances: checked, customSupplements: custom };
  }, [otherSubstances, predefinedSubstanceList]);

  const updateParentOtherSubstances = (newChecked: Set<string>, newCustom: string[]) => {
      const combined = [...Array.from(newChecked), ...newCustom].filter(Boolean).join(', ');
      setOtherSubstances(combined);
  };

  const handleCheckboxSubstanceChange = (substanceName: string, isChecked: boolean) => {
    const updatedChecked = new Set<string>(checkedSubstances);
    if (isChecked) { updatedChecked.add(substanceName); } else { updatedChecked.delete(substanceName); }
    updateParentOtherSubstances(updatedChecked, customSupplements);
  };

  const handleSupplementInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentSupplement(value);
    const allAddedSubstances = new Set<string>([...customSupplements, ...Array.from(checkedSubstances)]);
    const filtered = supplementDatabase.filter(
        sup => (value === '' || sup.name.toLowerCase().includes(value.toLowerCase())) && !allAddedSubstances.has(sup.name)
    );
    setSupplementSuggestions(filtered.slice(0, 15));
  };
  
  const fetchInteractionForSupplement = useCallback(async (supplementName: string) => {
      if (medications.length === 0) {
          setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'completed', data: [] } }));
          return;
      }
      setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'loading', data: [] } }));
      try {
          const interactions = await analyzeSupplementInteractions(supplementName, medications, t.lang_code as 'es' | 'en');
          setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'completed', data: interactions } }));
      } catch (e: any) {
          if (e instanceof ApiKeyError) { onApiKeyError(); }
          setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'error', data: [], error: e.message || t.error_unexpected } }));
      }
  }, [medications, t, onApiKeyError]);

  // Proactive real-time analysis effect for all supplements (predefined and custom)
  useEffect(() => {
    const allSubstances = [...customSupplements, ...Array.from(checkedSubstances)];
    if(allSubstances.length > 0) {
        allSubstances.forEach(sup => {
            if (!supplementInteractionCache[sup]) {
                fetchInteractionForSupplement(sup);
            }
        });
    }
  }, [medications, customSupplements, checkedSubstances, fetchInteractionForSupplement, supplementInteractionCache]);

  const handleAddSupplement = (name?: string) => {
    const supplementToAdd = (name || currentSupplement).trim();
    if (supplementToAdd && !customSupplements.includes(supplementToAdd) && !checkedSubstances.has(supplementToAdd)) {
        const updatedCustom = [...customSupplements, supplementToAdd];
        updateParentOtherSubstances(checkedSubstances, updatedCustom);
        fetchInteractionForSupplement(supplementToAdd);
        setCurrentSupplement('');
        setSupplementSuggestions([]);
    }
  };

  const handleSupplementSuggestionClick = (suggestion: SupplementInfo) => { handleAddSupplement(suggestion.name); };
  const handleRemoveSupplement = (supplementToRemove: string) => {
    const updatedCustom = customSupplements.filter(s => s !== supplementToRemove);
    updateParentOtherSubstances(checkedSubstances, updatedCustom);
    setSupplementInteractionCache(prev => { const newCache = {...prev}; delete newCache[supplementToRemove]; return newCache; });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) { setSuggestions([]); }
      if (supplementAutocompleteRef.current && !supplementAutocompleteRef.current.contains(event.target as Node)) { setSupplementSuggestions([]); }
      if (conditionAutocompleteRef.current && !conditionAutocompleteRef.current.contains(event.target as Node)) { setConditionSuggestions([]); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  const handleAddMedication = () => {
    const medToAdd = currentMedication.trim();
    if (!medToAdd) return;
    if (medications.some(m => m.name.toLowerCase() === medToAdd.toLowerCase())) { setDuplicateMedError(t.form_med_duplicate_error); return; }
    setMedications([...medications, { name: medToAdd, dosage: '', frequency: '', potentialEffects: '', recommendations: '', references: '' }]);
    setCurrentMedication('');
    setSuggestions([]);
    setDuplicateMedError(null);
  };
  
  const handleMedicationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMedication(e.target.value);
    setActiveSuggestionIndex(0);
    if (duplicateMedError) setDuplicateMedError(null);
  };

  const handleSuggestionClick = (suggestion: DisplaySuggestion) => {
    if (medications.some(m => m.name.toLowerCase() === suggestion.name.toLowerCase())) { setDuplicateMedError(t.form_med_duplicate_error); setSuggestions([]); return; }
    let autoFreq = suggestion.commonFrequency || '';
    if (t.lang_code === 'es' && autoFreq.includes('daily')) { autoFreq = ''; }
    setMedications([...medications, { name: suggestion.name, dosage: suggestion.commonDosage || '', frequency: autoFreq, potentialEffects: '', recommendations: '', references: '' }]);
    setCurrentMedication('');
    setSuggestions([]);
    setDuplicateMedError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((suggestions.length > 0 || isFetchingMeds) && e.key !== 'Tab') {
      if (e.key === 'Enter') { e.preventDefault(); if(suggestions[activeSuggestionIndex]){ handleSuggestionClick(suggestions[activeSuggestionIndex]); }
      } else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev === 0 ? suggestions.length - 1 : prev - 1));
      } else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev === suggestions.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') { setSuggestions([]); }
    } else if (e.key === 'Enter') { e.preventDefault(); handleAddMedication(); }
  };

  const handleRemoveMedication = (index: number) => { setMedications(medications.filter((_, i) => i !== index)); };
  const handleMedicationDetailChange = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications];
    // @ts-ignore
    newMeds[index] = { ...newMeds[index], [field]: value };
    setMedications(newMeds);
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateOfBirth(value);
    if (value.trim() === '') { setDobError(null); return; }
    const regex = /^\d{2}-\d{2}-\d{4}$/;
    if (!regex.test(value)) { setDobError(t.form_dob_error_format); return; }
    const [day, month, year] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) { setDobError(t.form_dob_error_invalid);
    } else if (date > new Date()) { setDobError(t.form_dob_error_future); } else { setDobError(null); }
  };
  
  const isExistingProfile = existingPatientIds.has(patientId);
  const canAccessPgx = permissions.canAccessBatchAnalysis; 

  const activeAlerts = useMemo<ProactiveAlert[]>(() => {
    const alerts: ProactiveAlert[] = [];
    const medNamesLower = medications.map(m => m.name.toLowerCase());
    const allergyListLower = allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
    const conditionListLower = conditions.toLowerCase().split(',').map(c => c.trim()).filter(Boolean);

    allergyListLower.forEach(allergy => {
      for (const group in criticalAllergyRules) {
        if (allergy.includes(group)) {
          const conflictingDrugs = criticalAllergyRules[group];
          medNamesLower.forEach((medName, index) => {
            if (conflictingDrugs.includes(medName)) {
              const med = medications[index];
              alerts.push({ id: `allergy-${med.name}-${group}`, type: 'allergy', title: t.allergy_alert_title, message: t.allergy_alert_text.replace('{medication}', med.name).replace('{allergyGroup}', group.charAt(0).toUpperCase() + group.slice(1)) });
            }
          });
        }
      }
    });

    conditionListLower.forEach(condition => {
      for (const group in criticalConditionRules) {
        if (condition.includes(group)) {
          const rule = criticalConditionRules[group];
          medNamesLower.forEach((medName, index) => {
            if (rule.drugs.includes(medName)) {
              const med = medications[index];
              alerts.push({ id: `condition-${med.name}-${group}`, type: 'condition', title: t.condition_alert_title, message: t.condition_alert_text.replace('{medication}', med.name).replace('{condition}', group.charAt(0).toUpperCase() + group.slice(1)).replace('{reason}', t[rule.reasonKey]) });
            }
          });
        }
      }
    });

    criticalDrugInteractionRules.forEach(rule => {
      const [drug1, drug2] = rule.pair;
      if (medNamesLower.includes(drug1) && medNamesLower.includes(drug2)) {
        const med1 = medications.find(m => m.name.toLowerCase() === drug1)!;
        const med2 = medications.find(m => m.name.toLowerCase() === drug2)!;
        alerts.push({ id: `ddi-${drug1}-${drug2}`, type: 'drug-drug', title: t.ddi_alert_title, message: t.ddi_alert_text.replace('{med1}', med1.name).replace('{med2}', med2.name).replace('{reason}', t[rule.reasonKey]) });
      }
    });

    return Array.from(new Map(alerts.map(item => [item.id, item])).values());
  }, [medications, allergies, conditions, t]);

  const handleExplainFinding = async (findingId: string, title: string) => {
    if (explanations[findingId]) {
        const newExplanations = { ...explanations };
        delete newExplanations[findingId];
        setExplanations(newExplanations);
        return;
    }
    setExplainingId(findingId);
    try {
        const detail = await getDetailedInteractionInfo(title, medications, conditions, t.lang_code as 'es' | 'en');
        setExplanations(prev => ({ ...prev, [findingId]: detail }));
    } catch (e) { console.error("Error explaining finding", e); }
    finally { setExplainingId(null); }
  };

  const formattedExplanation = (text: string) => {
      return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
  };

  return (
    <div className={`space-y-6`}>
      <div>
        <label htmlFor="patient-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t.form_patient_id_label}
        </label>
        <input
          id="patient-id" type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder={t.form_patient_id_placeholder}
          className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
        />
      </div>
      
      <div ref={autocompleteRef}>
        <label htmlFor="medication-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t.form_medications_label}
        </label>
        <div className="flex items-center space-x-2 relative">
          <input
            id="medication-input" type="text" value={currentMedication} onChange={handleMedicationInputChange} onKeyDown={handleKeyDown} placeholder={t.form_medications_placeholder}
            className={`flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm transition duration-200 ${duplicateMedError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'}`}
            autoComplete="off"
          />
          <button
            type="button" onClick={() => handleAddMedication()} disabled={!currentMedication.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
          </button>
          {(suggestions.length > 0 || isFetchingMeds || (debouncedMedSearch.length > 1 && !isFetchingMeds)) && (
            <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {isFetchingMeds ? (
                <li className="relative cursor-default select-none py-2 px-4 text-slate-500 dark:text-slate-400 flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </li>
              ) : (
                <>
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={`${suggestion.name}-${index}`}
                      className={`relative cursor-default select-none py-2 px-4 transition-colors duration-150 ${index === activeSuggestionIndex ? 'bg-blue-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="truncate pr-2">
                          <p className="font-medium truncate">{suggestion.name}</p>
                          <p className={`text-[10px] truncate ${index === activeSuggestionIndex ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              {suggestion.subtitle || [suggestion.commonDosage, suggestion.commonFrequency].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-1 rounded border ${index === activeSuggestionIndex ? 'border-blue-200 text-blue-100' : 'border-slate-200 text-slate-400'}`}>
                          {suggestion.source}
                        </span>
                      </div>
                    </li>
                  ))}
                  {(!suggestions.some(s => s.name.toLowerCase() === currentMedication.toLowerCase())) && (
                      <li className="relative cursor-pointer select-none py-2 px-4 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700" onClick={() => handleAddMedication()}>
                          <div className="flex items-center">
                              <PlusIcon className="h-4 w-4 mr-2" />
                              <span className="font-medium text-xs">Usar entrada manual: "{currentMedication}"</span>
                          </div>
                      </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>
        {duplicateMedError && <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium animate-pulse">{duplicateMedError}</p>}
        <div className="mt-3 space-y-3">
          {medications.map((med, index) => (
            <MedicationItem key={`${med.name}-${index}`} medication={med} index={index} onRemove={() => handleRemoveMedication(index)} onChange={(field, value) => handleMedicationDetailChange(index, field, value)} t={t} />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="allergy-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_allergies_label}</label>
        <div className="flex items-center space-x-2">
            <input
                id="allergy-input" type="text" value={currentAllergy} onChange={(e) => setCurrentAllergy(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllergy(); } }}
                placeholder={t.form_allergies_placeholder}
                className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                autoComplete="off"
            />
            <button
                type="button" onClick={handleAddAllergy} disabled={!currentAllergy.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
            >
                <PlusIcon className="h-5 w-5" />
                <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
            </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
            {allergyTags.map((allergy) => (
                <span key={allergy} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    {allergy}
                    <button type="button" onClick={() => handleRemoveAllergy(allergy)} className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 transition-colors duration-200">
                        <TrashIcon className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
      </div>
      
      <div>
        <label htmlFor="date-of-birth" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_dob_label}</label>
        <input
          id="date-of-birth" type="text" value={dateOfBirth} onChange={handleDobChange} placeholder={t.form_dob_placeholder}
          className={`block w-full px-3 py-2 bg-white dark:bg-slate-900 border ${dobError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm transition duration-200`}
        />
        {dobError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dobError}</p>}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{t.form_substances_label}</label>
        
        {/* Predefined Substance Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mb-6">
          {predefinedSubstanceList.map((substance, index) => (
            <div key={index} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input id={`substance-${index}`} type="checkbox" checked={checkedSubstances.has(substance)} onChange={(e) => handleCheckboxSubstanceChange(substance, e.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 transition cursor-pointer" />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor={`substance-${index}`} className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">{substance}</label>
              </div>
            </div>
          ))}
        </div>

        {/* Global Supplement Search and Proactive Adder */}
        <div ref={supplementAutocompleteRef} className="relative">
            <label htmlFor="supplement-input" className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">{t.form_supplements_label}</label>
            <div className="flex items-center space-x-2">
                <input
                    id="supplement-input" 
                    type="text" 
                    value={currentSupplement} 
                    onChange={handleSupplementInputChange}
                    onFocus={handleSupplementInputChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSupplement(); } }}
                    placeholder={t.form_supplements_placeholder}
                    className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-blue-500 sm:text-sm transition duration-200"
                    autoComplete="off"
                />
                <button type="button" onClick={() => handleAddSupplement()} disabled={!currentSupplement.trim()} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200">
                    <PlusIcon className="h-5 w-5" />
                </button>
                {supplementSuggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-xl ring-1 ring-black ring-opacity-5 sm:text-sm">
                        {supplementSuggestions.map((suggestion) => (
                            <li key={suggestion.name} className="relative cursor-pointer select-none py-2 px-4 transition-colors duration-150 text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 last:border-0" onClick={() => handleSupplementSuggestionClick(suggestion)}>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold truncate">{suggestion.name}</p>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{suggestion.type}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {/* Added custom supplement chips */}
            <div className="mt-3 flex flex-wrap gap-2">
                {customSupplements.map((sup) => (
                    <span key={sup} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                        {sup}
                        <button type="button" onClick={() => handleRemoveSupplement(sup)} className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-500 hover:bg-red-200 transition-colors">
                            <TrashIcon className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.form_pharmacogenetics_label} <ProBadge /></label>
        {!canAccessPgx && (
            <div className="absolute inset-0 z-10 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-lg border border-transparent">
               <LockIcon className="h-8 w-8 text-slate-400 mb-2" />
               <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Solo disponible para usuarios Profesionales</p>
            </div>
        )}
        <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 ${!canAccessPgx ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="pgx-gene" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_gene_label}</label>
              <select id="pgx-gene" value={selectedGene} onChange={(e) => setSelectedGene(e.target.value)} disabled={!canAccessPgx} className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-blue-500 sm:text-sm transition duration-200">
                <option value="">{t.form_pgx_select_gene}</option>
                {Object.entries(pgxGeneGroups).map(([groupName, genes]) => (
                  <optgroup label={groupName} key={groupName}>
                    {(genes as string[]).map(gene => <option key={gene} value={gene}>{gene}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pgx-variant" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_variant_label}</label>
              <input id="pgx-variant" type="text" value={variantAllele} onChange={(e) => setVariantAllele(e.target.value)} disabled={!canAccessPgx} placeholder={t.form_pgx_variant_placeholder} className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-blue-500 sm:text-sm transition duration-200" />
            </div>
             <div>
              <label htmlFor="pgx-status" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_status_label}</label>
              <select id="pgx-status" value={metabolizerStatus} onChange={(e) => setMetabolizerStatus(e.target.value)} disabled={!canAccessPgx} className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-blue-500 sm:text-sm transition duration-200">
                <option value="">{t.form_pgx_select_status}</option>
                <option value="Poor Metabolizer (PM)">{t.form_pgx_status_poor}</option>
                <option value="Intermediate Metabolizer (IM)">{t.form_pgx_status_intermediate}</option>
                <option value="Normal Metabolizer (NM)">{t.form_pgx_status_normal}</option>
                <option value="Rapid Metabolizer (RM)">{t.form_pgx_status_rapid}</option>
                <option value="Ultrarapid Metabolizer (UM)">{t.form_pgx_status_rapid}</option>
                <option value="Carrier of risk allele">{t.form_pgx_status_carrier}</option>
              </select>
            </div>
          </div>
          <div className="mt-3 text-right">
              <button type="button" onClick={handleAddPgxFactor} disabled={!canAccessPgx || !selectedGene} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200">
                 <PlusIcon className="h-4 w-4 mr-1" /> {t.form_pgx_add_button}
              </button>
          </div>
        </div>
         <div className="mt-3 flex flex-wrap gap-2">
          {pgxFactors.map((factor) => (
            <span key={factor} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {factor}
              <button type="button" onClick={() => handleRemovePgxFactor(factor)} className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 transition-colors duration-200">
                <TrashIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="condition-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.form_conditions_label} <span className="text-red-500">*</span></label>
        <div className="flex items-center space-x-2 relative" ref={conditionAutocompleteRef}>
            <input
                id="condition-input" type="text" value={currentCondition} onChange={handleConditionInputChange} onKeyDown={handleConditionKeyDown} placeholder={t.form_conditions_placeholder}
                className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-blue-500 sm:text-sm transition duration-200"
                autoComplete="off"
            />
            <button type="button" onClick={() => handleAddCondition()} disabled={!currentCondition.trim()} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200">
                <PlusIcon className="h-5 w-5" />
            </button>
            {conditionSuggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 sm:text-sm">
                {conditionSuggestions.map((suggestion, index) => (
                  <li key={suggestion} className={`relative cursor-default select-none py-2 px-4 transition-colors duration-150 ${index === activeConditionSuggestionIndex ? 'bg-blue-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`} onClick={() => handleConditionSuggestionClick(suggestion)} onMouseEnter={() => setActiveConditionSuggestionIndex(index)}>
                    <p className="font-medium truncate">{suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
            {conditionTags.map((condition) => (
                <span key={condition} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    {condition}
                    <button type="button" onClick={() => handleRemoveCondition(condition)} className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 transition-colors duration-200">
                        <TrashIcon className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
      </div>
      
      {/* REAL-TIME RISK DETECTION PANEL */}
      {(activeAlerts.length > 0 || customSupplements.length > 0 || Array.from(checkedSubstances).length > 0) && (
        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in">
           <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center mb-2">
             <AlertTriangleIcon className="h-6 w-6 mr-2 text-amber-500" />
             {t.realtime_risk_panel_title}
           </h3>
           <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t.realtime_risk_panel_desc}</p>
           
           <div className="space-y-4">
              {/* Proactive Alerts (Drug-Drug, Condition, etc) */}
              {activeAlerts.map(alert => (
                <div key={alert.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-100 dark:border-red-900/30">
                   <div className="flex justify-between items-start">
                     <div>
                       <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">{alert.title}</h4>
                       <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{alert.message}</p>
                     </div>
                     <button 
                        onClick={() => handleExplainFinding(alert.id, alert.title + ": " + alert.message)}
                        disabled={explainingId === alert.id}
                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                     >
                       {explainingId === alert.id ? t.realtime_explaining_btn : (explanations[alert.id] ? "Ocultar" : t.realtime_explain_btn)}
                     </button>
                   </div>
                   {explanations[alert.id] && (
                     <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 animate-fade-in">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">{t.realtime_explanation_label}</p>
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded" dangerouslySetInnerHTML={{ __html: formattedExplanation(explanations[alert.id]) }}></div>
                     </div>
                   )}
                </div>
              ))}

              {/* All Substances Findings (including predefined ones) */}
              {[...customSupplements, ...Array.from(checkedSubstances)].map(sup => {
                 const analysis = supplementInteractionCache[sup];
                 if (!analysis || analysis.data.length === 0) return null;
                 return analysis.data.map((interaction, idx) => {
                   const id = `sup-${sup}-${idx}`;
                   return (
                    <div key={id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm">{sup} + {interaction.medication}</h4>
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1"><strong>{interaction.riskLevel}:</strong> {interaction.potentialEffects}</p>
                            </div>
                            <button 
                                onClick={() => handleExplainFinding(id, `${sup} and ${interaction.medication}: ${interaction.potentialEffects}`)}
                                disabled={explainingId === id}
                                className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                            >
                                {explainingId === id ? t.realtime_explaining_btn : (explanations[id] ? "Ocultar" : t.realtime_explain_btn)}
                            </button>
                        </div>
                        {explanations[id] && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 animate-fade-in">
                                <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">{t.realtime_explanation_label}</p>
                                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded" dangerouslySetInnerHTML={{ __html: formattedExplanation(explanations[id]) }}></div>
                            </div>
                        )}
                    </div>
                   );
                 });
              })}
           </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex-grow">
            {isApiKeyMissing && <p className="text-sm text-red-600 dark:text-red-400 text-left sm:text-right pr-4">{t.api_key_analysis_disabled}</p>}
        </div>
        {/* Fixed: correctly called onClear prop instead of undefined handleClear */}
        <button type="button" onClick={onClear} disabled={isLoading} className="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors duration-200">
            {t.form_clear_button}
        </button>
        <div className="relative w-full sm:w-auto">
          <button type="button" onClick={handleSaveProfile} disabled={isLoading || !patientId.trim()} className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors duration-200">
            <SaveIcon className="h-5 w-5 mr-2" /> {isExistingProfile ? t.form_update_profile_button : t.form_save_profile_button}
          </button>
          {showSaveNotification && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md shadow-lg whitespace-nowrap animate-fade-in">
                  {isExistingProfile ? t.profile_updated_toast : t.profile_saved_toast}
              </div>
          )}
        </div>
        <button type="button" onClick={onAnalyze} disabled={isLoading || !!dobError || isApiKeyMissing} className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 transition-all duration-200">
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {t.form_analyzing_button}
                </>
            ) : (
                <>
                    <SparklesIcon className="h-5 w-5 mr-2" /> {t.form_analyze_button}
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default InteractionForm;
