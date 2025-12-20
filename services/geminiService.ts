
import { GoogleGenAI } from "@google/genai";
import type { 
    AnalysisResult, 
    Source, 
    Medication,
    SystemSettings,
    InvestigatorResult
} from '../types';
import { translations } from '../lib/translations';

/**
 * Obtiene y valida la clave API desde el entorno.
 * Si Render no inyecta la clave correctamente, Vite suele ponerle el valor "undefined" como string.
 */
const validateAndGetApiKey = (lang: 'es' | 'en'): string => {
    const rawKey = process.env.API_KEY;
    const t = (translations as any)[lang];

    // Detectamos si la clave es nula, vacía o literalmente el string "undefined"
    if (!rawKey || rawKey === 'undefined' || rawKey === 'null' || rawKey.trim() === '') {
        console.error("DIAGNÓSTICO: La variable process.env.API_KEY es indefinida. Revise las Environment Variables en Render.");
        throw new Error(t.error_api_key_invalid + " (Causa: Variable no inyectada en el build)");
    }

    const cleanedKey = rawKey.trim().replace(/^["']|["']$/g, '');

    // Las claves de Google siempre empiezan por AIza
    if (!cleanedKey.startsWith('AIza')) {
        console.error(`DIAGNÓSTICO: Clave con formato incorrecto. Empieza por: ${cleanedKey.substring(0, 4)}...`);
        throw new Error(t.error_api_key_invalid + " (Causa: Formato de clave inválido)");
    }

    return cleanedKey;
};

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

async function callGemini(prompt: string, lang: 'es' | 'en'): Promise<any> {
    const apiKey = validateAndGetApiKey(lang);
    
    // Crear instancia justo antes de usarla para asegurar que usa la clave más reciente
    const ai = new GoogleGenAI({ apiKey });
    
    const modelsToTry = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            console.debug(`Solicitando análisis clínico a: ${modelName}`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    systemInstruction: buildSystemInstruction(lang),
                    tools: [{ googleSearch: {} }]
                },
            });
            return response;
        } catch (error: any) {
            lastError = error;
            // Si el modelo no existe o no hay permiso, intentamos el siguiente
            if (error.status === 404 || error.status === 403) {
                console.warn(`Modelo ${modelName} no disponible o restringido. Reintentando con el siguiente...`);
                continue;
            }
            throw error; 
        }
    }
    throw lastError;
}

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = (translations as any)[lang];

  try {
    const medList = medications.map(med => {
      let medStr = med.name;
      const details = [med.dosage, med.frequency].filter(Boolean).join(', ');
      if (details) medStr += ` (${details})`;
      return medStr;
    }).join('; ');

    const prompt = `PERFIL DEL PACIENTE:
      - Medicamentos: ${medList}
      - Alergias: ${allergies || 'Ninguna'}
      - Suplementos/Otras Sustancias: ${otherSubstances || 'Ninguna'}
      - Perfil Farmacogenético: ${pharmacogenetics || 'No proporcionado'}
      - Diagnósticos: ${conditions}
      - Edad/FN: ${dateOfBirth || 'No proporcionada'}

      TAREA: Realice un análisis de seguridad farmacológica.`;

    const response = await callGemini(prompt, lang);
    const fullText = response.text || "";

    // Extracción de datos estructurados si existen (basado en marcadores que la IA suele usar)
    let drugDrugInteractions = [];
    let drugSubstanceInteractions = [];
    let drugAllergyAlerts = [];
    let drugConditionContraindications = [];
    let drugPharmacogeneticContraindications = [];
    let beersCriteriaAlerts = [];

    // Búsqueda de bloque JSON en la respuesta
    const jsonMatch = fullText.match(/\[INTERACTION_DATA_START\]([\s\S]*?)\[INTERACTION_DATA_END\]/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1].trim().replace(/```json|```/g, ''));
            drugDrugInteractions = parsed.drugDrugInteractions || [];
            drugSubstanceInteractions = parsed.drugSubstanceInteractions || [];
            drugAllergyAlerts = parsed.drugAllergyAlerts || [];
            drugConditionContraindications = parsed.drugConditionContraindications || [];
            drugPharmacogeneticContraindications = parsed.drugPharmacogeneticContraindications || [];
            beersCriteriaAlerts = parsed.beersCriteriaAlerts || [];
        } catch (e) {}
    }

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(chunk => chunk.web?.uri && chunk.web?.title)
      .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));
      
    return { 
        analysisText: fullText.split('[INTERACTION_DATA_START]')[0].trim(), 
        sources, drugDrugInteractions, drugSubstanceInteractions, drugAllergyAlerts, 
        drugConditionContraindications, drugPharmacogeneticContraindications, beersCriteriaAlerts 
    };
  } catch (error: any) {
    console.group("ERROR EN SERVICIO CLÍNICO");
    console.error("Status:", error.status);
    console.error("Mensaje:", error.message);
    console.groupEnd();

    // Mapeo amigable de errores técnicos
    if (error.status === 400 || error.message?.includes('API key')) {
        throw new Error(t.error_api_key_invalid);
    }
    throw new Error(t.error_service_unavailable);
  }
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, allergies: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    try {
        const prompt = `Analice posibles causas medicamentosas del síntoma: "${symptoms}" en el contexto del tratamiento actual.`;
        const response = await callGemini(prompt, lang);

        const fullText = response.text || "";
        const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
          .filter(chunk => chunk.web?.uri && chunk.web?.title)
          .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));

        return { analysisText: fullText, sources, matches: [] };
    } catch (error: any) {
        throw error;
    }
};
