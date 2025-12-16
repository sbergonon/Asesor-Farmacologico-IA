import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { drugDatabase, type DrugInfo } from '../data/drugNames';
import { supplementDatabase, type SupplementInfo } from '../data/supplements';
import { pgxGeneGroups } from '../data/pgxGenes';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import SaveIcon from './icons/SaveIcon';
import type { Medication, SupplementInteraction } from '../types';
import { ApiKeyError } from '../types';
import { translations } from '../lib/translations';
import { analyzeSupplementInteractions } from '../services/geminiService';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { drugSynonymMap } from '../data/drugSynonyms';
import { commonConditions } from '../data/conditions';
import ProBadge from './ProBadge';
import ProactiveAlerts from './ProactiveAlerts';
import { useAuth } from '../contexts/AuthContext';
import LockIcon from './icons/LockIcon';
import MedicationItem from './MedicationItem';

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
  matchScore?: number; // Used for final sorting (higher is better)
  matchedTerm?: string;
  type?: 'generic' | 'brand'; // Track if it was a generic or brand match
  genericName?: string; // Keep track of the underlying generic
}

// Search Item interface for Fuse
interface SearchItem {
    term: string; // The text to search (Brand or Generic name)
    type: 'generic' | 'brand';
    genericName: string; // The target generic name
    data: DrugInfo; // The full drug info
}

