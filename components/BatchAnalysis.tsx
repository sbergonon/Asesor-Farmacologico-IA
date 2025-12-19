import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { analyzeInteractions } from '../services/geminiService';
import type { BatchPatientData, HistoryItem, Medication } from '../types';
import UploadIcon from './icons/UploadIcon';
import BoltIcon from './icons/BoltIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';

interface BatchAnalysisProps {
  t: any;
  lang: 'es' | 'en';
  onViewResult: (item: HistoryItem) => void;
  onAnalysisComplete: (item: HistoryItem) => void;
}

type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'error';
interface PatientStatus {
  data: BatchPatientData;
  status: AnalysisStatus;
  result?: HistoryItem;
  error?: string;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

const BatchAnalysis: React.FC<BatchAnalysisProps> = ({ t, lang, onViewResult, onAnalysisComplete }) => {
  const [patientData, setPatientData] = useState<BatchPatientData[]>([]);
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
        const requiredHeaders = ['patient_id', 'medications', 'date_of_birth', 'allergies', 'other_substances', 'pharmacogenetics', 'conditions'];
        const headers = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setFileError(t.batch_error_missing_columns.replace('{columns}', missingHeaders.join(', ')));
          return;
        }

        const data = (results.data as any[]).filter(row => row.patient_id && row.medications && row.conditions);
        setPatientData(data);
      },
      error: (error) => {
        setFileError(`${t.batch_preview_error} ${error.message}`);
      }
    });
  };

  const handleEhrSync = () => {
      setIsEhrSyncing(true);
      // SIMULATION: Calling a FHIR Server endpoint (e.g. GET /Patient?active=true)
      setTimeout(() => {
          const mockEhrData: BatchPatientData[] = [
              { patient_id: 'FHIR-7721', medications: 'Metoprolol (50mg, 2/day); Atorvastatin (40mg, 1/day)', date_of_birth: '12-04-1970', allergies: 'NSAIDs', other_substances: 'Alcohol', pharmacogenetics: '', conditions: 'Hypertension; Hypercholesterolemia' },
              { patient_id: 'FHIR-9902', medications: 'Lisinopril (20mg, 1/day); Omeprazole (20mg, 1/day)', date_of_birth: '05-11-1955', allergies: 'Penicillin', other_substances: '', pharmacogenetics: 'CYP2C19 (Poor)', conditions: 'GERD; Heart Failure' },
              { patient_id: 'FHIR-1044', medications: 'Sertraline (100mg, 1/day)', date_of_birth: '22-08-1988', allergies: '', other_substances: 'St. Johns Wort', pharmacogenetics: '', conditions: 'Depression' }
          ];
          setPatientData(mockEhrData);
          setIsEhrSyncing(false);
          alert(t.batch_ehr_sync_success.replace('{count}', mockEhrData.length));
      }, 2000);
  };

  const handleSyncToEhr = (patientId: string) => {
      setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'syncing' } : s));
      
      // SIMULATION: Sending a FHIR DocumentReference back to the EHR
      setTimeout(() => {
          setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'synced' } : s));
          setTimeout(() => {
             setAnalysisStatus(prev => prev.map(s => s.data.patient_id === patientId ? { ...s, syncStatus: 'idle' } : s));
          }, 3000);
      }, 1500);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "patient_id,medications,date_of_birth,allergies,other_substances,pharmacogenetics,conditions\n" +
      `PATIENT-001,"Lisinopril (10mg, 1/day); Metformin (500mg, 2/day)",15-05-1965,"Penicilina;AINEs","${t.substance_alcohol}; ${t.substance_tobacco}; Vitamin C","","Hypertension, I10"\n` +
      `PATIENT-002,"Atorvastatin (20mg, 1/day)",20-11-1958,"Sulfamidas","Ginkgo Biloba","CYP2C19 (${t.form_pgx_status_poor})","Hypercholesterolemia, History of MI"`;
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setAnalysisStatus(patientData.map(data => ({ data, status: 'pending', syncStatus: 'idle' })));

    const CONCURRENT_LIMIT = 5;
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
                      return {
                          name: name,
                          dosage: details[0] || '',
                          frequency: details[1] || ''
                      };
                  }
                  return { name: str, dosage: '', frequency: '' };
              });
            const result = await analyzeInteractions(meds, patient.allergies, patient.other_substances, patient.conditions, patient.date_of_birth, patient.pharmacogenetics, lang);
            
            const historyItem: HistoryItem = {
                id: new Date().toISOString() + patient.patient_id,
                timestamp: new Date().toLocaleString(),
                medications: meds,
                allergies: patient.allergies,
                otherSubstances: patient.other_substances,
                pharmacogenetics: patient.pharmacogenetics,
                conditions: patient.conditions,
                dateOfBirth: patient.date_of_birth,
                analysisResult: result,
                lang,
                patientId: patient.patient_id,
            };
            
            onAnalysisComplete(historyItem);

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

  const renderStatusBadge = (status: AnalysisStatus) => {
    const baseClasses = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
    switch (status) {
        case 'pending':
            return <span className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200`}>{t.batch_progress_status_pending}</span>;
        case 'analyzing':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>{t.batch_progress_status_analyzing}</span>;
        case 'completed':
            return <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>{t.batch_progress_status_completed}</span>;
        case 'error':
            return <span className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`}>{t.batch_progress_status_error}</span>;
    }
  };


  if (isProcessing) {
    return (
        <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-4">{isBatchFinished ? t.batch_results_title : t.batch_progress_title}</h3>
            {!isBatchFinished && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{t.batch_progress_analyzing.replace('{done}', completedCount).replace('{total}', patientData.length)}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(completedCount / patientData.length) * 100}%` }}></div>
                </div>
              </>
            )}
            {isBatchFinished && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{t.batch_results_completed}</p>}

            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.batch_progress_patient_id}</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.batch_progress_status}</th>
                            <th scope="col" className="relative px-4 py-2"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                    {analysisStatus.map(({data, status, result, error, syncStatus}, index) => (
                        <tr key={index}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{data.patient_id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{renderStatusBadge(status)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                    {status === 'completed' && result && (
                                        <>
                                            <button 
                                                onClick={() => handleSyncToEhr(data.patient_id)}
                                                disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
                                                className={`flex items-center text-xs font-bold px-2 py-1 rounded border transition-all ${
                                                    syncStatus === 'synced' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    syncStatus === 'syncing' ? 'bg-slate-50 text-slate-400 border-slate-200 animate-pulse' :
                                                    'text-teal-600 hover:text-teal-900 border-teal-200 hover:bg-teal-50'
                                                }`}
                                            >
                                                {syncStatus === 'synced' ? <><CheckCircleIcon className="h-3 w-3 mr-1" /> {t.batch_results_sent_success}</> : 
                                                 syncStatus === 'syncing' ? <><ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" /> {t.batch_results_sending_to_ehr}</> : 
                                                 <><BoltIcon className="h-3 w-3 mr-1" /> {t.batch_results_send_to_ehr}</>}
                                            </button>
                                            <button onClick={() => onViewResult(result)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 text-xs font-bold">{t.batch_results_view_report}</button>
                                        </>
                                    )}
                                    {status === 'error' && (
                                        <p className="text-red-600 dark:text-red-400 text-xs" title={error}>{t.batch_results_error_message.replace('{error}', error || t.error_unexpected)}</p>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            {isBatchFinished && (
                <div className="mt-6 flex justify-end">
                    <button onClick={() => setIsProcessing(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold">Volver</button>
                </div>
            )}
        </div>
    );
  }

  return (
    <div className={`space-y-6 bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
            <h2 className="text-xl font-bold">{t.batch_title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.batch_description}</p>
        </div>
        <button
            onClick={handleEhrSync}
            disabled={isEhrSyncing}
            className="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
            {isEhrSyncing ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {t.batch_ehr_sync_loading}
                </>
            ) : (
                <>
                    <BoltIcon className="h-4 w-4 mr-2" />
                    {t.batch_ehr_sync_btn}
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
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
              }
          }}
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragOver ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'} border-dashed rounded-md transition-colors bg-slate-50 dark:bg-slate-900/40`}
        >
          <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-slate-400"/>
              <div className="flex text-sm text-slate-600 dark:text-slate-400">
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                      <span>{t.batch_upload_prompt.split(',')[1]}</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                  </label>
                  <p className="pl-1">{t.batch_upload_prompt.split(',')[0]}</p>
              </div>
              <p className="text-xs text-slate-500">CSV (Standard RFC 4180)</p>
          </div>
        </div>
        <div className="flex flex-col items-center mt-2 space-y-1">
            <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
                {t.batch_template_button}
            </button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 max-w-md">{t.batch_template_note}</p>
        </div>
      </div>
        
      {fileError && <p className="text-sm text-red-600 dark:text-red-400">{fileError}</p>}
      
      {patientData.length > 0 && (
          <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">{t.batch_preview_title}</h3>
              <p className="text-sm text-green-600 dark:text-green-400 font-bold">{t.batch_preview_patients_found.replace('{count}', patientData.length.toString())}</p>
              <div className="max-h-40 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <table className="min-w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                           <th className="py-2 px-3 text-left">patient_id</th>
                           <th className="py-2 px-3 text-left">medications</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {patientData.slice(0, 10).map((p, i) => (
                        <tr key={i}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">{p.patient_id}</td>
                            <td className="py-2 px-3 truncate max-w-xs text-slate-500 dark:text-slate-400">{p.medications}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                    type="button"
                    onClick={runAnalysis}
                    className="w-full sm:w-auto inline-flex justify-center items-center py-3 px-8 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform active:scale-95"
                >
                    {t.batch_run_analysis_button.replace('{count}', patientData.length.toString())}
                </button>
              </div>
          </div>
      )}

    </div>
  );
};

export default BatchAnalysis;
