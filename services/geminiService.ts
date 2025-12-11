
import { GoogleGenAI } from "@google/genai";
import type { 
    GroundingChunk, 
    AnalysisResult, 
    Source, 
    DrugDrugInteraction,
    DrugSubstanceInteraction,
    DrugAllergyAlert, 
    DrugConditionContraindication,
    DrugPharmacogeneticContraindication,
    BeersCriteriaAlert,
    Medication,
    SupplementInteraction,
    SystemSettings
} from '../types';
import { ApiKeyError } from '../types';
import { translations } from '../lib/translations';

// Helper to safely get the API key from various environments (Node/Vite)
const getApiKey = (): string | undefined => {
  try {
    // Priority 1: process.env.API_KEY (Standard/System Prompt)
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      return process.env.API_KEY;
    }
    // Priority 2: import.meta.env.VITE_GEMINI_API_KEY (Vite Standard)
    // @ts-ignore - Handle Vite types if not explicitly defined
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing environment variables", e);
  }
  return undefined;
};

// Retrieve admin settings (Mocked via localStorage for now as Firestore sync requires more logic)
const getSystemConfig = (): SystemSettings => {
    try {
        const stored = localStorage.getItem('system_config');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    // Default config
    return { prioritySources: '', excludedSources: '', safetyStrictness: 'standard' };
};


const buildPrompt = (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): string => {
  const t = translations[lang];
  const config = getSystemConfig();

  const medList = medications.map(med => {
      let medStr = med.name;
      const details = [med.dosage, med.frequency].filter(Boolean).join(', ');
      if (details) {
        medStr += ` (${details})`;
      }
      
      const userNotes = [
          med.potentialEffects ? `${t.prompt.prompt_user_notes.effects}: ${med.potentialEffects}` : '',
          med.recommendations ? `${t.prompt.prompt_user_notes.recommendations}: ${med.recommendations}` : '',
          med.references ? `${t.prompt.prompt_user_notes.references}: ${med.references}` : ''
      ].filter(Boolean).join('; ');

      if (userNotes) {
          medStr += ` [${t.prompt.prompt_user_notes.label}: ${userNotes}]`;
      }
      return medStr;
    }).join('; ');

  const allergiesText = allergies.trim() ? `${t.prompt.allergies}: ${allergies}. ${t.prompt.allergiesNote}` : t.prompt.noAllergies;
  const substanceText = otherSubstances.trim() ? `${t.prompt.otherSubstances}: ${otherSubstances}.` : t.prompt.noOtherSubstances;
  const pharmacogeneticsText = pharmacogenetics.trim() ? `${t.prompt.pharmacogeneticsInfo}: ${pharmacogenetics}.` : t.prompt.noPharmacogeneticsInfo;
  const conditionsText = conditions.trim() ? `${t.prompt.preexistingConditions}: ${conditions}. ${t.prompt.conditionsNote}` : t.prompt.noPreexistingConditions;
  const dobText = dateOfBirth.trim() ? `${t.prompt.dob}: ${dateOfBirth}. ${t.prompt.dobNote}` : t.prompt.noDob;

  // Admin Configuration Injections
  let sourceInstruction = "";
  if (config.prioritySources) {
      sourceInstruction += `\n- **PRIORITY SOURCES:** Prioritize information from these domains: ${config.prioritySources}.`;
  }
  if (config.excludedSources) {
      sourceInstruction += `\n- **EXCLUDED SOURCES:** Do NOT use information or cite these domains: ${config.excludedSources}.`;
  }
  if (config.safetyStrictness === 'strict') {
      sourceInstruction += `\n- **SAFETY LEVEL: STRICT.** Flag ANY potential interaction even if theoretical.`;
  }

  return `
    ${t.prompt.role}
    ${sourceInstruction}

    ${t.prompt.masterInstruction}
    ${t.prompt.part1}
    ${t.prompt.part2}

    ${t.prompt.jsonExampleTitle}
    [INTERACTION_DATA_START]
    {
      "drugDrugInteractions": [
        {
          "interaction": "${t.prompt.jsonExample.drugDrug.interaction}",
          "riskLevel": "${t.prompt.jsonExample.drugDrug.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.drugDrug.clinicalSummary}",
          "potentialEffects": "${t.prompt.jsonExample.drugDrug.potentialEffects}",
          "recommendations": "${t.prompt.jsonExample.drugDrug.recommendations}",
          "references": "${t.prompt.jsonExample.drugDrug.references}"
        }
      ],
      "drugSubstanceInteractions": [
        {
          "medication": "${t.prompt.jsonExample.drugSubstance.medication}",
          "substance": "${t.prompt.jsonExample.drugSubstance.substance}",
          "riskLevel": "${t.prompt.jsonExample.drugSubstance.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.drugSubstance.clinicalSummary}",
          "potentialEffects": "${t.prompt.jsonExample.drugSubstance.potentialEffects}",
          "recommendations": "${t.prompt.jsonExample.drugSubstance.recommendations}",
          "references": "${t.prompt.jsonExample.drugSubstance.references}"
        }
      ],
      "drugAllergyAlerts": [
        {
          "medication": "${t.prompt.jsonExample.drugAllergy.medication}",
          "allergen": "${t.prompt.jsonExample.drugAllergy.allergen}",
          "riskLevel": "${t.prompt.jsonExample.drugAllergy.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.drugAllergy.clinicalSummary}",
          "alertDetails": "${t.prompt.jsonExample.drugAllergy.alertDetails}",
          "recommendations": "${t.prompt.jsonExample.drugAllergy.recommendations}",
          "references": "${t.prompt.jsonExample.drugAllergy.references}"
        }
      ],
      "drugConditionContraindications": [
        {
          "medication": "${t.prompt.jsonExample.drugCondition.medication}",
          "condition": "${t.prompt.jsonExample.drugCondition.condition}",
          "riskLevel": "${t.prompt.jsonExample.drugCondition.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.drugCondition.clinicalSummary}",
          "contraindicationDetails": "${t.prompt.jsonExample.drugCondition.contraindicationDetails}",
          "recommendations": "${t.prompt.jsonExample.drugCondition.recommendations}",
          "references": "${t.prompt.jsonExample.drugCondition.references}",
          "dosageAdjustment": "${t.prompt.jsonExample.drugCondition.dosageAdjustment}"
        }
      ],
      "drugPharmacogeneticContraindications": [
        {
          "medication": "${t.prompt.jsonExample.drugPharmacogenetic.medication}",
          "geneticFactor": "${t.prompt.jsonExample.drugPharmacogenetic.geneticFactor}",
          "variantAllele": "${t.prompt.jsonExample.drugPharmacogenetic.variantAllele}",
          "riskLevel": "${t.prompt.jsonExample.drugPharmacogenetic.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.drugPharmacogenetic.clinicalSummary}",
          "implication": "${t.prompt.jsonExample.drugPharmacogenetic.implication}",
          "recommendations": "${t.prompt.jsonExample.drugPharmacogenetic.recommendations}",
          "references": "${t.prompt.jsonExample.drugPharmacogenetic.references}"
        }
      ],
      "beersCriteriaAlerts": [
        {
          "medication": "${t.prompt.jsonExample.beersCriteria.medication}",
          "criteria": "${t.prompt.jsonExample.beersCriteria.criteria}",
          "riskLevel": "${t.prompt.jsonExample.beersCriteria.riskLevel}",
          "clinicalSummary": "${t.prompt.jsonExample.beersCriteria.clinicalSummary}",
          "recommendations": "${t.prompt.jsonExample.beersCriteria.recommendations}",
          "references": "${t.prompt.jsonExample.beersCriteria.references}",
          "therapeuticAlternative": "${t.prompt.jsonExample.beersCriteria.therapeuticAlternative}"
        }
      ]
    }
    [INTERACTION_DATA_END]

    ${t.prompt.readableAnalysisTitle}

    ### ${t.prompt.criticalSummaryTitle}
    ${t.prompt.criticalSummaryInstruction1}
    ${t.prompt.criticalSummaryInstruction2}
    ${t.prompt.criticalSummaryInstruction3}

    ${t.prompt.detailedAnalysisTitle}
    ${t.prompt.detailedAnalysisIntro}
    - ${t.prompt.medications}: ${medList}
    *(${t.prompt.medicationsNote})*
    - ${allergiesText}
    - ${substanceText}
    - ${pharmacogeneticsText}
    - ${conditionsText}
    - ${dobText}

    ${t.prompt.detailedAnalysisInstruction}

    ---
    ### 1. ${t.prompt.section1Title}
    *(${t.prompt.section1Description})*

    ---
    ### 2. ${t.prompt.section2Title}
    *(${t.prompt.section2Description})*

    ---
    ### 3. ${t.prompt.section3Title}
    *(${t.prompt.section3Description})*

    ---
    ### 4. ${t.prompt.section4Title}
    *(${t.prompt.section4Description})*
    
    ---
    ### 5. ${t.prompt.section5Title}
    *(${t.prompt.section5Description})*

    ---
    ### 6. ${t.prompt.section6Title}
    *(${t.prompt.section6Description})*

    ${t.prompt.finalDisclaimer}

    ### ${t.prompt.sourcesSummaryTitle}
    ${t.prompt.sourcesSummaryInstruction}
    [SOURCE_START]
    URI: [${t.prompt.sourcesSummaryURI}]
    TITLE: [${t.prompt.sourcesSummaryTITLE}]
    SUMMARY: [${t.prompt.sourcesSummarySUMMARY}]
    PREVIEW: [${t.prompt.sourcesSummaryPREVIEW}]
    [SOURCE_END]
  `;
};

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = translations[lang];
  
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new ApiKeyError(t.error_api_key_invalid);
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Robust safety settings for medical content
        // We use BLOCK_NONE for medical context as standard filters often flag medical descriptions as dangerous.
        safetySettings: [
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE', 
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                threshold: 'BLOCK_NONE',
            },
        ],
      },
    });

    const fullText = response.text;
    
    // Improved error handling for empty responses (blocks/filters)
    if (!fullText) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
        throw new Error(t.error_safety_block);
      }
      // Fallback check: sometimes safety ratings are present even if finishReason isn't explicit
      const blockingRating = candidate?.safetyRatings?.find(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');
      if (blockingRating) {
          throw new Error(t.error_safety_block);
      }
      
      throw new Error(t.error_no_response);
    }

    let drugDrugInteractions: DrugDrugInteraction[] = [];
    let drugSubstanceInteractions: DrugSubstanceInteraction[] = [];
    let drugAllergyAlerts: DrugAllergyAlert[] = [];
    let drugConditionContraindications: DrugConditionContraindication[] = [];
    let drugPharmacogeneticContraindications: DrugPharmacogeneticContraindication[] = [];
    let beersCriteriaAlerts: BeersCriteriaAlert[] = [];
    let textForDisplay = fullText;

    const jsonStartMarker = '[INTERACTION_DATA_START]';
    const jsonEndMarker = '[INTERACTION_DATA_END]';
    const jsonStartIndex = fullText.indexOf(jsonStartMarker);
    const jsonEndIndex = fullText.indexOf(jsonEndMarker);

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        const jsonString = fullText.substring(jsonStartIndex + jsonStartMarker.length, jsonEndIndex).trim();
        try {
            const parsedJson = JSON.parse(jsonString);
            drugDrugInteractions = parsedJson.drugDrugInteractions || [];
            drugSubstanceInteractions = parsedJson.drugSubstanceInteractions || [];
            drugAllergyAlerts = parsedJson.drugAllergyAlerts || [];
            drugConditionContraindications = parsedJson.drugConditionContraindications || [];
            drugPharmacogeneticContraindications = parsedJson.drugPharmacogeneticContraindications || [];
            beersCriteriaAlerts = parsedJson.beersCriteriaAlerts || [];

        } catch (e) {
            console.error("Failed to parse structured interaction data:", e);
        }
        textForDisplay = fullText.substring(jsonEndIndex + jsonEndMarker.length).trim();
    }

    const sourceSectionMarker = `### ${t.prompt.sourcesSummaryTitle}`;
    const parts = textForDisplay.split(sourceSectionMarker);
    const analysisText = parts[0].trim();
    const sourcesText = parts.length > 1 ? parts[1] : '';
    
    let sources: Source[] = [];
    
    if (sourcesText) {
        const sourceRegex = /\[SOURCE_START\]\s*URI: ([\s\S]*?)\s*TITLE: ([\s\S]*?)\s*SUMMARY: ([\s\S]*?)\s*PREVIEW: ([\s\S]*?)\s*\[SOURCE_END\]/gs;
        let match;
        while ((match = sourceRegex.exec(sourcesText)) !== null) {
            sources.push({
                uri: match[1].trim(),
                title: match[2].trim(),
                summary: match[3].trim(),
                preview: match[4].trim(),
            });
        }
    }

    if (sources.length === 0) {
        const groundingChunks: GroundingChunk[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        sources = groundingChunks
          .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
          .map(chunk => ({
            uri: chunk.web!.uri!,
            title: chunk.web!.title!,
          }));
    }
      
    return { 
        analysisText, 
        sources,
        drugDrugInteractions,
        drugSubstanceInteractions,
        drugAllergyAlerts,
        drugConditionContraindications,
        drugPharmacogeneticContraindications,
        beersCriteriaAlerts
    };

  } catch (error: any) {
    console.error("Gemini API call failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key not valid') || error.message.includes('API key is invalid')) {
        throw new ApiKeyError(t.error_api_key_invalid);
      }
      if (error.message.includes(t.error_safety_block_check)) {
        throw error;
      }
      // If it is 503 or generic fetch failure, it often comes as "TypeError: Failed to fetch"
      if (error.message.includes('Failed to fetch')) {
          throw new Error(`${t.error_service_unavailable} (Network Timeout/Error)`);
      }
      // Pass through the actual message if we can't map it
      return Promise.reject(new Error(`${t.error_unexpected}: ${error.message}`));
    }
    
    throw new Error(t.error_service_unavailable);
  }
};

