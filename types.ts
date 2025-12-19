
export interface ExternalIntegration {
  id: string;
  name: string;
  type: 'EHR' | 'eCRF' | 'Pharmacovigilance';
  protocol: 'FHIR' | 'REST' | 'Webhook';
  endpoint: string;
  status: 'active' | 'inactive';
  lastSync?: string;
}

export interface SystemSettings {
  prioritySources: string; 
  excludedSources: string; 
  safetyStrictness: 'standard' | 'strict' | 'loose';
  integrations?: ExternalIntegration[]; // Nueva propiedad
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface Source {
  uri: string;
  title: string;
  summary?: string;
  preview?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  potentialEffects?: string;
  recommendations?: string;
  references?: string;
}

// New specific types for structured analysis
export interface DrugDrugInteraction {
  interaction: string; // e.g., "Medication A + Medication B"
  riskLevel: string;
  clinicalSummary: string;
  potentialEffects: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export interface DrugSubstanceInteraction {
  medication: string;
  substance: string;
  riskLevel: string;
  clinicalSummary: string;
  potentialEffects: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export interface SupplementInteraction {
  medication: string;
  riskLevel: string;
  potentialEffects: string;
  recommendations: string;
}

export interface DrugConditionContraindication {
  medication: string;
  condition: string;
  riskLevel: string;
  clinicalSummary: string;
  contraindicationDetails: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export interface DrugPharmacogeneticContraindication {
  medication: string;
  geneticFactor: string;
  variantAllele?: string;
  riskLevel: string;
  clinicalSummary: string;
  implication: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export interface BeersCriteriaAlert {
  medication: string;
  criteria: string;
  riskLevel: string;
  clinicalSummary: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export interface DrugAllergyAlert {
  medication: string;
  allergen: string;
  riskLevel: string;
  clinicalSummary: string;
  alertDetails: string;
  recommendations: string;
  references: string;
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
}

export type AnyInteraction = DrugDrugInteraction | DrugSubstanceInteraction | DrugAllergyAlert | DrugConditionContraindication | DrugPharmacogeneticContraindication | BeersCriteriaAlert;


export interface AnalysisResult {
  analysisText: string;
  sources: Source[];
  drugDrugInteractions: DrugDrugInteraction[];
  drugSubstanceInteractions: DrugSubstanceInteraction[];
  drugAllergyAlerts: DrugAllergyAlert[];
  drugConditionContraindications: DrugConditionContraindication[];
  drugPharmacogeneticContraindications: DrugPharmacogeneticContraindication[];
  beersCriteriaAlerts: BeersCriteriaAlert[];
}

export interface InvestigatorResult {
  analysisText: string;
  sources: Source[];
  matches: {
    cause: string; // e.g. "Interaction: Drug A + Drug B" or "Side Effect: Drug A"
    probability: string; // High/Medium/Low
    mechanism: string;
  }[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  medications: Medication[];
  allergies?: string;
  otherSubstances: string;
  conditions: string;
  dateOfBirth?: string;
  pharmacogenetics?: string;
  analysisResult: AnalysisResult;
  lang?: 'es' | 'en';
  patientId?: string; // Optional patient ID for batch analysis
}

export interface InvestigatorHistoryItem {
  id: string;
  timestamp: string;
  symptoms: string;
  medications: Medication[];
  conditions: string;
  dateOfBirth: string;
  pharmacogenetics: string;
  result: InvestigatorResult;
  patientId?: string;
}

export interface PatientProfile {
  id: string; // Corresponds to patientId
  medications: Medication[];
  allergies: string;
  otherSubstances: string;
  conditions: string;
  dateOfBirth: string;
  pharmacogenetics: string;
  lastUpdated: string;
}

// Type for data from batch CSV file
export interface BatchPatientData {
  patient_id: string;
  medications: string;
  date_of_birth: string;
  allergies: string;
  other_substances: string;
  pharmacogenetics: string;
  conditions: string;
}

export interface BatchInvestigatorData {
  patient_id: string;
  symptoms: string;
  medications: string;
  date_of_birth: string;
  conditions: string;
  pharmacogenetics: string;
}

export interface ProactiveAlert {
  id: string; // for React key
  type: 'allergy' | 'condition' | 'drug-drug';
  title: string;
  message: string;
}

// Custom error for API key issues
export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

// --- User & Role Types ---
export type UserRole = 'personal' | 'professional' | 'admin';

export interface UserPermissions {
  canAccessDashboard: boolean;
  canAccessBatchAnalysis: boolean;
  canManageUsers: boolean;
  canViewAdvancedHistory: boolean;
  canExportData: boolean;
  canManagePatients: boolean;
  canConfigureSystem: boolean; // For Superuser/Admin
  canAccessInvestigator: boolean; // New permission
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  institution?: string; // Optional institution field
  createdAt: string;
}
