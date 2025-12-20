
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
 * Valida la clave API y detecta si es un valor de marcador de posición.
 */
const getValidatedApiKey = (lang: 'es' | 'en'): string => {
    const rawKey = process.env.API_KEY;
    const t = (translations as any)[lang];

    // Diagnóstico detallado para el usuario en consola
    console.log(`[DEBUG] Clave detectada: ${rawKey ? rawKey.substring(0, 4) : 'NULL'}... (Longitud: ${rawKey?.length || 0})`);

    // 1. Verificar si es indefinida o vacía
    if (!rawKey || rawKey === 'undefined' || rawKey.trim() === '') {
        throw new Error(t.error_api_key_invalid + " (Causa: Variable API_KEY no definida en Render)");
    }

    // 2. Detectar específicamente el string de marcador de posición del sistema
    if (rawKey.includes('PLACEHOLDER')) {
        console.error("ERROR: El sistema está usando 'PLACEHOLDER_API_KEY'. Render no ha sobrescrito la variable.");
        throw new Error(t.error_api_key_invalid + " (Causa: El sistema detecta un valor PLACEHOLDER. Revise las variables en Render y haga 'Clear Cache and Deploy')");
    }

    const cleaned = rawKey.trim().replace(/^["']|["']$/g, '');

    // 3. Validar formato real de Google
    if (!cleaned.startsWith('AIza')) {
        throw new Error(t.error_api_key_invalid + " (Causa: La clave no empieza por AIza)");
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
    const priority = config.prioritySources ? `PRIORITIZE medical information from: ${config.prioritySources}.` : '';
    const excluded = config.excludedSources ? `STRICTLY EXCLUDE: ${config.excludedSources}.` : '';
    
    return `You are a Clinical Pharmacologist. 
    ${priority} ${excluded}
    Respond in ${lang === 'es' ? 'Spanish' : 'English'}.
    Focus on evidence-based drug interactions and safety.`;
};

async function callGemini(prompt: string, lang: 'es' | 'en'): Promise<any> {
    // La clave se valida en cada llamada para reaccionar a cambios en el entorno
    const apiKey = getValidatedApiKey(lang);
    const ai = new GoogleGenAI({ apiKey });
    
    // Intentar con el modelo pro primero, luego flash como backup
    const models = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
    let lastErr;

    for (const model of models) {
        try {
            return await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction: buildSystemInstruction(lang),
                    tools: [{ googleSearch: {} }]
                },
            });
        } catch (e: any) {
            lastErr = e;
            if (e.status === 404 || e.status === 403) continue;
            throw e;
        }
    }
    throw lastErr;
}

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = (translations as any)[lang];

  try {
    const medList = medications.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ');
    const prompt = `Analice la seguridad farmacológica para este paciente:
      - Medicamentos: ${medList}
      - Alergias: ${allergies || 'Ninguna'}
      - Suplementos: ${otherSubstances || 'Ninguno'}
      - Farmacogenética: ${pharmacogenetics || 'N/A'}
      - Condiciones: ${conditions}
      - FN: ${dateOfBirth || 'N/A'}`;

    const response = await callGemini(prompt, lang);
    const text = response.text || "";
    
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(c => c.web?.uri && c.web?.title)
      .map(c => ({ uri: c.web!.uri!, title: c.web!.title! }));
      
    return { 
        analysisText: text, 
        sources, drugDrugInteractions: [], drugSubstanceInteractions: [], drugAllergyAlerts: [], 
        drugConditionContraindications: [], drugPharmacogeneticContraindications: [], beersCriteriaAlerts: [] 
    };
  } catch (error: any) {
    console.error("Error clínico:", error);
    if (error.message?.includes('PLACEHOLDER') || error.status === 400) throw new Error(t.error_api_key_invalid);
    throw new Error(t.error_service_unavailable);
  }
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, allergies: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    const prompt = `Investigue si el síntoma "${symptoms}" puede ser un efecto adverso del tratamiento actual.`;
    const response = await callGemini(prompt, lang);
    return { analysisText: response.text || "", sources: [], matches: [] };
};
