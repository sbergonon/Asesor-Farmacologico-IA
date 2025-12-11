
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { analyzeInteractions } from './services/geminiService';
import { 
  getHistory, 
  saveHistoryItem, 
  clearHistory as dbClearHistory,
  getPatientProfiles,
  savePatientProfile,
  deletePatientProfile as dbDeleteProfile
} from './services/db';
import { useAuth } from './contexts/AuthContext';
import type { AnalysisResult, HistoryItem, Medication, PatientProfile } from './types';
import { ApiKeyError } from './types';
import Header from './components/Header';
import Disclaimer from './components/Disclaimer';
import InteractionForm from './components/InteractionForm';
import ResultDisplay from './components/ResultDisplay';
import HistoryPanel from './components/HistoryPanel';
import TabSelector from './components/TabSelector';
import TermsModal from './components/TermsModal';
import ManualModal from './components/ManualModal';
import BatchAnalysis from './components/BatchAnalysis';
import PatientPanel from './components/PatientPanel';
import ApiKeyModal from './components/ApiKeyModal';
import Login from './components/Login';
import { translations } from './lib/translations';
import DashboardPanel from './components/DashboardPanel';
import CheckCircleIcon from './components/icons/CheckCircleIcon';
import ProBadge from './components/ProBadge';
import RestrictedFeatureWrapper from './components/RestrictedFeatureWrapper';
import AdminPanel from './components/AdminPanel';
import DocumentTextIcon from './components/icons/DocumentTextIcon';
import InvestigatorPanel from './components/InvestigatorPanel';


type AnalysisMode = 'individual' | 'batch';
type ActiveTab = 'form' | 'patients' | 'history' | 'dashboard' | 'admin' | 'investigator';

