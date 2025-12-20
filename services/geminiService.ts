
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
 * Obtiene y diagnostica la clave API.
 */
const getValidatedApiKey = (lang: 'es' | 'en'): string => {
    const rawKey = process.env.API_KEY;
    const t = (translations as any)[lang];

    // DIAGNÓSTICO EN CONSOLA (Visible con F12)
    const debugInfo = rawKey ? `Longitud: ${rawKey.length}, Empieza por: ${rawKey.substring(0, 4)}...` : 'TOTALMENTE INDEFINIDA';
    console.log(`[DEBUG] Comprobando API_KEY: ${debugInfo}`);

    if (!rawKey || rawKey === 'undefined' || rawKey === 'null' || rawKey.trim() === '') {
        console.error("ERROR CRÍTICO: La clave API no ha llegado al navegador. Comprueba que en Render la variable se llame API_KEY y que hayas hecho 'Clear Cache and Deploy'.");
        throw new Error(t.error_api_key_invalid + " (Causa: Clave no inyectada en el build)");
    }

    const cleaned = rawKey.trim().replace(/^["']|["']$/g, '');

    if (!cleaned.startsWith('AIza')) {
        console.error(`ERROR DE FORMATO: La clave detectada no tiene el prefijo de Google (AIza). Valor actual: ${cleaned.substring(0, 5)}...`);
        throw new Error(t.error_api_key_invalid + " (Causa: Formato de clave inválido)");
    }

    return cleaned;
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
    const apiKey = getValidatedApiKey(lang);
    const ai = new GoogleGenAI({ apiKey });
    
    const modelsToTry = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            console.debug(`Llamando a IA (${modelName})...`);
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
            if (error.status === 404 || error.status === 403) continue;
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
      - Suplementos: ${otherSubstances || 'Ninguna'}
      - Farmacogenética: ${pharmacogenetics || 'No proporcionado'}
      - Diagnósticos: ${conditions}
      - Edad: ${dateOfBirth || 'No proporcionada'}

      Realice un análisis clínico detallado.`;

    const response = await callGemini(prompt, lang);
    const fullText = response.text || "";

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(chunk => chunk.web?.uri && chunk.web?.title)
      .map(chunk => ({ uri: chunk.web!.uri!, title: chunk.web!.title! }));
      
    return { 
        analysisText: fullText, 
        sources, drugDrugInteractions: [], drugSubstanceInteractions: [], drugAllergyAlerts: [], 
        drugConditionContraindications: [], drugPharmacogeneticContraindications: [], beersCriteriaAlerts: [] 
    };
  } catch (error: any) {
    console.error("Error en servicio:", error.status, error.message);
    if (error.status === 400 || error.message?.includes('API key')) throw new Error(t.error_api_key_invalid);
    throw new Error(t.error_service_unavailable);
  }
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, allergies: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    try {
        const prompt = `Investigue si "${symptoms}" puede ser un efecto adverso del tratamiento actual.`;
        const response = await callGemini(prompt, lang);
        return { analysisText: response.text || "", sources: [], matches: [] };
    } catch (error: any) {
        throw error;
    }
};
