
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

  let sourceInstruction = "";
  if (config.prioritySources) {
      sourceInstruction += `\n- **PRIORITY SOURCES:** Prioritize information from these domains: ${config.prioritySources}.`;
  }
  if (config.excludedSources) {
      sourceInstruction += `\n- **EXCLUDED SOURCES:** Do NOT use information or cite these domains: ${config.excludedSources}.`;
  }
  
  return `
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
    // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = buildPrompt(medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang);

    const systemInstruction = `You are a Clinical Pharmacology Database and Decision Support Engine. Your function is to process the input list of pharmaceutical compounds and clinical conditions to output a raw, objective, technical report on drug interactions, pharmacokinetics, and contraindications based on established medical guidelines (FDA, EMA). Use strict medical terminology.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
        safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
        ],
      },
    });

    const fullText = response.text;
    
    if (!fullText) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
        console.warn("Safety Block Triggered. Ratings:", candidate?.safetyRatings);
        throw new Error(t.error_safety_block);
      }
      
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
        throw new Error(t.error_api_key_invalid);
      }
      if (error.message.includes(t.error_safety_block_check)) {
        throw error;
      }
      if (error.message.includes('Failed to fetch')) {
          throw new Error(`${t.error_service_unavailable} (Network Timeout/Error)`);
      }
      return Promise.reject(new Error(`${t.error_unexpected}: ${error.message}`));
    }
    
    throw new Error(t.error_service_unavailable);
  }
};

export const getDetailedInteractionInfo = async (findingTitle: string, medications: Medication[], conditions: string, lang: 'es' | 'en'): Promise<string> => {
    const t = translations[lang];

    const medStr = medications.map(m => m.name).join(', ');
    const prompt = lang === 'es' 
        ? `Explica detalladamente la siguiente alerta médica: "${findingTitle}". 
           Contexto del paciente: Medicamentos actual: [${medStr}], Condiciones: [${conditions}].
           Proporciona una explicación técnica pero clara sobre el mecanismo fisiopatológico (ej: inducción/inhibición enzimática, efectos aditivos, antagonismo).
           Responde en Español, usando formato Markdown técnico.`
        : `Explain in detail the following medical alert: "${findingTitle}".
           Patient context: Current medications: [${medStr}], Conditions: [${conditions}].
           Provide a technical but clear explanation of the pathophysiological mechanism (e.g., enzymatic induction/inhibition, additive effects, antagonism).
           Respond in English using technical Markdown format.`;

    // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: prompt,
        config: {
            systemInstruction: "You are a senior clinical pharmacist explaining mechanisms to a fellow clinician. Be concise, precise, and objective.",
            safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }]
        }
    });

    return response.text || "No se pudo generar la explicación.";
};