export const analyzeSupplementInteractions = async (supplementName: string, medications: Medication[], lang: 'es' | 'en'): Promise<SupplementInteraction[]> => {
  const t = translations[lang];
  
  const medicationList = medications.map(m => m.name).join(', ') || t.prompt_supplement.no_meds;
  const prompt = t.prompt_supplement.main
    .replace('{supplementName}', supplementName)
    .replace('{medicationList}', medicationList);

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new ApiKeyError(t.error_api_key_invalid);
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const text = response.text;
    if (!text) {
        throw new Error(t.error_no_response);
    }

    try {
      const result = JSON.parse(text);
      if (Array.isArray(result)) {
        return result as SupplementInteraction[];
      }
      return [];
    } catch (e) {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]) as SupplementInteraction[];
        } catch (e2) {
          // Fall through
        }
      }
      throw new Error(t.error_supplement_parsing);
    }
  } catch (error: any) {
    console.error(`Failed to analyze supplement ${supplementName}:`, error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('API key is invalid')) {
            throw new ApiKeyError(t.error_api_key_invalid);
        }
        if (error.message.includes(t.error_safety_block_check) || error.message.includes(t.error_no_response_check)) {
          throw error;
        }
        throw new Error(`${t.error_service_unavailable} - Detalle: ${error.message}`);
    }
    throw new Error(t.error_service_unavailable);
  }
};
