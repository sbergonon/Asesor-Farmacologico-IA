
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { investigateSymptoms } from '../services/geminiService';
import type { BatchInvestigatorData, InvestigatorHistoryItem, Medication } from '../types';
import UploadIcon from './icons/UploadIcon';
import BoltIcon from './icons/BoltIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';

interface BatchInvestigatorProps {
  t: any;
  lang: 'es' | 'en';
  onViewResult: (item: InvestigatorHistoryItem) => void;
}

type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'error';
interface PatientStatus {
  data: BatchInvestigatorData;
  status: AnalysisStatus;
  result?: InvestigatorHistoryItem;
  error?: string;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

const BatchInvestigator: React.FC<BatchInvestigatorProps> = ({ t, lang, onViewResult }) => {
  const [patientData, setPatientData] = useState<BatchInvestigatorData[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<PatientStatus[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEhrSyncing, setIsEhrSyncing] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    setFileError(null);
    setPatientData([]);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Fixed: added 'allergies' to requiredHeaders to match investigateSymptoms signature
        const requiredHeaders = ['patient_id', 'symptoms', 'medications', 'date_of_birth', 'conditions', 'pharmacogenetics', 'allergies'];
        const headers = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setFileError(t.batch_error_missing_columns.replace('{columns}', missingHeaders.join(', ')));
          return;
        }

        const data = (results.data as any[]).filter(row => row.patient_id && row.symptoms && row.medications);
        setPatientData(data);
      },
      error: (error) => {
        setFileError(`${t.batch_preview_error} ${error.message}`);
      }
    });
  };

  const handleEhrSync = () => {
      setIsEhrSyncing(true);
      // SIMULATION: Querying EHR for patients with recent adverse symptoms (e.g. Observation code for side effects)
      setTimeout(() => {
          // Fixed: added 'allergies' to mock patient data
          const mockInvestigatorData: BatchInvestigatorData[] = [
              { patient_id: 'FHIR-7721', symptoms: 'Dolor abdominal agudo y náuseas post-prandiales', medications: 'Metoprolol (50mg, 2/day); Atorvastatin (40mg, 1/day)', date_of_birth: '12-04-1970', pharmacogenetics: '', conditions: 'Hypertension; Hypercholesterolemia', allergies: 'NSAIDs' },
              { patient_id: 'FHIR-9902', symptoms: 'Tos seca persistente y angioedema leve facial', medications: 'Lisinopril (20mg, 1/day); Omeprazole (20mg, 1/day)', date_of_birth: '05-11-1955', pharmacogenetics: 'CYP2C19 (Poor)', conditions: 'GERD; Heart Failure', allergies: 'Penicillin' },
              { patient_id: 'FHIR-1044', symptoms: 'Agitación psicomotriz y temblores finos', medications: 'Sertraline (100mg, 1/day)', date_of_birth: '22-08-1988', pharmacogenetics: '', conditions: 'Depression', allergies: '' }
          ];
          setPatientData(mockInvestigatorData);
          setIsEhrSyncing(false);
          alert(t.batch_ehr_sync_success.replace('{count}', mockInvestigatorData.length));
      }, 2000);
  };

  const handleSyncToEhr = (patientId: string) => {
      setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'syncing' } : s));
      
      // SIMULATION: Sending a FHIR DocumentReference (DiagnosticReport) back to the EHR
      setTimeout(() => {
          setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'synced' } : s));
          setTimeout(() => {
             setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'idle' } : s));
          }, 3000);
      }, 1500);
  };

  const handleDownloadTemplate = () => {
    // Fixed: added 'allergies' column to CSV template
    const csvContent = "patient_id,symptoms,medications,date_of_birth,conditions,pharmacogenetics,allergies\n" +
      `PATIENT-001,"Frequent dizziness and hypotension","Lisinopril (10mg, 1/day); Metformin (500mg, 2/day)",15-05-1965,"Hypertension","",""\n` +
      `PATIENT-002,"Generalized skin rash","Amoxicillin (500mg, 3/day)",20-11-1980,"Dental infection","","Penicillin"`;
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'investigator_batch_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setAnalysisStatus(patientData.map(data => ({ data, status: 'pending', syncStatus: 'idle' })));

    const CONCURRENT_LIMIT = 2;
    const queue = [...patientData];
    
    const processQueue = async () => {
        if (queue.length === 0) return;
        const patient = queue.shift();
        if(!patient) return;

        setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patient.patient_id ? { ...s, status: 'analyzing' } : s));
        
        try {
            const medsRaw = patient.medications || '';
            const meds: Medication[] = medsRaw.split(';')
              .map(s => s.trim())
              .filter(Boolean)
              .map(str => {
                  const match = str.match(/([^()]+)\s*\(([^)]+)\)/);
                  if (match) {
                      const name = match[1].trim();
                      const details = match[2].split(',').map(d => d.trim());
                      return { name, dosage: details[0] || '', frequency: details[1] || '' };
                  }
                  return { name: str, dosage: '', frequency: '' };
              });
            
            // Fixed: Added the missing 6th argument 'allergies' to investigateSymptoms call
            const result = await investigateSymptoms(patient.symptoms, meds, patient.conditions, patient.date_of_birth, patient.pharmacogenetics, patient.allergies || '', lang);
            
            const historyItem: InvestigatorHistoryItem = {
                id: new Date().toISOString() + patient.patient_id,
                timestamp: new Date().toLocaleString(),
                symptoms: patient.symptoms,
                medications: meds,
                conditions: patient.conditions,
                dateOfBirth: patient.date_of_birth,
                pharmacogenetics: patient.pharmacogenetics,
                result: result,
                patientId: patient.patient_id,
            };
            
            setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patient.patient_id ? { ...s, status: 'completed', result: historyItem } : s));
        } catch (e: any) {
            setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patient.patient_id ? { ...s, status: 'error', error: e.message } : s));
        }
    };
    
    const workers = Array(CONCURRENT_LIMIT).fill(Promise.resolve()).map(async () => {
        while(queue.length > 0) {
            await processQueue();
        }
    });

    await Promise.all(workers);
  };
  
  const completedCount = useMemo(() => analysisStatus.filter(s => s.status === 'completed' || s.status === 'error').length, [analysisStatus]);
  const isBatchFinished = isProcessing && completedCount === patientData.length;

  return (
    <div className={`space-y-6 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700`}>
      {!isProcessing ? (
        <>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.investigator_mode_batch}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.investigator_batch_description}</p>
            </div>
            <button
                onClick={handleEhrSync}
                disabled={isEhrSyncing}
                className="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
                {isEhrSyncing ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {t.investigator_ehr_sync_loading}
                    </>
                ) : (
                    <>
                        <BoltIcon className="h-4 w-4 mr-2" />
                        {t.investigator_ehr_sync_btn}
                    </>
                )}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t.batch_upload_title}</h3>
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]);
              }}
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragOver ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-600'} border-dashed rounded-md transition-colors`}
            >
              <div className="space-y-1 text-center">
                  <UploadIcon className="mx-auto h-12 w-12 text-slate-400"/>
                  <div className="flex text-sm text-slate-600 dark:text-slate-400">
                      <label htmlFor="file-upload-investigator" className="relative cursor-pointer bg-white dark:bg-slate-800/50 rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                          <span>{t.batch_upload_prompt.split(',')[1]}</span>
                          <input id="file-upload-investigator" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                      </label>
                      <p className="pl-1">{t.batch_upload_prompt.split(',')[0]}</p>
                  </div>
              </div>
            </div>
            <div className="flex flex-col items-center mt-2 space-y-1">
                <button type="button" onClick={handleDownloadTemplate} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    {t.batch_template_button}
                </button>
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 max-w-md">{t.investigator_batch_template_note}</p>
            </div>
          </div>
            
          {fileError && <p className="text-sm text-red-600 dark:text-red-400">{fileError}</p>}
          
          {patientData.length > 0 && (
              <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t.batch_preview_title}</h3>
                  <div className="max-h-40 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                               <th className="py-2 px-3 text-left">patient_id</th>
                               <th className="py-2 px-3 text-left">symptoms</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {patientData.slice(0, 5).map((p, i) => (
                            <tr key={i}>
                                <td className="py-2 px-3">{p.patient_id}</td>
                                <td className="py-2 px-3 truncate max-w-xs">{p.symptoms}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={runAnalysis} className="inline-flex items-center py-3 px-8 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700">
                        {t.batch_run_analysis_button.replace('{count}', patientData.length.toString())}
                    </button>
                  </div>
              </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{isBatchFinished ? t.batch_results_title : t.batch_progress_title}</h3>
            {!isBatchFinished && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{t.batch_progress_analyzing.replace('{done}', completedCount).replace('{total}', patientData.length)}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(completedCount / patientData.length) * 100}%` }}></div>
                </div>
              </>
            )}
            
            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t.batch_progress_patient_id}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t.batch_progress_status}</th>
                            <th className="relative px-4 py-2"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {analysisStatus.map(({data, status, result, error, syncStatus}, index) => (
                        <tr key={index}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{data.patient_id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    status === 'completed' ? 'bg-green-100 text-green-700' : 
                                    status === 'analyzing' ? 'bg-blue-100 text-blue-700 animate-pulse' : 
                                    status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {status}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                    {status === 'completed' && result && (
                                        <>
                                            <button 
                                                onClick={() => handleSyncToEhr(data.patient_id)}
                                                disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
                                                className={`flex items-center text-[10px] font-bold px-2 py-1 rounded border transition-all ${
                                                    syncStatus === 'synced' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    syncStatus === 'syncing' ? 'bg-slate-50 text-slate-400 border-slate-200 animate-pulse' :
                                                    'text-indigo-600 hover:text-indigo-900 border-indigo-200 hover:bg-indigo-50'
                                                }`}
                                            >
                                                {syncStatus === 'synced' ? <><CheckCircleIcon className="h-3 w-3 mr-1" /> {t.investigator_results_sent_success}</> : 
                                                 syncStatus === 'syncing' ? <><ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" /> {t.investigator_results_sending}</> : 
                                                 <><BoltIcon className="h-3 w-3 mr-1" /> {t.investigator_results_send_to_ehr}</>}
                                            </button>
                                            <button onClick={() => onViewResult(result)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 font-bold">{t.batch_results_view_report}</button>
                                        </>
                                    )}
                                    {status === 'error' && (
                                        <p className="text-red-600 text-xs truncate max-w-[150px]" title={error}>{error}</p>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            {isBatchFinished && (
                <button onClick={() => setIsProcessing(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold shadow-sm transition-all hover:bg-slate-200">
                    Volver al Cargador
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default BatchInvestigator;
