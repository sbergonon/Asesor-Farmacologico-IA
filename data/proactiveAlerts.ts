
// Reglas para el sistema de Alertas Proactivas (Detección en Tiempo Real)
// Se deben usar nombres genéricos en minúsculas.

export const criticalAllergyRules: Record<string, string[]> = {
  'penicil': ['amoxicillin', 'ampicillin', 'piperacillin', 'dicloxacillin', 'cephalexin', 'amoxicilina'],
  'penicillin': ['amoxicillin', 'ampicillin', 'piperacillin', 'dicloxacillin', 'cephalexin', 'amoxicilina'],
  'sulfa': ['sulfamethoxazole/trimethoprim', 'sulfasalazine', 'sulfadiazine', 'bactrim'],
  'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'aspirin', 'meloxicam', 'celecoxib', 'dexketoprofen', 'ibuprofeno', 'naproxeno'],
  'aine': ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'aspirin', 'meloxicam', 'celecoxib', 'dexketoprofen', 'ibuprofeno', 'naproxeno'],
  'aspirin': ['aspirin', 'adiro', 'tromalyt', 'ácido acetilsalicílico'],
  'aspro': ['aspirin', 'adiro', 'tromalyt', 'ácido acetilsalicílico'],
};

export const criticalConditionRules: Record<string, { drugs: string[], reasonKey: string }> = {
  'kidney': {
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'meloxicam', 'celecoxib'],
    reasonKey: 'reason_nsaids_renal'
  },
  'renal': {
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'meloxicam', 'celecoxib'],
    reasonKey: 'reason_nsaids_renal'
  },
  'angioedema': {
    drugs: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril'],
    reasonKey: 'reason_acei_angioedema'
  },
};

export const criticalDrugInteractionRules: { pair: string[], reasonKey: string }[] = [
  {
    pair: ['sildenafil', 'nitroglycerin'],
    reasonKey: 'reason_sildenafil_nitrates'
  },
  {
    pair: ['vardenafil', 'nitroglycerin'],
    reasonKey: 'reason_sildenafil_nitrates'
  },
  {
    pair: ['tadalafil', 'nitroglycerin'],
    reasonKey: 'reason_sildenafil_nitrates'
  },
  {
    pair: ['simvastatin', 'itraconazole'],
    reasonKey: 'reason_statins_itraconazole'
  },
  {
    pair: ['atorvastatin', 'itraconazole'],
    reasonKey: 'reason_statins_itraconazole'
  },
  {
    pair: ['warfarin', 'sulfamethoxazole/trimethoprim'],
    reasonKey: 'reason_warfarin_bactrim'
  },
  {
      pair: ['fluoxetine', 'phenelzine'],
      reasonKey: 'reason_serotonin_syndrome'
  },
  {
      pair: ['sertraline', 'phenelzine'],
      reasonKey: 'reason_serotonin_syndrome'
  },
  {
      pair: ['amiodarone', 'warfarin'],
      reasonKey: 'reason_bleeding_risk_amiodarone'
  },
  {
      pair: ['spironolactone', 'lisinopril'],
      reasonKey: 'reason_hyperkalemia_risk'
  },
  {
      pair: ['spironolactone', 'enalapril'],
      reasonKey: 'reason_hyperkalemia_risk'
  },
  {
      pair: ['digoxin', 'amiodarone'],
      reasonKey: 'reason_digoxin_toxicity'
  },
  {
      pair: ['methotrexate', 'ibuprofen'],
      reasonKey: 'reason_methotrexate_toxicity'
  },
  {
      pair: ['methotrexate', 'naproxen'],
      reasonKey: 'reason_methotrexate_toxicity'
  }
];
