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
import InvestigatorPanel from './components/InvestigatorPanel';
import AdminPanel from './components/AdminPanel';
// Added missing import for ProBadge
import ProBadge from './components/ProBadge';

type AnalysisMode = 'individual' | 'batch';
type ActiveTab = 'form' | 'patients' | 'history' | 'dashboard' | 'admin' | 'investigator';

const App: React.FC = () => {
  const { user, permissions, loading: authLoading } = useAuth();
  
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

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('individual');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const [lang] = useState<'es' | 'en'>(
    navigator.language.split('-')[0] === 'es' ? 'es' : 'en'
  );
  const t = translations[lang];

  useEffect(() => {
    const apiKey = process.env.API_KEY;
    // Solo mostramos el modal si detectamos activamente que falta, pero dejamos que Gemini falle si prefiere
    if (!apiKey || apiKey === "undefined") {
      setIsApiKeyMissing(true);
    } else {
      setIsApiKeyMissing(false);
      setIsApiKeyModalVisible(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' && !permissions.canAccessDashboard) setActiveTab('form');
    if (activeTab === 'patients' && !permissions.canManagePatients) setActiveTab('form');
    if (activeTab === 'admin' && !permissions.canConfigureSystem) setActiveTab('form');
    if (activeTab === 'investigator' && !permissions.canAccessInvestigator) setActiveTab('form');
    if (analysisMode === 'batch' && !permissions.canAccessBatchAnalysis) setAnalysisMode('individual');
  }, [activeTab, analysisMode, permissions]);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setIsDataLoading(true);
        try {
          const fetchedHistory = await getHistory(user.uid);
          setHistory(fetchedHistory);
          if (permissions.canManagePatients) {
            const fetchedProfiles = await getPatientProfiles(user.uid);
            setPatientProfiles(fetchedProfiles);
          }
        } catch (error) {
          console.error("Failed to load data:", error);
        } finally {
          setIsDataLoading(false);
        }
      }
    };
    loadData();
  }, [user, permissions.canManagePatients]);

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

  const addHistoryItem = useCallback(async (item: HistoryItem) => {
    setHistory(prevHistory => [item, ...prevHistory]);
    if (user) {
      await saveHistoryItem(user.uid, item);
    }
  }, [user]);
  
  const handleApiKeyError = useCallback(() => {
    setIsApiKeyModalVisible(true);
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
        medications, allergies, otherSubstances, pharmacogenetics, conditions, dateOfBirth, analysisResult: result, lang, patientId
      };
      await addHistoryItem(newHistoryItem);
    } catch (e: any) {
      if (e.message.includes('API key')) {
        setError(t.error_api_key_invalid);
        handleApiKeyError();
      } else {
        setError(e.message || t.error_unexpected);
      }
    } finally {
      setIsLoading(false);
    }
  }, [medications, allergies, otherSubstances, conditions, dateOfBirth, pharmacogenetics, lang, t, patientId, addHistoryItem, handleApiKeyError]);

  const handleLoadHistory = useCallback((item: HistoryItem) => {
    setMedications(item.medications);
    setAllergies(item.allergies || '');
    setOtherSubstances(item.otherSubstances);
    setPharmacogenetics(item.pharmacogenetics || '');
    setConditions(item.conditions);
    setDateOfBirth(item.dateOfBirth || '');
    setPatientId(item.patientId || '');
    setAnalysisResult(item.analysisResult);
    setAnalysisMode('individual');
    setActiveTab('form');
  }, []);

  const handleSaveOrUpdateProfile = useCallback(async () => {
    if (!patientId.trim() || !user) return;
    const profileData: PatientProfile = {
      id: patientId.trim(),
      medications, allergies, otherSubstances, pharmacogenetics, conditions, dateOfBirth,
      lastUpdated: new Date().toISOString(),
    };
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
      setActiveTab('form');
    }
  }, [patientProfiles]);

  const existingPatientIds = useMemo(() => new Set(patientProfiles.map(p => p.id)), [patientProfiles]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!user) return <Login t={t} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col font-sans transition-colors">
      {isApiKeyModalVisible && <ApiKeyModal t={t} onClose={() => setIsApiKeyModalVisible(false)} />}
      <div className="container mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8 flex-grow">
        <Header appName={t.appName} appDescription={t.appDescription} />
        <Disclaimer t={t} />
        <div className="mt-6 sm:mt-8"><TabSelector activeTab={activeTab} setActiveTab={setActiveTab} t={t} /></div>
        <main className="mt-4 sm:mt-6">
            {!isDataLoading && activeTab === 'form' && (
              <>
                <div className="mb-6 flex justify-center p-1 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
                  <button onClick={() => setAnalysisMode('individual')} className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md w-1/2 transition-all ${analysisMode === 'individual' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-600'}`}>{t.mode_individual}</button>
                  <button onClick={() => permissions.canAccessBatchAnalysis && setAnalysisMode('batch')} className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md w-1/2 transition-all ${analysisMode === 'batch' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-600'}`}>{t.mode_batch} {permissions.canAccessBatchAnalysis && <ProBadge />}</button>
                </div>
                {analysisMode === 'individual' ? (
                  <div>
                      <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                          <InteractionForm
                              patientId={patientId} setPatientId={setPatientId}
                              medications={medications} setMedications={setMedications}
                              allergies={allergies} setAllergies={setAllergies}
                              otherSubstances={otherSubstances} setOtherSubstances={setOtherSubstances}
                              pharmacogenetics={pharmacogenetics} setPharmacogenetics={setPharmacogenetics}
                              conditions={conditions} setConditions={setConditions}
                              dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
                              onAnalyze={handleAnalyze} onClear={handleClear} onSaveProfile={handleSaveOrUpdateProfile}
                              existingPatientIds={existingPatientIds} isLoading={isLoading} isApiKeyMissing={isApiKeyMissing}
                              onApiKeyError={handleApiKeyError} t={t}
                          />
                      </div>
                      {error && <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg animate-fade-in"><p className="font-bold">{t.error_title}</p><p>{error}</p></div>}
                      <ResultDisplay isLoading={isLoading} analysisResult={analysisResult} t={t} />
                  </div>
                ) : <BatchAnalysis t={t} lang={lang} onViewResult={handleLoadHistory} onAnalysisComplete={addHistoryItem} />}
              </>
            )}
            {!isDataLoading && activeTab === 'patients' && <PatientPanel profiles={patientProfiles} onLoadProfile={handleLoadProfile} onDeleteProfile={(id) => dbDeleteProfile(user.uid, id)} t={t} />}
            {!isDataLoading && activeTab === 'investigator' && <InvestigatorPanel medications={medications} conditions={conditions} dateOfBirth={dateOfBirth} pharmacogenetics={pharmacogenetics} t={t} lang={lang} />}
            {!isDataLoading && activeTab === 'history' && <HistoryPanel history={history} onLoadHistory={(id) => { const item = history.find(h => h.id === id); if (item) handleLoadHistory(item); }} onClearHistory={() => dbClearHistory(user.uid)} t={t} />}
            {!isDataLoading && activeTab === 'dashboard' && <DashboardPanel history={history} t={t} />}
            {!isDataLoading && activeTab === 'admin' && <AdminPanel t={t} />}
        </main>
      </div>
      <footer className="mt-12 py-6 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
          <div className="container mx-auto px-4"><p>{t.footer_disclaimer}</p></div>
      </footer>
      {isTermsModalOpen && <TermsModal onClose={() => setIsTermsModalOpen(false)} t={t} />}
      {isManualModalOpen && <ManualModal onClose={() => setIsManualModalOpen(false)} />}
    </div>
  );
};

export default App;