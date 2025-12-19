import { GoogleGenAI } from "@google/genai";
import type { 
    AnalysisResult, 
    Source, 
    Medication,
    SupplementInteraction,
    SystemSettings,
    InvestigatorResult
} from '../types';
import { translations } from '../lib/translations';

const getSystemConfig = (): SystemSettings => {
    try {
        const stored = localStorage.getItem('system_config');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return { prioritySources: '', excludedSources: '', safetyStrictness: 'standard' };
};

const buildPrompt = (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): string => {
  const t = translations[lang];
  const config = getSystemConfig();

  const medList = medications.map(med => {
      let medStr = med.name;
      const details = [med.dosage, med.frequency].filter(Boolean).join(', ');
      if (details) medStr += ` (${details})`;
      return medStr;
    }).join('; ');

  const allergiesText = allergies.trim() ? `${t.prompt.allergies}: ${allergies}.` : t.prompt.noAllergies;
  const substanceText = otherSubstances.trim() ? `${t.prompt.otherSubstances}: ${otherSubstances}.` : t.prompt.noOtherSubstances;
  const pharmacogeneticsText = pharmacogenetics.trim() ? `${t.prompt.pharmacogeneticsInfo}: ${pharmacogenetics}.` : t.prompt.noPharmacogeneticsInfo;
  const conditionsText = conditions.trim() ? `${t.prompt.preexistingConditions}: ${conditions}.` : t.prompt.noPreexistingConditions;
  const dobText = dateOfBirth.trim() ? `${t.prompt.dob}: ${dateOfBirth}.` : t.prompt.noDob;

  let sourceInstruction = "";
  if (config.prioritySources) {
      sourceInstruction += `\n- PRIORIZAR FUENTES: ${config.prioritySources}.`;
  }
  
  return `
    ${sourceInstruction}
    Usted es un experto en farmacología clínica. Analice interacciones para:
    - Medicamentos: ${medList}
    - Alergias: ${allergiesText}
    - Otras sustancias: ${substanceText}
    - Genética: ${pharmacogeneticsText}
    - Condiciones: ${conditionsText}
    - Fecha de nacimiento: ${dobText}

    [INTERACTION_DATA_START]
    Devuelva un JSON con arrays para: drugDrugInteractions, drugSubstanceInteractions, drugAllergyAlerts, drugConditionContraindications, drugPharmacogeneticContraindications, beersCriteriaAlerts.
    [INTERACTION_DATA_END]

    Proporcione también un informe detallado en Markdown tras el bloque JSON.
  `;
};

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = translations[lang];
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = buildPrompt(medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang);

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        systemInstruction: "Expert clinical pharmacology engine. Output technical data and objective analysis.",
        tools: [{ googleSearch: {} }]
      },
    });

    const fullText = response.text;
    if (!fullText) throw new Error(t.error_no_response);

    let drugDrugInteractions = [];
    let drugSubstanceInteractions = [];
    let drugAllergyAlerts = [];
    let drugConditionContraindications = [];
    let drugPharmacogeneticContraindications = [];
    let beersCriteriaAlerts = [];
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
        } catch (e) {}
        textForDisplay = fullText.substring(jsonEndIndex + jsonEndMarker.length).trim();
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
      .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));
      
    return { 
        analysisText: textForDisplay, 
        sources,
        drugDrugInteractions,
        drugSubstanceInteractions,
        drugAllergyAlerts,
        drugConditionContraindications,
        drugPharmacogeneticContraindications,
        beersCriteriaAlerts
    };
  } catch (error: any) {
    if (error.message?.includes('API key') || error.message?.includes('403') || error.message?.includes('401')) {
      throw new Error(t.error_api_key_invalid);
    }
    throw error;
  }
};

export const getDetailedInteractionInfo = async (findingTitle: string, medications: Medication[], conditions: string, lang: 'es' | 'en'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: `Explica detalladamente: "${findingTitle}". Contexto: ${medications.map(m => m.name).join(', ')}. Responde en ${lang === 'es' ? 'Español' : 'Inglés'}.`,
    });
    return response.text || "";
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Investigar síntoma: "${symptoms}" en relación a: ${medications.map(m => m.name).join(', ')}.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
    });
    return { analysisText: response.text || "", sources: [], matches: [] };
};

export const analyzeSupplementInteractions = async (supplementName: string, medications: Medication[], lang: 'es' | 'en'): Promise<SupplementInteraction[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analiza interacciones entre el suplemento ${supplementName} y los medicamentos: ${medications.map(m => m.name).join(', ')}. Responde solo con un array JSON de objetos: medication, riskLevel, potentialEffects, recommendations.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = response.text || "";
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    if (error.message?.includes('API key')) throw new Error('API_KEY_ERROR');
    throw error;
  }
};