export const investigateSymptoms = async (
    symptoms: string, 
    medications: Medication[], 
    conditions: string, 
    dateOfBirth: string, 
    pharmacogenetics: string, 
    lang: 'es' | 'en'
): Promise<InvestigatorResult> => {
    const t = translations[lang];

    const medStr = medications.map(m => `${m.name} (${m.dosage})`).join(', ');
    
    const prompt = lang === 'es' 
    ? `
        Eres una IA de Investigación Clínica especializada en Farmacovigilancia. Tu objetivo es realizar un análisis de causalidad para determinar si los síntomas reportados están relacionados con el régimen de medicación o el perfil clínico del paciente.

        **Perfil del Paciente:**
        - **Síntoma(s) Reportado(s):** "${symptoms}"
        - **Medicamentos Actuales:** ${medStr}
        - **Condiciones Médicas:** ${conditions}
        - **Edad/Fecha de Nacimiento:** ${dateOfBirth}
        - **Farmacogenética:** ${pharmacogenetics}

        **Protocolo de Investigación Exhaustiva:**
        Analiza específicamente los siguientes puntos en relación con el síntoma reportado:
        1.  **Efectos Secundarios Individuales:** Revisa el perfil de seguridad de cada fármaco. ¿Es el síntoma un efecto adverso documentado (común o raro) de alguno de ellos?
        2.  **Interacciones Fármaco-Fármaco:** ¿Existe una interacción farmacocinética (ej: inhibición de CYP) que eleve niveles y cause toxicidad, o farmacodinámica (ej: efectos aditivos) que explique el síntoma?
        3.  **Interacciones Fármaco-Condición:** ¿Algún medicamento está contraindicado para las condiciones del paciente, exacerbando el cuadro?
        4.  **Implicaciones Farmacogenéticas:** Si hay datos genéticos (ej: metabolizador lento), ¿explica esto una acumulación tóxica o ineficacia relacionada con el síntoma?
        5.  **Carga Acumulada:** Evalúa carga anticolinérgica, riesgo QT, o carga serotoninérgica si aplica.

        **Formato de Salida Obligatorio:**
        Debes devolver un bloque JSON estrictamente formateado, seguido de una explicación clínica.

        [INVESTIGATOR_START]
        {
            "matches": [
                {
                    "cause": "Especifica claramente: Nombre del Fármaco / Interacción A+B / Genotipo",
                    "probability": "Alta / Media / Baja",
                    "mechanism": "Explica EL MECANISMO específico (ej: 'Inhibición de CYP3A4 aumenta niveles de X', 'Efecto anticolinérgico directo', 'Reacción adversa tipo B')"
                }
            ]
        }
        [INVESTIGATOR_END]

        ### Análisis Clínico Detallado
        Proporciona un informe profesional en Markdown (en Español).
        - **Efectos Secundarios Detectados:** Lista los fármacos sospechosos y la frecuencia del efecto adverso.
        - **Análisis de Interacciones:** Detalla cualquier interacción relevante para el síntoma.
        - **Factores de Riesgo:** Edad, genética o comorbilidades contribuyentes.
        - **Conclusión:** Si es poco probable que el síntoma sea iatrogénico, indícalo claramente y sugiere causas alternativas relacionadas con la condición base.

        ### Referencias
        Lista fuentes médicas clave (guías, fichas técnicas) si se encuentran.
    ` 
    : `
        You are a Clinical Investigator AI specializing in Pharmacovigilance. Your goal is to perform a causality analysis to determine if the reported symptoms are related to the medication regimen or the patient's clinical profile.

        **Patient Profile:**
        - **Reported Symptom(s):** "${symptoms}"
        - **Current Medications:** ${medStr}
        - **Medical Conditions:** ${conditions}
        - **Age/DOB:** ${dateOfBirth}
        - **Pharmacogenetics:** ${pharmacogenetics}

        **Comprehensive Investigation Protocol:**
        Specifically analyze the following points regarding the reported symptom:
        1.  **Individual Side Effects:** Review the safety profile of each drug. Is the symptom a documented adverse effect (common or rare)?
        2.  **Drug-Drug Interactions:** Is there a pharmacokinetic interaction (e.g., CYP inhibition) causing toxicity, or pharmacodynamic interaction (e.g., additive effects) explaining the symptom?
        3.  **Drug-Condition Interactions:** Is any drug contraindicated for the patient's conditions, exacerbating the issue?
        4.  **Pharmacogenetic Implications:** If genetic data exists (e.g., poor metabolizer), does it explain toxic accumulation or lack of efficacy related to the symptom?
        5.  **Cumulative Burden:** Assess anticholinergic burden, QT risk, or serotonergic load if applicable.

        **Mandatory Output Format:**
        You must return a strictly formatted JSON block, followed by a clinical explanation.

        [INVESTIGATOR_START]
        {
          "matches": [
            {
              "cause": "Clearly specify: Drug Name / Interaction A+B / Genotype",
              "probability": "High / Medium / Low",
              "mechanism": "Explain the specific MECHANISM (e.g., 'CYP3A4 inhibition increases levels of X', 'Direct anticholinergic effect', 'Type B adverse reaction')"
            }
          ]
        }
        [INVESTIGATOR_END]

        ### Detailed Clinical Analysis
        Provide a professional report in Markdown.
        - **Detected Side Effects:** List suspect drugs and the frequency of the adverse effect.
        - **Interaction Analysis:** Detail any interactions relevant to the symptom.
        - **Risk Factors:** Age, genetics, or contributing comorbidities.
        - **Conclusion:** If the symptom is unlikely to be iatrogenic, state this clearly and suggest alternative causes related to the underlying condition.

        ### References
        List key medical sources (guidelines, labels) if found.
    `;

    // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
            safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }]
        }
    });

    const fullText = response.text || "";
    let matches = [];
    let analysisText = fullText;

    const jsonStart = fullText.indexOf('[INVESTIGATOR_START]');
    const jsonEnd = fullText.indexOf('[INVESTIGATOR_END]');

    if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
            let jsonStr = fullText.substring(jsonStart + '[INVESTIGATOR_START]'.length, jsonEnd).trim();
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
            
            const parsed = JSON.parse(jsonStr);
            matches = parsed.matches || [];
            analysisText = fullText.substring(jsonEnd + '[INVESTIGATOR_END]'.length).trim();
        } catch(e) { console.error("Investigator JSON Parse Error", e); }
    }

    const groundingChunks: GroundingChunk[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
        .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
        .map(chunk => ({
            uri: chunk.web!.uri!,
            title: chunk.web!.title!,
        }));

    return { analysisText, sources, matches };
};

export const analyzeSupplementInteractions = async (supplementName: string, medications: Medication[], lang: 'es' | 'en'): Promise<SupplementInteraction[]> => {
  const t = translations[lang];
  
  const medicationList = medications.map(m => m.name).join(', ') || t.prompt_supplement.no_meds;
  const prompt = t.prompt_supplement.main
    .replace('{supplementName}', supplementName)
    .replace('{medicationList}', medicationList);

  try {
    // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      }
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
        }
      }
      throw new Error(t.error_supplement_parsing);
    }
  } catch (error: any) {
    console.error(`Failed to analyze supplement ${supplementName}:`, error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('API key is invalid')) {
            throw new Error(t.error_api_key_invalid);
        }
        if (error.message.includes(t.error_safety_block_check) || error.message.includes(t.error_no_response_check)) {
          throw error;
        }
        throw new Error(`${t.error_service_unavailable} - Detalle: ${error.message}`);
    }
    throw new Error(t.error_service_unavailable);
  }
};