// Helper to calculate a unified relevance score
const calculateRelevance = (item: DisplaySuggestion, query: string, lang: string, fuseScore?: number): number => {
    let score = 0;
    const name = item.name.toLowerCase();
    const matchedTerm = (item.matchedTerm || item.name).toLowerCase();
    const q = query.toLowerCase();

    // 1. Fuzzy Score (Base)
    if (fuseScore !== undefined) {
        // Fuse score is 0 (perfect) to 1 (bad). Invert it to 0-100.
        score += (1 - fuseScore) * 100;
    } else {
        // Fallback for API results without Fuse score
        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 80;
        else if (name.includes(q)) score += 60;
        else score += 40;
    }

    // 2. Source Priority (Local is trusted/curated)
    if (item.source === 'local') score += 100; // Increased priority for local

    // 3. Exact Match Bonus (Huge boost)
    if (matchedTerm === q) score += 300;

    // 4. Starts With Bonus (Critical for autocomplete feel)
    if (matchedTerm.startsWith(q)) score += 150;

    // 5. Word Starts With Bonus (e.g. "acid" in "Valproic acid")
    if (matchedTerm.includes(' ' + q)) score += 50;

    // 6. Length Penalty 
    // Penalize results that are much longer than the query to prefer concise matches
    const lengthDiff = Math.abs(matchedTerm.length - q.length);
    score -= lengthDiff * 1.5;

    // 7. Language Preference Bonus
    // If interface is Spanish, boost 'brand' matches (which contain Spanish synonyms like 'Ibuprofeno')
    // slightly over English generics (like 'Ibuprofen') if scores are otherwise close.
    if (lang === 'es' && item.type === 'brand') {
        score += 25; 
    }

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
  const debouncedMedSearch = useDebounce(currentMedication, 300);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [dobError, setDobError] = useState<string | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [duplicateMedError, setDuplicateMedError] = useState<string | null>(null);

  // Prepare a unified search index for Fuse (Generics + Brands)
  const searchIndex = useMemo<SearchItem[]>(() => {
      const list: SearchItem[] = [];
      
      // 1. Add Generics
      drugDatabase.forEach(d => {
          list.push({ 
              term: d.name, 
              type: 'generic', 
              genericName: d.name, 
              data: d 
          });
      });

      // 2. Add Brands/Synonyms
      Object.entries(drugSynonymMap).forEach(([brand, generic]) => {
          // Find the generic info if it exists in our DB, otherwise stub it
          const genericInfo = drugDatabase.find(d => d.name.toLowerCase() === generic.toLowerCase()) 
              || { name: generic, dosage: '', frequency: '' }; // Stub for known synonyms not in main DB
          
          list.push({
              term: brand, // The fuzzy search target (e.g. "advil")
              type: 'brand',
              genericName: genericInfo.name, // The result (e.g. "Ibuprofen")
              data: genericInfo
          });
      });

      return list;
  }, []);

  // Initialize Fuse.js with the unified index
  const fuse = useMemo(() => {
    return new Fuse(searchIndex, {
      keys: ['term'],
      threshold: 0.35, // Sensitivity: 0.0 is exact match, 1.0 matches anything. 0.35 handles typos well.
      includeScore: true,
      distance: 100,
      minMatchCharLength: 2,
    });
  }, [searchIndex]);

  const handleSaveProfile = () => {
    onSaveProfile();
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };
  
  // --- Allergies State ---
  const [currentAllergy, setCurrentAllergy] = useState('');
  const allergyTags = useMemo(() => allergies.split(',').map(a => a.trim()).filter(Boolean), [allergies]);

  const handleAddAllergy = () => {
    const newAllergies = currentAllergy.split(',').map(a => a.trim()).filter(Boolean);
    if (newAllergies.length === 0) {
        setCurrentAllergy('');
        return;
    }
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
    t.substance_melatonin,
    t.substance_omega3,
    t.substance_vitamin_d,
    t.substance_magnesium,
    t.substance_probiotics,
    t.substance_collagen,
    t.substance_mushrooms,
    t.substance_grapefruit_juice,
    t.substance_cranberry_juice,
    t.substance_alcohol,
    t.substance_tobacco,
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
      const allAddedSubstances = new Set<string>([...customSupplements, ...Array.from(checkedSubstances)]);
      const filtered = supplementDatabase.filter(
        sup => 
          sup.name.toLowerCase().includes(value.toLowerCase()) &&
          !allAddedSubstances.has(sup.name)
      );
      setSupplementSuggestions(filtered);
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
          if (e instanceof ApiKeyError) {
            onApiKeyError();
          }
          setSupplementInteractionCache(prev => ({ ...prev, [supplementName]: { status: 'error', data: [], error: e.message || t.error_unexpected } }));
      }
  }, [medications, t, onApiKeyError]);

  useEffect(() => {
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
    if (!medToAdd) return;
    
    // Exact match check (Case-insensitive)
    if (medications.some(m => m.name.toLowerCase() === medToAdd.toLowerCase())) {
        setDuplicateMedError(t.form_med_duplicate_error);
        return;
    }

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

  // Clear suggestions immediately when input is short/empty, improving responsiveness
  useEffect(() => {
      if (currentMedication.length < 2) {
          setSuggestions([]);
          setIsFetchingMeds(false);
      }
  }, [currentMedication]);

  // --- Optimized Medication Search Logic with Fuzzy Matching & Weighted Scoring ---
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (debouncedMedSearch.length < 2) {
      // Logic handled by immediate effect above, but double check here to prevent stale fetches
      setIsFetchingMeds(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsFetchingMeds(true);
      const queryLower = debouncedMedSearch.toLowerCase();
      const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

      try {
        const combined = new Map<string, DisplaySuggestion>();

        // 1. Local Search (Fuse.js) against Generics AND Brands
        // This handles "Tyelnol" -> "Tylenol" (brand) -> "Acetaminophen" (generic)
        // And "Acetamino" -> "Acetaminophen" (generic)
        const fuseResults = fuse.search(debouncedMedSearch);
        
        let maxLocalScore = 0;

        fuseResults.forEach(result => {
            const genericName = result.item.genericName;
            const genericKey = genericName.toLowerCase();
            const isBrandMatch = result.item.type === 'brand';
            const matchedNameTitle = toTitleCase(result.item.term);
            
            // Prioritize displaying the term the user actually matched against (e.g., "Paracetamol" vs "Acetaminophen")
            // This is crucial for Spanish users who expect to see "Paracetamol" in the list.
            const suggestion: DisplaySuggestion = {
                ...result.item.data, // Contains dosage/freq if available
                name: isBrandMatch ? matchedNameTitle : genericName,   
                source: 'local',
                matchedTerm: result.item.term,
                type: result.item.type,
                genericName: genericName 
            };

            // Calculate relevance score
            const score = calculateRelevance(suggestion, debouncedMedSearch, t.lang_code, result.score);
            maxLocalScore = Math.max(maxLocalScore, score);

            // De-duplication Logic:
            // If we already have this generic (keyed by genericKey), keep the one with the higher score.
            // E.g. "Paracetamol" (Synonym) vs "Acetaminophen" (Generic). If user typed "Paracet", synonym wins.
            const existing = combined.get(genericKey);
            if (!existing || (score > (existing.matchScore || 0))) {
                if (isBrandMatch) {
                    // Show the generic name as subtitle if the main title is the brand/synonym
                    suggestion.subtitle = genericName;
                }
                suggestion.matchScore = score;
                combined.set(genericKey, suggestion);
            }
        });

        // 2. API Search (Async) - Fallback for rarer drugs
        // Optimization: Skip API if we have an exact or high-quality match locally (score > 300)
        // This saves API calls when the user types a known drug or synonym exactly.
        const shouldFetchApi = maxLocalScore < 300; 

        if (shouldFetchApi) {
            const searchTerms = new Set<string>([queryLower]);
            // Search for brand, generic, or substance name
            const apiQuery = Array.from(searchTerms)
                .map(term => `(openfda.brand_name:"${term}"^2 OR openfda.generic_name:"${term}" OR openfda.substance_name:"${term}")`)
                .join(' OR ');
            
            try {
                const response = await fetch(
                    `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(apiQuery)}&limit=8`, 
                    { signal } 
                );
                
                if (response.ok) {
                    const data = await response.json();
                    
                    (data.results || []).forEach((drug: any) => {
                        const processApiDrug = (nameRaw: string) => {
                            const name = toTitleCase(nameRaw.split(',')[0].trim()); // Clean up name
                            if (name.length > 50) return; // Skip overly long descriptions
                            
                            const key = name.toLowerCase();
                            
                            // Add if not present (Local prioritized by score usually, but let's calculate)
                            const suggestion: DisplaySuggestion = { name, source: 'api', type: 'generic' };
                            const score = calculateRelevance(suggestion, debouncedMedSearch, t.lang_code); // No fuse score
                            suggestion.matchScore = score;

                            if (!combined.has(key)) {
                                combined.set(key, suggestion);
                            }
                        };

                        if (drug.brand_name) processApiDrug(drug.brand_name);
                        if (drug.generic_name) processApiDrug(drug.generic_name);
                    });
                }
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.warn("API Search failed", error);
                }
            }
        }

        if (signal.aborted) return;

        // 3. Filter, Sort and Slice
        // Remove already selected medications
        // NOTE: We check against both the display name AND the generic name to avoid dupes
        medications.forEach(med => {
            const medName = med.name.toLowerCase();
            // Remove from candidates if either the key (generic) or the display name matches
            combined.delete(medName);
            // Also filter by value if keys don't match (edge case)
            for (const [key, val] of combined.entries()) {
                if (val.name.toLowerCase() === medName) combined.delete(key);
            }
        });

        const sortedSuggestions = Array.from(combined.values())
            .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
            .slice(0, 10);

        setSuggestions(sortedSuggestions);
      
      } catch (err) {
          console.error("Autocomplete flow error", err);
      } finally {
          if (!signal.aborted) {
              setIsFetchingMeds(false);
          }
      }
    };

    fetchSuggestions();

    return () => {
        controller.abort();
    };
  }, [debouncedMedSearch, medications, fuse, t]);

  const handleSuggestionClick = (suggestion: DisplaySuggestion) => {
    // Exact match check (Case-insensitive)
    if (medications.some(m => m.name.toLowerCase() === suggestion.name.toLowerCase())) {
        setDuplicateMedError(t.form_med_duplicate_error);
        setSuggestions([]); 
        return;
    }
    
    setMedications([...medications, {
        name: suggestion.name,
        dosage: suggestion.commonDosage || '',
        frequency: suggestion.commonFrequency || '',
        potentialEffects: '',
        recommendations: '',
        references: '',
    }]);
    
    setCurrentMedication('');
    setSuggestions([]);
    setDuplicateMedError(null);
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
  
  const handleMedicationDetailChange = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications];
    // @ts-ignore
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
    const date = new Date(year, month - 1, day);
    
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
      setDobError(t.form_dob_error_invalid);
    } else if (date > new Date()) {
      setDobError(t.form_dob_error_future);
    } else {
      setDobError(null);
    }
  };
  
  const isExistingProfile = existingPatientIds.has(patientId);
  const canAccessPgx = permissions.canAccessBatchAnalysis; 

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
            className={`flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm transition duration-200 ${
                duplicateMedError 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
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
          {(suggestions.length > 0 || isFetchingMeds || (debouncedMedSearch.length > 1 && !isFetchingMeds)) && (
            <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {isFetchingMeds ? (
                <li className="relative cursor-default select-none py-2 px-4 text-slate-500 dark:text-slate-400">Searching...</li>
              ) : (
                <>
                  {suggestions.map((suggestion, index) => (
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
                  ))}
                  {/* Manual Entry Option if no suggestions or just always present if not an exact match */}
                  {(!suggestions.some(s => s.name.toLowerCase() === currentMedication.toLowerCase())) && (
                      <li
                          className="relative cursor-pointer select-none py-2 px-4 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700"
                          onClick={() => handleAddMedication()}
                      >
                          <div className="flex items-center">
                              <PlusIcon className="h-4 w-4 mr-2" />
                              <span className="font-medium">Usar "{currentMedication}"</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-500 ml-6">
                              Añadir manualmente (la IA lo analizará igual)
                          </p>
                      </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>
        {duplicateMedError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium animate-pulse">
                {duplicateMedError}
            </p>
        )}
        <div className="mt-3 space-y-3">
          {medications.map((med, index) => (
            <MedicationItem
              key={`${med.name}-${index}`}
              medication={med}
              index={index}
              onRemove={() => handleRemoveMedication(index)}
              onChange={(field, value) => handleMedicationDetailChange(index, field, value)}
              t={t}
            />
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

      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t.form_pharmacogenetics_label} <ProBadge />
        </label>
        
        {/* Overlay for non-pro users */}
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
              <select 
                id="pgx-gene" 
                value={selectedGene}
                onChange={(e) => setSelectedGene(e.target.value)}
                disabled={!canAccessPgx}
                className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 border-slate-300 disabled:cursor-not-allowed"
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
                  disabled={!canAccessPgx}
                  placeholder={t.form_pgx_variant_placeholder}
                  className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 disabled:cursor-not-allowed"
              />
            </div>
             <div>
              <label htmlFor="pgx-status" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t.form_pgx_status_label}</label>
              <select 
                id="pgx-status"
                value={metabolizerStatus}
                onChange={(e) => setMetabolizerStatus(e.target.value)}
                disabled={!canAccessPgx}
                className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 disabled:cursor-not-allowed"
              >
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
              <button
                type="button"
                onClick={handleAddPgxFactor}
                disabled={!canAccessPgx || !selectedGene}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200 disabled:cursor-not-allowed"
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
      
      {/* Proactive Alerts Section - Integrated inside form for immediate feedback */}
      <ProactiveAlerts 
        medications={medications}
        allergies={allergies}
        conditions={conditions}
        t={t}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex-grow">
            {isApiKeyMissing && (
                <p className="text-sm text-red-600 dark:text-red-400 text-left sm:text-right pr-4">
                    {t.api_key_analysis_disabled}
                </p>
            )}
        </div>
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
              onClick={handleSaveProfile}
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
            disabled={isLoading || !!dobError || isApiKeyMissing}
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