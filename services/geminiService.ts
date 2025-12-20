
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
 * Obtiene la clave de process.env.API_KEY y valida que no sea un marcador de posición.
 */
const getValidatedApiKey = (lang: 'es' | 'en'): string => {
    const rawKey = process.env.API_KEY;
    const t = (translations as any)[lang];

    // Diagnóstico para F12
    console.log(`[SISTEMA] Clave detectada: "${rawKey?.substring(0, 5)}..." (Longitud: ${rawKey?.length})`);

    // 1. Caso: No existe
    if (!rawKey || rawKey === 'undefined' || rawKey.trim() === '') {
        throw new Error(t.error_api_key_invalid + " (Causa: Variable API_KEY no detectada)");
    }

    // 2. Caso: Marcador de posición (PLACEHOLDER_API_KEY)
    // Si esto ocurre, Render está ignorando la variable del panel y usando un .env viejo.
    if (rawKey.includes('PLACEHOLDER')) {
        console.error("ERROR CRÍTICO: Se está usando un valor PLACEHOLDER. Render no ha sobrescrito el archivo .env.");
        throw new Error("ERROR DE COMPILACIÓN: El sistema está usando una clave de prueba 'PLACEHOLDER'. Por favor, en Render ve a 'Manual Deploy' y selecciona 'Clear Cache and Deploy' para forzar la lectura de tu clave real.");
    }

    const cleaned = rawKey.trim().replace(/^["']|["']$/g, '');

    // 3. Caso: Formato incorrecto
    if (!cleaned.startsWith('AIza')) {
        throw new Error(t.error_api_key_invalid + ` (Causa: Formato inválido. Empieza por ${cleaned.substring(0, 4)})`);
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
    return `You are a Clinical Pharmacologist. 
    Focus on evidence-based drug safety.
    Respond in ${lang === 'es' ? 'Spanish' : 'English'}.
    Priority sources: ${config.prioritySources}.`;
};

async function callGemini(prompt: string, lang: 'es' | 'en'): Promise<any> {
    const apiKey = getValidatedApiKey(lang);
    const ai = new GoogleGenAI({ apiKey });
    
    // Intentar siempre con el modelo más capaz
    try {
        return await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                systemInstruction: buildSystemInstruction(lang),
                tools: [{ googleSearch: {} }]
            },
        });
    } catch (error: any) {
        console.error("Error en llamada a IA:", error);
        // Si el modelo pro falla por cuota o disponibilidad, intentar con flash
        if (error.status === 404 || error.status === 429) {
            return await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: { systemInstruction: buildSystemInstruction(lang) },
            });
        }
        throw error;
    }
}

export const analyzeInteractions = async (medications: Medication[], allergies: string, otherSubstances: string, conditions: string, dateOfBirth: string, pharmacogenetics: string, lang: 'es' | 'en'): Promise<AnalysisResult> => {
  const t = (translations as any)[lang];

  try {
    const medList = medications.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ');
    const prompt = `Analice este perfil clínico:
      - Medicación: ${medList}
      - Alergias: ${allergies}
      - Diagnósticos: ${conditions}
      - Suplementos: ${otherSubstances}`;

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
    console.error("Error en servicio clínico:", error);
    if (error.message?.includes('COMPILACIÓN')) throw error;
    if (error.status === 400) throw new Error(t.error_api_key_invalid);
    throw new Error(t.error_service_unavailable);
  }
};

export const investigateSymptoms = async (symptoms: string, medications: Medication[], conditions: string, dateOfBirth: string, pharmacogenetics: string, allergies: string, lang: 'es' | 'en'): Promise<InvestigatorResult> => {
    const prompt = `Investigue si "${symptoms}" es un efecto adverso de: ${medications.map(m => m.name).join(', ')}`;
    const response = await callGemini(prompt, lang);
    return { analysisText: response.text || "", sources: [], matches: [] };
};
