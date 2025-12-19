// This file contains rules for the Proactive Alert system.
// These are well-known, high-risk interactions that should trigger an immediate warning to the user.
// All drug/condition/allergy names should be in lowercase for case-insensitive matching.

// Rule set for critical allergies and cross-reactivities.
// Key: a keyword for an allergy group.
// Value: an array of lowercase drug names belonging to that group.
export const criticalAllergyRules: Record<string, string[]> = {
  'penicillin': ['amoxicillin', 'ampicillin', 'piperacillin', 'dicloxacillin', 'cephalexin'], // Cephalexin for cross-reactivity
  'sulfa': ['sulfamethoxazole/trimethoprim', 'sulfasalazine', 'sulfadiazine'],
  'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'aspirin', 'meloxicam', 'celecoxib'],
  'aine': ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'aspirin', 'meloxicam', 'celecoxib'], // Spanish acronym for NSAID
};

// Rule set for critical drug-condition contraindications.
// Key: a keyword for a medical condition.
// Value: an object with `drugs` (array of lowercase drug names) and `reasonKey` (for translation).
export const criticalConditionRules: Record<string, { drugs: string[], reasonKey: string }> = {
  'kidney disease': {
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac'],
    reasonKey: 'reason_nsaids_renal'
  },
  'insuficiencia renal': {
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac'],
    reasonKey: 'reason_nsaids_renal'
  },
  'angioedema': {
    drugs: ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
    reasonKey: 'reason_acei_angioedema'
  },
};

// Rule set for critical drug-drug interactions.
// Each rule is an object with `pair` (an array of two lowercase drug names) and `reasonKey`.
export const criticalDrugInteractionRules: { pair: string[], reasonKey: string }[] = [
  {
    pair: ['sildenafil', 'nitroglycerin'],
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