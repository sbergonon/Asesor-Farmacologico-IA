import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { drugDatabase, type DrugInfo } from '../data/drugNames';
import { supplementDatabase, type SupplementInfo } from '../data/supplements';
import { pgxGeneGroups } from '../data/pgxGenes';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import SaveIcon from './icons/SaveIcon';
import type { Medication, SupplementInteraction } from '../types';
import { translations } from '../lib/translations';
import { analyzeSupplementInteractions } from '../services/geminiService';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { drugSynonymMap } from '../data/drugSynonyms';
import { commonConditions } from '../data/conditions';

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
  t: (typeof translations)['es'] | (typeof translations)['en'];
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface DisplaySuggestion extends DrugInfo {
  subtitle?: string;
  source: 'local' | 'api';
}


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
  t,
}) => {
  const [currentMedication, setCurrentMedication] = useState('');
  const [suggestions, setSuggestions] = useState<DisplaySuggestion[]>([]);
  const [isFetchingMeds, setIsFetchingMeds] = useState(false);
  const debouncedMedSearch = useDebounce(currentMedication, 300);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [dobError, setDobError] = useState<string | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [advancedVisible, setAdvancedVisible] = useState<Record<number, boolean>>({});
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  const toggleAdvanced = (index: number) => {
    setAdvancedVisible(prev => ({...prev, [index]: !prev[index]}));
  };
  
  const handleSave = () => {
    onSaveProfile();
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  // --- Allergies State ---
  const [currentAllergy, setCurrentAllergy] = useState('');
  const allergyTags = useMemo(() => allergies.split(',').map(a => a.trim()).filter(Boolean), [allergies]);

  const handleAddAllergy = () => {
    // Split input by commas to handle multiple entries at once
    const newAllergies = currentAllergy
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

    if (newAllergies.length === 0) {
        setCurrentAllergy('');
        return;
    }

    // Get current tags for duplicate checking (case-insensitive)
    const currentTagsLower = allergyTags.map(a => a.toLowerCase());
    
    // Filter out any new tags that are already present
    const uniqueNewTags = newAllergies.filter(
        newTag => !currentTagsLower.includes(newTag.toLowerCase())
    );

    // If there are any unique new tags to add, update the state
    if (uniqueNewTags.length > 0) {
        setAllergies([...allergyTags, ...uniqueNewTags].join(', '));
    }
    
    // Clear the input field
    setCurrentAllergy('');
  };
  
  const handleRemoveAllergy = (allergyToRemove: string) => {
    setAllergies(allergyTags.filter(a => a !== allergyToRemove).join(', '));
  };


  // --- Conditions State ---
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
            condition =>
                condition.toLowerCase().includes(lowerCaseValue) &&
                !addedConditionsSet.has(condition.toLowerCase())
        );
        setConditionSuggestions(filtered.slice(0, 10));
    } else {
        setConditionSuggestions([]);
    }
  };

  const handleAddCondition = (condition?: string) => {
    const conditionToAdd = (condition || currentCondition).trim();
    if (conditionToAdd && !conditionTags.includes(conditionToAdd)) {
        setConditions([...conditionTags, conditionToAdd].join(', '));
    }
    setCurrentCondition('');
    setConditionSuggestions([]);
  };
  
  const handleConditionSuggestionClick = (suggestion: string) => {
    handleAddCondition(suggestion);
  };

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
      } else if (e.key === 'Escape') {
          setConditionSuggestions([]);
      }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCondition();
    }
  };


  const handleRemoveCondition = (conditionToRemove: string) => {
    setConditions(conditionTags.filter(c => c !== conditionToRemove).join(', '));
  };


  // --- Pharmacogenetics State ---
  const [pgxFactors, setPgxFactors] = useState<string[]>([]);
  const [selectedGene, setSelectedGene] = useState('');
  const [variantAllele, setVariantAllele] = useState('');
  const [metabolizerStatus, setMetabolizerStatus] = useState('');

  // Sync with parent state
  useEffect(() => {
    setPgxFactors(pharmacogenetics.split(',').map(s => s.trim()).filter(Boolean));
  }, [pharmacogenetics]);

  const handleAddPgxFactor = () => {
    if (!selectedGene) return;
    
    let newFactor = selectedGene;
    const trimmedVariant = variantAllele.trim();
    if (trimmedVariant) {
      newFactor += ` ${trimmedVariant}`;
    }
    if (metabolizerStatus) {
      newFactor += ` (${metabolizerStatus})`;
    }
    
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


  // --- Other Substances & Supplements State ---
  const [currentSupplement, setCurrentSupplement] = useState('');
  const [supplementSuggestions, setSupplementSuggestions] = useState<SupplementInfo[]>([]);
  const supplementAutocompleteRef = useRef<HTMLDivElement>(null);
  const [supplementInteractionCache, setSupplementInteractionCache] = useState<Record<string, { status: 'loading' | 'completed' | 'error', data: SupplementInteraction[], error?: string }>>({});


  const predefinedSubstanceList = useMemo(() => [
    t.substance_st_johns_wort,
    t.substance_alcohol,
    t.substance_tobacco,
    t.substance_grapefruit_juice,
    t.substance_cranberry_juice,
  ], [t]);

  const { checkedSubstances, customSupplements } = useMemo(() => {
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
    const updatedChecked = new Set(checkedSubstances);
    if (isChecked) {
        updatedChecked.add(substanceName);
    } else {
        updatedChecked.delete(substanceName);
    }
    updateParentOtherSubstances(updatedChecked, customSupplements);
  };

  const handleSupplementInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentSupplement(value);
    if (value.length > 0) {
      // FIX: Explicitly type the Set to avoid type inference issues and simplify creation.
      const allAddedSubstances = new Set<string>([...customSupplements, ...checkedSubstances]);
      const filtered = supplementDatabase.filter(
        sup => 
          sup.name.toLowerCase().includes(value.toLowerCase()) &&
          !allAddedSubstances.has(sup.name)
      );
      
      const sorted = filtered.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const queryLower = value.toLowerCase();

        if (aLower === queryLower) return -1;
        if (bLower === queryLower) return 1;

        const aStartsWith = aLower.startsWith(queryLower);
        const bStartsWith = bLower.startsWith(queryLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        return aLower.localeCompare(bLower);
      });

      setSupplementSuggestions(sorted);
    } else {
      setSupplementSuggestions([]);
    }
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
          setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'error', data: [], error: e.message || t.error_unexpected } }));
      }
  }, [medications, t]);

  useEffect(() => {
    // When medications change, re-analyze all custom supplements.
    if(customSupplements.length > 0) {
        customSupplements.forEach(sup => fetchInteractionForSupplement(sup));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medications]);


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

  const handleSupplementSuggestionClick = (suggestion: SupplementInfo) => {
    handleAddSupplement(suggestion.name);
  };

  const handleRemoveSupplement = (supplementToRemove: string) => {
    const updatedCustom = customSupplements.filter(s => s !== supplementToRemove);
    updateParentOtherSubstances(checkedSubstances, updatedCustom);
    setSupplementInteractionCache(prev => {
        const newCache = {...prev};
        delete newCache[supplementToRemove];
        return newCache;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
      if (supplementAutocompleteRef.current && !supplementAutocompleteRef.current.contains(event.target as Node)) {
        setSupplementSuggestions([]);
      }
      if (conditionAutocompleteRef.current && !conditionAutocompleteRef.current.contains(event.target as Node)) {
        setConditionSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAddMedication = () => {
    const medToAdd = currentMedication.trim();
    if (medToAdd && !medications.some(m => m.name.toLowerCase() === medToAdd.toLowerCase())) {
      setMedications([...medications, { name: medToAdd, dosage: '', frequency: '', potentialEffects: '', recommendations: '', references: '' }]);
      setCurrentMedication('');
      setSuggestions([]);
    }
  };
  
  const handleMedicationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMedication(e.target.value);
    setActiveSuggestionIndex(0);
  };

  useEffect(() => {
    if (debouncedMedSearch.length < 2) {
      setSuggestions([]);
      return;
    }

    const searchMedications = async () => {
      setIsFetchingMeds(true);
      const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
      const queryLower = debouncedMedSearch.toLowerCase();
      const genericName = drugSynonymMap[queryLower];

      // 1. Local search from our curated database
      const localSuggestions: DisplaySuggestion[] = drugDatabase
        .filter(drug => {
            const drugLower = drug.name.toLowerCase();
            return drugLower.includes(queryLower) || (genericName && drugLower.includes(genericName.toLowerCase()));
        })
        .map(drug => ({ ...drug, source: 'local' }));

      // 2. API search from openFDA for broader results
      let apiSuggestions: DisplaySuggestion[] = [];
      try {
        const searchTerms = new Set<string>();
        searchTerms.add(queryLower);
        if (genericName) {
          searchTerms.add(genericName.toLowerCase());
        }

        // Broader query with fuzzy matching (~1) for misspellings across multiple fields
        const fieldQueries = Array.from(searchTerms).map(term =>
            `(generic_name:${term}~1 OR brand_name:${term}~1 OR active_ingredients.name:${term}~1)`
        );
        const searchQuery = fieldQueries.join(' OR ');
        
        const response = await fetch(`https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(searchQuery)}&limit=20`);
        if (response.ok) {
          const data = await response.json();
          const uniqueNames = new Set<string>();
          apiSuggestions = (data.results || []).reduce((acc: DisplaySuggestion[], drug: any) => {
            const brandName = drug.brand_name ? toTitleCase(drug.brand_name) : null;
            const genericNameFromApi = drug.generic_name ? toTitleCase(drug.generic_name.split(',')[0].trim()) : null;
            
            if (brandName && !uniqueNames.has(brandName.toLowerCase())) {
              acc.push({ name: brandName, source: 'api' });
              uniqueNames.add(brandName.toLowerCase());
            }
            if (genericNameFromApi && !uniqueNames.has(genericNameFromApi.toLowerCase())) {
              acc.push({ name: genericNameFromApi, source: 'api' });
              uniqueNames.add(genericNameFromApi.toLowerCase());
            }
            return acc;
          }, []);
        }
      } catch (error) {
        console.error("Failed to fetch medication suggestions:", error);
      }

      // 3. Merge, giving priority to local results for duplicates
      const combined = new Map<string, DisplaySuggestion>();
      localSuggestions.forEach(s => combined.set(s.name.toLowerCase(), s));
      apiSuggestions.forEach(s => {
        if (!combined.has(s.name.toLowerCase())) {
          combined.set(s.name.toLowerCase(), s);
        }
      });
      
      medications.forEach(med => combined.delete(med.name.toLowerCase()));

      const sortedSuggestions = Array.from(combined.values())
        .map((s) => {
            const suggestion: DisplaySuggestion = { ...s };
            if (genericName && s.name.toLowerCase() === genericName.toLowerCase()) {
                suggestion.subtitle = `Generic for ${toTitleCase(debouncedMedSearch)}`;
            }
            return suggestion;
        })
        .sort((a, b) => {
            const calculateScore = (item: DisplaySuggestion): number => {
                let score = 0;
                const itemLower = item.name.toLowerCase();
                const genericLower = genericName ? genericName.toLowerCase() : null;

                // Match quality score
                if (itemLower === queryLower) score += 100; // Exact match
                else if (genericLower && itemLower === genericLower) score += 90; // Exact generic match
                else if (itemLower.startsWith(queryLower)) score += 50; // Starts with query
                else if (itemLower.includes(queryLower)) score += 5; // Contains query

                // Source & Quality score
                if (item.source === 'local') score += 30; // Boost local results more
                if (item.commonDosage) score += 10; // Bonus for curated data

                return score;
            };

            const scoreA = calculateScore(a);
            const scoreB = calculateScore(b);

            if (scoreB !== scoreA) {
                return scoreB - scoreA; // Higher score first
            }
            
            return a.name.localeCompare(b.name); // Alphabetical fallback
        });

      setSuggestions(sortedSuggestions);
      setIsFetchingMeds(false);
    };

    searchMedications();
  }, [debouncedMedSearch, medications]);

  const handleSuggestionClick = (suggestion: DisplaySuggestion) => {
    if (suggestion && !medications.some(m => m.name.toLowerCase() === suggestion.name.toLowerCase())) {
      setMedications([...medications, {
        name: suggestion.name,
        dosage: suggestion.commonDosage || '',
        frequency: suggestion.commonFrequency || '',
        potentialEffects: '',
        recommendations: '',
        references: '',
      }]);
    }
    setCurrentMedication('');
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((suggestions.length > 0 || isFetchingMeds) && e.key !== 'Tab') {
      if (e.key === 'Enter') {
          e.preventDefault();
          if(suggestions[activeSuggestionIndex]){
            handleSuggestionClick(suggestions[activeSuggestionIndex]);
          }
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveSuggestionIndex(prev => (prev === 0 ? suggestions.length - 1 : prev - 1));
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveSuggestionIndex(prev => (prev === suggestions.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
          setSuggestions([]);
      }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddMedication();
    }
  };


  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };
  
  const handleMedicationDetailChange = (index: number, field: 'dosage' | 'frequency' | 'potentialEffects' | 'recommendations' | 'references', value: string) => {
    const newMeds = [...medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setMedications(newMeds);
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateOfBirth(value);

    if (value.trim() === '') {
      setDobError(null);
      return;
    }

    const regex = /^\d{2}-\d{2}-\d{4}$/;
    if (!regex.test(value)) {
      setDobError(t.form_dob_error_format);
      return;
    }

    const [day, month, year] = value.split('-').map(Number);
    // JavaScript months are 0-indexed, so subtract 1 from month.
    const date = new Date(year, month - 1, day);
    
    // Check if the constructed date is valid and matches the input parts.
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
      setDobError(t.form_dob_error_invalid);
    } else if (date > new Date()) {
      setDobError(t.form_dob_error_future);
    } else {
      setDobError(null);
    }
  };
  
  const isExistingProfile = existingPatientIds.has(patientId);

  return (
    <div className={`space-y-6`}>
      <div>
        <label htmlFor="patient-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t.form_patient_id_label}
        </label>
        <input
          id="patient-id"
          type="text"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder={t.form_patient_id_placeholder}
          className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
        />
      </div>
      
      <div ref={autocompleteRef}>
        <label htmlFor="medication-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t.form_medications_label}
        </label>
        <div className="flex items-center space-x-2 relative">
          <input
            id="medication-input"
            type="text"
            value={currentMedication}
            onChange={handleMedicationInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t.form_medications_placeholder}
            className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => handleAddMedication()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
            disabled={!currentMedication.trim()}
          >
            <PlusIcon className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
          </button>
          {(suggestions.length > 0 || isFetchingMeds) && (
            <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {isFetchingMeds ? (
                <li className="relative cursor-default select-none py-2 px-4 text-slate-500 dark:text-slate-400">Searching...</li>
              ) : (
                suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.name}-${index}`}
                    className={`relative cursor-default select-none py-2 px-4 transition-colors duration-150 ${
                      index === activeSuggestionIndex 
                      ? 'bg-blue-500 text-white' 
                      : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                  >
                    <p className="font-medium truncate">{suggestion.name}</p>
                    <p className={`text-xs truncate ${index === activeSuggestionIndex ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>
                        {suggestion.subtitle || [suggestion.commonDosage, suggestion.commonFrequency].filter(Boolean).join(', ')}
                    </p>
                  </li>
                ))
              )}
               { !isFetchingMeds && suggestions.length === 0 && debouncedMedSearch.length > 1 && (
                  <li className="relative cursor-default select-none py-2 px-4 text-slate-500 dark:text-slate-400">No results found.</li>
                )}
            </ul>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {medications.map((med, index) => (
            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{med.name}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(index)}
                    className="ml-2 -mt-1 -mr-1 flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
                  >
                    <span className="sr-only">{t.form_remove_med_sr.replace('{med}', med.name)}</span>
                    <TrashIcon className="h-4 w-4" />
                  </button>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                      <label htmlFor={`dosage-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_dosage_label}</label>
                      <input
                          id={`dosage-${index}`}
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleMedicationDetailChange(index, 'dosage', e.target.value)}
                          placeholder={t.form_dosage_placeholder}
                          className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                      />
                  </div>
                  <div>
                      <label htmlFor={`frequency-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_frequency_label}</label>
                      <input
                          id={`frequency-${index}`}
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleMedicationDetailChange(index, 'frequency', e.target.value)}
                          placeholder={t.form_frequency_placeholder}
                          className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                      />
                  </div>
              </div>
              <div className="mt-2">
                  <button type="button" onClick={() => toggleAdvanced(index)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
                      {advancedVisible[index] ? t.form_hide_optional_details : t.form_add_optional_details}
                  </button>
              </div>
              {advancedVisible[index] && (
                  <div className="mt-2 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div>
                          <label htmlFor={`effects-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_effects_label}</label>
                          <textarea
                              id={`effects-${index}`}
                              rows={2}
                              value={med.potentialEffects || ''}
                              onChange={(e) => handleMedicationDetailChange(index, 'potentialEffects', e.target.value)}
                              placeholder={t.form_effects_placeholder}
                              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                          />
                      </div>
                      <div>
                          <label htmlFor={`recommendations-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_recommendations_label}</label>
                          <textarea
                              id={`recommendations-${index}`}
                              rows={2}
                              value={med.recommendations || ''}
                              onChange={(e) => handleMedicationDetailChange(index, 'recommendations', e.target.value)}
                              placeholder={t.form_recommendations_placeholder}
                              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                          />
                      </div>
                      <div>
                          <label htmlFor={`references-${index}`} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_references_label}</label>
                          <input
                              id={`references-${index}`}
                              type="text"
                              value={med.references || ''}
                              onChange={(e) => handleMedicationDetailChange(index, 'references', e.target.value)}
                              placeholder={t.form_references_placeholder}
                              className="block w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                          />
                      </div>
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="allergy-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t.form_allergies_label}
        </label>
        <div className="flex items-center space-x-2">
            <input
                id="allergy-input"
                type="text"
                value={currentAllergy}
                onChange={(e) => setCurrentAllergy(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllergy(); } }}
                placeholder={t.form_allergies_placeholder}
                className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                autoComplete="off"
            />
            <button
                type="button"
                onClick={handleAddAllergy}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
                disabled={!currentAllergy.trim()}
            >
                <PlusIcon className="h-5 w-5" />
                <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
            </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.form_allergies_note}</p>
        <div className="mt-3 flex flex-wrap gap-2">
            {allergyTags.map((allergy) => (
                <span key={allergy} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    {allergy}
                    <button
                        type="button"
                        onClick={() => handleRemoveAllergy(allergy)}
                        className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
                    >
                        <span className="sr-only">{t.form_remove_med_sr.replace('{med}', allergy)}</span>
                        <TrashIcon className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
      </div>
      
      <div>
        <label htmlFor="date-of-birth" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t.form_dob_label}
        </label>
        <input
          id="date-of-birth"
          type="text"
          value={dateOfBirth}
          onChange={handleDobChange}
          placeholder={t.form_dob_placeholder}
          className={`block w-full px-3 py-2 bg-white dark:bg-slate-900 border ${
            dobError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
          } rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200`}
          aria-describedby="dob-error"
          aria-invalid={!!dobError}
        />
        {dobError && (
          <p id="dob-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {dobError}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t.form_dob_note}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t.form_substances_label}
        </label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          {predefinedSubstanceList.map((substance, index) => (
            <div key={index} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`substance-${index}`}
                  type="checkbox"
                  checked={checkedSubstances.has(substance)}
                  onChange={(e) => handleCheckboxSubstanceChange(substance, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 transition"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor={`substance-${index}`} className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  {substance}
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4" ref={supplementAutocompleteRef}>
            <label htmlFor="supplement-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.form_supplements_label}
            </label>
            <div className="flex items-center space-x-2 relative">
                <input
                    id="supplement-input"
                    type="text"
                    value={currentSupplement}
                    onChange={handleSupplementInputChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSupplement(); } }}
                    placeholder={t.form_supplements_placeholder}
                    className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => handleAddSupplement()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
                    disabled={!currentSupplement.trim()}
                >
                    <PlusIcon className="h-5 w-5" />
                    <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
                </button>
                {supplementSuggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {supplementSuggestions.map((suggestion, index) => (
                            <li
                                key={suggestion.name}
                                className={`relative cursor-default select-none py-2 px-4 transition-colors duration-150 text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`}
                                onClick={() => handleSupplementSuggestionClick(suggestion)}
                            >
                                <p className="font-medium truncate">{suggestion.name}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
        <div className="mt-3 space-y-3">
          {customSupplements.map((supplement) => {
              const analysis = supplementInteractionCache[supplement];
              return (
                  <div key={supplement} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200">{supplement}</h4>
                          <div className="flex items-center space-x-2">
                            {analysis?.status === 'loading' && (
                               <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSupplement(supplement)}
                              className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
                            >
                              <span className="sr-only">{t.form_remove_med_sr.replace('{med}', supplement)}</span>
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                      </div>
                      {analysis && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                              {analysis.status === 'completed' && analysis.data.length === 0 && (
                                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                                  <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                                  <p>{t.supplement_no_interactions}</p>
                                </div>
                              )}
                              {analysis.status === 'completed' && analysis.data.length > 0 && (
                                <div className="space-y-2">
                                  {analysis.data.map((interaction, index) => (
                                    <div key={index} className="text-sm p-2 bg-amber-50 dark:bg-amber-900/30 rounded-md">
                                        <p><strong>{t.results_interaction}:</strong> {interaction.medication} ({interaction.riskLevel})</p>
                                        <p className="text-xs mt-1"><strong>{t.results_potential_effects}:</strong> {interaction.potentialEffects}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analysis.status === 'error' && (
                                <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                                  <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                                  <p>{t.supplement_analysis_error}: {analysis.error}</p>
                                </div>
                              )}
                          </div>
                      )}
                  </div>
              );
          })}
      </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t.form_pharmacogenetics_label}
        </label>
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="pgx-gene" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_gene_label}</label>
              <select 
                id="pgx-gene" 
                value={selectedGene}
                onChange={(e) => setSelectedGene(e.target.value)}
                className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              >
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
              <input 
                  id="pgx-variant"
                  type="text"
                  value={variantAllele}
                  onChange={(e) => setVariantAllele(e.target.value)}
                  placeholder={t.form_pgx_variant_placeholder}
                  className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              />
            </div>
             <div>
              <label htmlFor="pgx-status" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_status_label}</label>
              <select 
                id="pgx-status"
                value={metabolizerStatus}
                onChange={(e) => setMetabolizerStatus(e.target.value)}
                className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
              >
                <option value="">{t.form_pgx_select_status}</option>
                <option value={t.form_pgx_status_poor}>{t.form_pgx_status_poor}</option>
                <option value={t.form_pgx_status_intermediate}>{t.form_pgx_status_intermediate}</option>
                <option value={t.form_pgx_status_normal}>{t.form_pgx_status_normal}</option>
                <option value={t.form_pgx_status_rapid}>{t.form_pgx_status_rapid}</option>
                <option value={t.form_pgx_status_carrier}>{t.form_pgx_status_carrier}</option>
              </select>
            </div>
          </div>
          <div className="mt-3 text-right">
              <button
                type="button"
                onClick={handleAddPgxFactor}
                disabled={!selectedGene}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
              >
                 <PlusIcon className="h-4 w-4 mr-1" />
                {t.form_pgx_add_button}
              </button>
          </div>
        </div>
         <div className="mt-3 flex flex-wrap gap-2">
          {pgxFactors.map((factor) => (
            <span key={factor} className="inline-flex items-center py-1 pl-3 pr-2 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {factor}
              <button
                type="button"
                onClick={() => handleRemovePgxFactor(factor)}
                className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
              >
                <span className="sr-only">{t.form_remove_med_sr.replace('{med}', factor)}</span>
                <TrashIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="condition-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t.form_conditions_label} <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center space-x-2 relative" ref={conditionAutocompleteRef}>
            <input
                id="condition-input"
                type="text"
                value={currentCondition}
                onChange={handleConditionInputChange}
                onKeyDown={handleConditionKeyDown}
                placeholder={t.form_conditions_placeholder}
                className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200"
                autoComplete="off"
            />
            <button
                type="button"
                onClick={() => handleAddCondition()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
                disabled={!currentCondition.trim()}
            >
                <PlusIcon className="h-5 w-5" />
                <span className="ml-2 hidden sm:inline">{t.form_add_button}</span>
            </button>
            {conditionSuggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {conditionSuggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className={`relative cursor-default select-none py-2 px-4 transition-colors duration-150 ${
                      index === activeConditionSuggestionIndex 
                      ? 'bg-blue-500 text-white' 
                      : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => handleConditionSuggestionClick(suggestion)}
                    onMouseEnter={() => setActiveConditionSuggestionIndex(index)}
                  >
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
                    <button
                        type="button"
                        onClick={() => handleRemoveCondition(condition)}
                        className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:bg-red-500 focus:text-white transition-colors duration-200"
                    >
                        <span className="sr-only">{t.form_remove_med_sr.replace('{med}', condition)}</span>
                        <TrashIcon className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
            type="button"
            onClick={onClear}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-colors duration-200"
        >
            {t.form_clear_button}
        </button>
        <div className="relative w-full sm:w-auto">
          <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !patientId.trim()}
              className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <SaveIcon className="h-5 w-5 mr-2" />
            {isExistingProfile ? t.form_update_profile_button : t.form_save_profile_button}
          </button>
          {showSaveNotification && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md shadow-lg whitespace-nowrap">
                  {isExistingProfile ? t.profile_updated_toast : t.profile_saved_toast}
              </div>
          )}
        </div>
        <button
            type="button"
            onClick={onAnalyze}
            disabled={isLoading || !!dobError}
            className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.form_analyzing_button}
                </>
            ) : (
                <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    {t.form_analyze_button}
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default InteractionForm;