const App: React.FC = () => {
  const { user, permissions, loading: authLoading } = useAuth();
  
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
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [showSessionRestoredToast, setShowSessionRestoredToast] = useState(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const [lang] = useState<'es' | 'en'>(
    navigator.language.split('-')[0] === 'es' ? 'es' : 'en'
  );
  const t = translations[lang];

  // Ref to track initial render for auto-saving
  const isInitialRender = useRef(true);

  // Check API Key
  useEffect(() => {
    const hasApiKey = 
      (typeof process !== 'undefined' && process.env?.API_KEY) || 
      // @ts-ignore
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY);

    if (!hasApiKey) {
      console.error("API Key is missing. Please set VITE_GEMINI_API_KEY environment variable.");
      setIsApiKeyMissing(true);
      setIsApiKeyModalVisible(true);
    }
  }, []);

  // Access Control Guard
  useEffect(() => {
    if (activeTab === 'dashboard' && !permissions.canAccessDashboard) setActiveTab('form');
    if (activeTab === 'patients' && !permissions.canManagePatients) setActiveTab('form');
    if (activeTab === 'admin' && !permissions.canConfigureSystem) setActiveTab('form');
    if (activeTab === 'investigator' && !permissions.canAccessInvestigator) setActiveTab('form');
    if (analysisMode === 'batch' && !permissions.canAccessBatchAnalysis) setAnalysisMode('individual');
  }, [activeTab, analysisMode, permissions]);

  // Load Data from Firestore when user logs in
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setIsDataLoading(true);
        try {
          // Parallel loading of history and profiles
          // Only load profiles if user has permission
          const promises: Promise<any>[] = [getHistory(user.uid)];
          if (permissions.canManagePatients) {
            promises.push(getPatientProfiles(user.uid));
          }

          const results = await Promise.all(promises);
          setHistory(results[0]);
          if (results[1]) setPatientProfiles(results[1]);

        } catch (error) {
          console.error("Failed to load data from Firebase:", error);
        } finally {
          setIsDataLoading(false);
        }
      } else {
        setHistory([]);
        setPatientProfiles([]);
      }
    };
    loadData();
  }, [user, permissions.canManagePatients]);

  // Load local session (just draft data, still using localStorage for temporary draft)
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('savedAnalysisSession');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        setPatientId(sessionData.patientId || '');
        setMedications(sessionData.medications || []);
        setAllergies(sessionData.allergies || '');
        setOtherSubstances(sessionData.otherSubstances || '');
        setPharmacogenetics(sessionData.pharmacogenetics || '');
        setConditions(sessionData.conditions || '');
        setDateOfBirth(sessionData.dateOfBirth || '');
        setShowSessionRestoredToast(true);
        setTimeout(() => setShowSessionRestoredToast(false), 4000);
      }
    } catch (error) {
      console.error("Failed to load session:", error);
      localStorage.removeItem('savedAnalysisSession');
    }
  }, []);

  // Auto-save session draft to localStorage
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
  
    const isFormEmpty =
      medications.length === 0 &&
      !allergies.trim() &&
      !otherSubstances.trim() &&
      !pharmacogenetics.trim() &&
      !conditions.trim() &&
      !dateOfBirth.trim() &&
      !patientId.trim();
  
    if (!isFormEmpty) {
      const sessionData = {
        patientId,
        medications,
        allergies,
        otherSubstances,
        pharmacogenetics,
        conditions,
        dateOfBirth,
      };
      localStorage.setItem('savedAnalysisSession', JSON.stringify(sessionData));
    }
  }, [patientId, medications, allergies, otherSubstances, pharmacogenetics, conditions, dateOfBirth]);
  
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
    localStorage.removeItem('savedAnalysisSession');
  }, []);

  const addHistoryItem = useCallback(async (item: HistoryItem) => {
    setHistory(prevHistory => [item, ...prevHistory]);
    if (user) {
      await saveHistoryItem(user.uid, item);
    }
  }, [user]);
  
  const handleApiKeyError = useCallback(() => {
    setIsApiKeyMissing(true);
    setIsApiKeyModalVisible(true);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (isApiKeyMissing) {
      handleApiKeyError();
      return;
    }

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
      
      await addHistoryItem(newHistoryItem);
      localStorage.removeItem('savedAnalysisSession');

    } catch (e: any) {
      if (e instanceof ApiKeyError) {
        setError(e.message);
        handleApiKeyError();
      } else {
        setError(e.message || t.error_unexpected);
      }
    } finally {
      setIsLoading(false);
    }
  }, [medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang, t, patientId, addHistoryItem, isApiKeyMissing, handleApiKeyError]);

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

  const handleClearHistory = useCallback(async () => {
    setHistory([]);
    if (user) {
      await dbClearHistory(user.uid);
    }
  }, [user]);

  const handleSaveOrUpdateProfile = useCallback(async () => {
    if (!patientId.trim() || !user) return;

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
        updatedProfiles = [...prevProfiles];
        updatedProfiles[existingIndex] = profileData;
      } else {
        updatedProfiles = [profileData, ...prevProfiles];
      }
      return updatedProfiles;
    });
    
    await savePatientProfile(user.uid, profileData);
  }, [patientId, medications, allergies, otherSubstances, pharmacogenetics, conditions, dateOfBirth, user]);
  
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

  const handleDeleteProfile = useCallback(async (id: string) => {
    setPatientProfiles(prevProfiles => prevProfiles.filter(p => p.id !== id));
    if (user) {
      await dbDeleteProfile(user.uid, id);
    }
  }, [user]);
  
  const existingPatientIds = useMemo(() => new Set(patientProfiles.map(p => p.id)), [patientProfiles]);

  const canAccessBatch = permissions.canAccessBatchAnalysis;

  const AnalysisModeSelector = () => (
    <div className="mb-6 flex justify-center p-1 bg-slate-200 dark:bg-slate-700/50 rounded-lg relative">
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
      
      <div className="w-1/2">
        <RestrictedFeatureWrapper 
          isAllowed={canAccessBatch} 
          message="Análisis por Lote requiere cuenta Profesional."
          className="w-full"
        >
          <button
            onClick={() => canAccessBatch && setAnalysisMode('batch')}
            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center ${
              analysisMode === 'batch'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600/50'
            }`}
          >
            {t.mode_batch} 
            {canAccessBatch && <ProBadge />}
          </button>
        </RestrictedFeatureWrapper>
      </div>
    </div>
  );

  // --- Auth & Loading Gates ---

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login t={t} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
      {isApiKeyModalVisible && <ApiKeyModal t={t} onClose={() => setIsApiKeyModalVisible(false)} />}
      {showSessionRestoredToast && (
          <div className="fixed top-5 right-5 z-50 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 px-4 py-3 rounded-lg shadow-lg flex items-center animate-pulse">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <p className="font-bold">{t.session_restored_toast}</p>
          </div>
      )}
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-10 flex-grow">
        <Header appName={t.appName} appDescription={t.appDescription} />
        <Disclaimer t={t} />
        
        <div className="mt-8">
            <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
        </div>

        <main className="mt-6">
            {isDataLoading && (
               <div className="text-center py-4">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                 <p className="mt-2 text-sm text-slate-500">Loading data...</p>
               </div>
            )}

            {!isDataLoading && activeTab === 'form' && (
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
                              isApiKeyMissing={isApiKeyMissing}
                              onApiKeyError={handleApiKeyError}
                              t={t}
                          />
                      </div>
                      
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
                    onAnalysisComplete={addHistoryItem}
                  />
                )}
              </>
            )}

            {!isDataLoading && activeTab === 'patients' && permissions.canManagePatients && (
                <PatientPanel
                    profiles={patientProfiles}
                    onLoadProfile={handleLoadProfile}
                    onDeleteProfile={handleDeleteProfile}
                    t={t}
                 />
            )}
            
            {!isDataLoading && activeTab === 'investigator' && permissions.canAccessInvestigator && (
                <InvestigatorPanel
                    medications={medications}
                    conditions={conditions}
                    dateOfBirth={dateOfBirth}
                    pharmacogenetics={pharmacogenetics}
                    t={t}
                    lang={lang}
                />
            )}

            {!isDataLoading && activeTab === 'history' && (
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

            {!isDataLoading && activeTab === 'dashboard' && permissions.canAccessDashboard && (
                <DashboardPanel
                    history={history}
                    t={t}
                 />
            )}

            {!isDataLoading && activeTab === 'admin' && permissions.canConfigureSystem && (
                <AdminPanel t={t} />
            )}
        </main>
      </div>
      
      <footer className="mt-12 py-6 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
          <div className="container mx-auto px-4">
            <p>{t.footer_disclaimer}</p>
            <div className="mt-4 flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-6">
                <button 
                    onClick={() => setIsManualModalOpen(true)} 
                    className="flex items-center justify-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                    <DocumentTextIcon className="h-4 w-4 mr-1" />
                    {t.manual_button_title}
                </button>
                <button 
                    onClick={() => setIsTermsModalOpen(true)} 
                    className="underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                    {t.terms_and_conditions}
                </button>
            </div>
          </div>
      </footer>

      {isTermsModalOpen && <TermsModal onClose={() => setIsTermsModalOpen(false)} t={t} />}
      {isManualModalOpen && <ManualModal onClose={() => setIsManualModalOpen(false)} />}
    </div>
  );
};

export default App;
