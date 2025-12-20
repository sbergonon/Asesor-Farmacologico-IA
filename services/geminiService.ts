
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

const buildSystemInstruction = (lang: 'es' | 'en'): string => {
    const config = getSystemConfig();
    const priority = config.prioritySources ? `PRIORITIZE medical information from the following domains: ${config.prioritySources}.` : '';
    const excluded = config.excludedSources ? `STRICTLY EXCLUDE information from: ${config.excludedSources}.` : '';
    
    return `You are a Clinical Pharmacologist and Patient Safety Expert.
    Focus on evidence-based medical results.
    ${priority}
    ${excluded}
    Safety Strictness Level: ${config.safetyStrictness.toUpperCase()}.
    Respond exclusively in ${lang === 'es' ? 'Spanish' : 'English'}.
    Precision is mandatory. Explain the pathophysiology behind every finding.`;
};

const buildPrompt = (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): string => {
  const medList = medications.map(med => {
      let medStr = med.name;
      const details = [med.dosage, med.frequency].filter(Boolean).join(', ');
      if (details) medStr += ` (${details})`;
      return medStr;
    }).join('; ');

  return `PERFIL DEL PACIENTE:
    - Medicamentos Activos: ${medList}
    - Alergias: ${allergies || 'Ninguna'}
    - Suplementos/Otras Sustancias: ${otherSubstances || 'Ninguna'}
    - Perfil Farmacogenético: ${pharmacogenetics || 'No proporcionado'}
    - Diagnósticos/Condiciones: ${conditions}
    - Datos de Edad (Edad/FN): ${dateOfBirth || 'No proporcionada'}

    TAREA: Realice un análisis de seguridad farmacológica exhaustivo.

    ESTRUCTURA OBLIGATORIA DE RESPUESTA:

    PARTE 1: BLOQUE JSON (Entre [INTERACTION_DATA_START] y [INTERACTION_DATA_END])
    Este bloque DEBE ser un JSON válido. Use niveles de riesgo: "Crítico", "Alto", "Moderado", "Bajo".
    Campos requeridos por categoría:
    - drugDrugInteractions: { interaction, riskLevel, clinicalSummary, potentialEffects, recommendations, references, therapeuticAlternative }
    - drugSubstanceInteractions: { medication, substance, riskLevel, clinicalSummary, potentialEffects, recommendations, references }
    - drugAllergyAlerts: { medication, allergen, riskLevel, clinicalSummary, alertDetails, recommendations, references }
    - drugConditionContraindications: { medication, condition, riskLevel, clinicalSummary, contraindicationDetails, recommendations, references }
    - drugPharmacogeneticContraindications: { medication, geneticFactor, riskLevel, clinicalSummary, implication, recommendations, references }
    - beersCriteriaAlerts: { medication, criteria, riskLevel, clinicalSummary, recommendations, references, therapeuticAlternative }

    PARTE 2: INFORME CLÍNICO DETALLADO (Markdown)
    Un análisis narrativo profesional explicando la fisiopatología de los hallazgos. NO incluya el JSON en esta parte.

    IDIOMA: Responda TODO en ${lang === 'es' ? 'ESPAÑOL' : 'ENGLISH'}.`;
};

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = (translations as any)[lang];

  try {
    const key = process.env.API_KEY;
    if (!key) {
        console.error("DEBUG: process.env.API_KEY is undefined. Check Render environment variables.");
        throw new Error("AUTH_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = buildPrompt(medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang);

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        systemInstruction: buildSystemInstruction(lang),
        tools: [{ googleSearch: {} }]
      },
    });

    const fullText = response.text || "";
    let drugDrugInteractions = [];
    let drugSubstanceInteractions = [];
    let drugAllergyAlerts = [];
    let drugConditionContraindications = [];
    let drugPharmacogeneticContraindications = [];
    let beersCriteriaAlerts = [];
    let textForDisplay = fullText;

    const startMarker = '[INTERACTION_DATA_START]';
    const endMarker = '[INTERACTION_DATA_END]';
    const startIndex = fullText.indexOf(startMarker);
    const endIndex = fullText.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = fullText.substring(startIndex + startMarker.length, endIndex).trim().replace(/```json|```/g, '');
        try {
            const parsed = JSON.parse(jsonStr);
            drugDrugInteractions = parsed.drugDrugInteractions || [];
            drugSubstanceInteractions = parsed.drugSubstanceInteractions || [];
            drugAllergyAlerts = parsed.drugAllergyAlerts || [];
            drugConditionContraindications = parsed.drugConditionContraindications || [];
            drugPharmacogeneticContraindications = parsed.drugPharmacogeneticContraindications || [];
            beersCriteriaAlerts = parsed.beersCriteriaAlerts || [];
        } catch (e) {}
        textForDisplay = fullText.substring(endIndex + endMarker.length).trim();
    }

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(chunk => chunk.web?.uri && chunk.web?.title)
      .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));
      
    return { 
        analysisText: textForDisplay, 
        sources, drugDrugInteractions, drugSubstanceInteractions, drugAllergyAlerts, 
        drugConditionContraindications, drugPharmacogeneticContraindications, beersCriteriaAlerts 
    };
  } catch (error: any) {
    console.error("CRITICAL Gemini Error:", error);
    
    if (error.message === "AUTH_KEY_MISSING" || error.message?.includes('API key') || error.status === 401 || error.status === 403) {
        throw new Error(t.error_api_key_invalid);
    }
    
    // Si es un error de cuota o seguridad de Google
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
        throw new Error(lang === 'es' ? "Límite de cuota excedido en Google Cloud." : "API Quota exceeded.");
    }

    throw new Error(`${t.error_service_unavailable} (${error.message || 'Unknown error'})`);
  }
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, allergies: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const prompt = `Usted es un experto en Farmacología Clínica y razonamiento diagnóstico. 
    Analice la causa probable del síntoma: "${symptoms}". 
    
    CONTEXTO CLÍNICO:
    - Medicamentos: ${medications.map(m => m.name).join(', ')}
    - Alergias: ${allergies || 'Ninguna'}
    - Diagnósticos: ${conditions}
    - Genética: ${pharmacogenetics}
    - Edad/FN: ${dateOfBirth}
    
    RESPUESTA REQUERIDA (OBLIGATORIO):
    1. Bloque JSON (Entre [CAUSALITY_DATA_START] y [CAUSALITY_DATA_END]):
    Un array 'matches' con: { cause: string, probability: string, mechanism: string }
    Todos los campos de texto del JSON deben estar en ${lang === 'es' ? 'ESPAÑOL' : 'ENGLISH'}.
    
    2. Informe técnico Markdown (Después del marcador de cierre):
    Análisis detallado de la evidencia, farmacocinética y farmacodinámica implicada.
    ESTE INFORME DEBE ESTAR INTEGRAMENTE EN ${lang === 'es' ? 'ESPAÑOL' : 'ENGLISH'}.

    Idioma de salida: ${lang === 'es' ? 'Español' : 'Inglés'}.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: { 
          systemInstruction: buildSystemInstruction(lang),
          tools: [{ googleSearch: {} }] 
        },
    });

    const fullText = response.text || "";
    let matches = [];
    let narrative = fullText;

    const startMarker = '[CAUSALITY_DATA_START]';
    const endMarker = '[CAUSALITY_DATA_END]';
    const startIndex = fullText.indexOf(startMarker);
    const endIndex = fullText.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = fullText.substring(startIndex + startMarker.length, endIndex).trim().replace(/```json|```/g, '');
        try { matches = JSON.parse(jsonStr).matches || []; } catch(e) {}
        narrative = fullText.substring(endIndex + endMarker.length).trim();
    }

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(chunk => chunk.web?.uri && chunk.web?.title)
      .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));

    return { analysisText: narrative, sources, matches };
};
