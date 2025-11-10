
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { analyzeInteractions } from './services/geminiService';
import type { AnalysisResult, HistoryItem, Medication, PatientProfile } from './types';
import Header from './components/Header';
import Disclaimer from './components/Disclaimer';
import InteractionForm from './components/InteractionForm';
import ResultDisplay from './components/ResultDisplay';
import HistoryPanel from './components/HistoryPanel';
import TabSelector from './components/TabSelector';
import TermsModal from './components/TermsModal';
import BatchAnalysis from './components/BatchAnalysis';
import PatientPanel from './components/PatientPanel';
import { translations } from './lib/translations';
import DashboardPanel from './components/DashboardPanel';
import ProactiveAlerts from './components/ProactiveAlerts';
// import ApiKeyModal from './components/ApiKeyModal';


type AnalysisMode = 'individual' | 'batch';
type ActiveTab = 'form' | 'patients' | 'history' | 'dashboard';

const App: React.FC = () => {
  // Estado para el modo Individual
  const [medications, setMedications] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState('');
  const [otherSubstances, setOtherSubstances] = useState('');
  const [pharmacogenetics, setPharmacogenetics] = useState('');
  const [conditions, setConditions] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [patientId, setPatientId] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado general y de la UI
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('individual');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  
  const [lang] = useState<'es' | 'en'>(
    navigator.language.split('-')[0] === 'es' ? 'es' : 'en'
  );
  const t = translations[lang];

  useEffect(() => {
    // FIX: Removed API key check. It is assumed to be present in the environment.
    

    try {
      const savedHistory = localStorage.getItem('drugInteractionHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      const savedProfiles = localStorage.getItem('patientProfiles');
      if (savedProfiles) {
        setPatientProfiles(JSON.parse(savedProfiles));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      localStorage.removeItem('drugInteractionHistory');
      localStorage.removeItem('patientProfiles');
    }
  }, []);
  
  const handleClear = useCallback(() => {
    setMedications([]);
    setAllergies('');
    setOtherSubstances('');
    setPharmacogenetics('');
    setConditions('');
    setDateOfBirth('');
    setPatientId('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (medications.length === 0) {
      setError(t.error_add_medication);
      return;
    }
    
    if (conditions.trim() === '') {
      setError(t.error_add_conditions);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeInteractions(medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang);
      setAnalysisResult(result);

      const newHistoryItem: HistoryItem = {
        id: new Date().toISOString(),
        timestamp: new Date().toLocaleString(),
        medications,
        allergies,
        otherSubstances,
        pharmacogenetics,
        conditions,
        dateOfBirth,
        analysisResult: result,
        lang,
        patientId,
      };
      
      setHistory(prevHistory => {
        const updatedHistory = [newHistoryItem, ...prevHistory];
        localStorage.setItem('drugInteractionHistory', JSON.stringify(updatedHistory));
        return updatedHistory;
      });

    } catch (e: any) {
      setError(e.message || t.error_unexpected);
    } finally {
      setIsLoading(false);
    }
  }, [medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang, t, patientId]);

  const handleLoadHistory = useCallback((item: HistoryItem) => {
    setMedications(item.medications);
    setAllergies(item.allergies || '');
    setOtherSubstances(item.otherSubstances);
    setPharmacogenetics(item.pharmacogenetics || '');
    setConditions(item.conditions);
    setDateOfBirth(item.dateOfBirth || '');
    setPatientId(item.patientId || '');
    setAnalysisResult({
      ...item.analysisResult,
      drugDrugInteractions: item.analysisResult.drugDrugInteractions || [],
      drugSubstanceInteractions: item.analysisResult.drugSubstanceInteractions || [],
      drugAllergyAlerts: item.analysisResult.drugAllergyAlerts || [],
      drugConditionContraindications: item.analysisResult.drugConditionContraindications || [],
      drugPharmacogeneticContraindications: item.analysisResult.drugPharmacogeneticContraindications || [],
      beersCriteriaAlerts: item.analysisResult.beersCriteriaAlerts || [],
    });
    setError(null);
    setIsLoading(false);
    setAnalysisMode('individual');
    setActiveTab('form');
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('drugInteractionHistory');
  }, []);

  const handleSaveOrUpdateProfile = useCallback(() => {
    if (!patientId.trim()) return;

    const profileData: PatientProfile = {
      id: patientId.trim(),
      medications,
      allergies,
      otherSubstances,
      pharmacogenetics,
      conditions,
      dateOfBirth,
      lastUpdated: new Date().toISOString(),
    };
    
    setPatientProfiles(prevProfiles => {
      const existingIndex = prevProfiles.findIndex(p => p.id === profileData.id);
      let updatedProfiles;
      if (existingIndex !== -1) {
        // Update existing
        updatedProfiles = [...prevProfiles];
        updatedProfiles[existingIndex] = profileData;
      } else {
        // Add new
        updatedProfiles = [profileData, ...prevProfiles];
      }
      localStorage.setItem('patientProfiles', JSON.stringify(updatedProfiles));
      return updatedProfiles;
    });
  }, [patientId, medications, allergies, otherSubstances, pharmacogenetics, conditions, dateOfBirth]);

  const handleLoadProfile = useCallback((id: string) => {
    const profile = patientProfiles.find(p => p.id === id);
    if (profile) {
      setPatientId(profile.id);
      setMedications(profile.medications);
      setAllergies(profile.allergies);
      setOtherSubstances(profile.otherSubstances);
      setPharmacogenetics(profile.pharmacogenetics);
      setConditions(profile.conditions);
      setDateOfBirth(profile.dateOfBirth);
      setAnalysisResult(null);
      setError(null);
      setActiveTab('form');
    }
  }, [patientProfiles]);

  const handleDeleteProfile = useCallback((id: string) => {
    setPatientProfiles(prevProfiles => {
      const updatedProfiles = prevProfiles.filter(p => p.id !== id);
      localStorage.setItem('patientProfiles', JSON.stringify(updatedProfiles));
      return updatedProfiles;
    });
  }, []);
  
  const existingPatientIds = useMemo(() => new Set(patientProfiles.map(p => p.id)), [patientProfiles]);

  const AnalysisModeSelector = () => (
    <div className="mb-6 flex justify-center p-1 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
      <button
        onClick={() => setAnalysisMode('individual')}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-1/2 ${
          analysisMode === 'individual'
            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600/50'
        }`}
      >
        {t.mode_individual}
      </button>
      <button
        onClick={() => setAnalysisMode('batch')}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-1/2 ${
          analysisMode === 'batch'
            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600/50'
        }`}
      >
        {t.mode_batch} (Pro)
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Header appName={t.appName} appDescription={t.appDescription} />
        <Disclaimer t={t} />
        
        <div className="mt-8">
            <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
        </div>

        <main className="mt-6">
            {activeTab === 'form' && (
              <>
                <AnalysisModeSelector />
                {analysisMode === 'individual' ? (
                  <div>
                      <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                          <InteractionForm
                              patientId={patientId}
                              setPatientId={setPatientId}
                              medications={medications}
                              setMedications={setMedications}
                              allergies={allergies}
                              setAllergies={setAllergies}
                              otherSubstances={otherSubstances}
                              setOtherSubstances={setOtherSubstances}
                              pharmacogenetics={pharmacogenetics}
                              setPharmacogenetics={setPharmacogenetics}
                              conditions={conditions}
                              setConditions={setConditions}
                              dateOfBirth={dateOfBirth}
                              setDateOfBirth={setDateOfBirth}
                              onAnalyze={handleAnalyze}
                              onClear={handleClear}
                              onSaveProfile={handleSaveOrUpdateProfile}
                              existingPatientIds={existingPatientIds}
                              isLoading={isLoading}
                              t={t}
                          />
                      </div>
                      
                      <ProactiveAlerts 
                        medications={medications}
                        allergies={allergies}
                        conditions={conditions}
                        t={t}
                      />

                      {error && (
                         <div className="mt-8 p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                           <p className="font-bold">{t.error_title}</p>
                           <p>{error}</p>
                         </div>
                      )}

                      <ResultDisplay
                        isLoading={isLoading}
                        analysisResult={analysisResult}
                        t={t}
                      />
                  </div>
                ) : (
                  <BatchAnalysis 
                    t={t} 
                    lang={lang} 
                    onViewResult={handleLoadHistory}
                  />
                )}
              </>
            )}

            {activeTab === 'patients' && (
                <PatientPanel
                    profiles={patientProfiles}
                    onLoadProfile={handleLoadProfile}
                    onDeleteProfile={handleDeleteProfile}
                    t={t}
                 />
            )}
            
            {activeTab === 'history' && (
                <HistoryPanel
                    history={history}
                    onLoadHistory={(id) => {
                      const item = history.find(h => h.id === id);
                      if (item) handleLoadHistory(item);
                    }}
                    onClearHistory={handleClearHistory}
                    t={t}
                 />
            )}

            {activeTab === 'dashboard' && (
                <DashboardPanel
                    history={history}
                    t={t}
                 />
            )}
        </main>

        <footer className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>{t.footer_disclaimer}</p>
            <p className="mt-2">
              <button 
                  onClick={() => setIsTermsModalOpen(true)} 
                  className="underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                  {t.terms_and_conditions}
              </button>
            </p>
        </footer>

        {isTermsModalOpen && <TermsModal onClose={() => setIsTermsModalOpen(false)} t={t} />}
      </div>
    </div>
  );
};

export default App;
