import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { analyzeInteractions } from '../services/geminiService';
import type { BatchPatientData, HistoryItem, Medication } from '../types';
import UploadIcon from './icons/UploadIcon';

interface BatchAnalysisProps {
  t: any;
  lang: 'es' | 'en';
  onViewResult: (item: HistoryItem) => void;
}

type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'error';
interface PatientStatus {
  data: BatchPatientData;
  status: AnalysisStatus;
  result?: HistoryItem;
  error?: string;
}

const BatchAnalysis: React.FC<BatchAnalysisProps> = ({ t, lang, onViewResult }) => {
  const [patientData, setPatientData] = useState<BatchPatientData[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<PatientStatus[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

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
    setAnalysisStatus(patientData.map(data => ({ data, status: 'pending' })));

    // Use a queue to process N items concurrently to avoid rate limiting
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
            
            // Save to local storage
            const savedHistory = localStorage.getItem('drugInteractionHistory') || '[]';
            const history = JSON.parse(savedHistory);
            history.unshift(historyItem);
            localStorage.setItem('drugInteractionHistory', JSON.stringify(history));

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

            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.batch_progress_patient_id}</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.batch_progress_status}</th>
                            <th scope="col" className="relative px-4 py-2"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                    {analysisStatus.map(({data, status, result, error}, index) => (
                        <tr key={index}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{data.patient_id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{renderStatusBadge(status)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                {status === 'completed' && result && (
                                    <button onClick={() => onViewResult(result)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200">{t.batch_results_view_report}</button>
                                )}
                                {status === 'error' && (
                                    <p className="text-red-600 dark:text-red-400 text-xs" title={error}>{t.batch_results_error_message.replace('{error}', error || t.error_unexpected)}</p>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  }

  return (
    <div className={`space-y-6 bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700`}>
      <div>
        <h2 className="text-xl font-bold">{t.batch_title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.batch_description}</p>
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
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragOver ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'} border-dashed rounded-md transition-colors`}
        >
          <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-slate-400"/>
              <div className="flex text-sm text-slate-600 dark:text-slate-400">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800/50 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>{t.batch_upload_prompt.split(',')[1]}</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                  </label>
                  <p className="pl-1">{t.batch_upload_prompt.split(',')[0]}</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">CSV only</p>
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
          <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t.batch_preview_title}</h3>
              <p className="text-sm text-green-600 dark:text-green-400">{t.batch_preview_patients_found.replace('{count}', patientData.length.toString())}</p>
              <div className="max-h-40 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                           <th className="py-2 px-3 text-left">patient_id</th>
                           <th className="py-2 px-3 text-left">medications</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {patientData.slice(0, 5).map((p, i) => (
                        <tr key={i}>
                            <td className="py-2 px-3">{p.patient_id}</td>
                            <td className="py-2 px-3 truncate max-w-xs">{p.medications}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                    type="button"
                    onClick={runAnalysis}
                    className="w-full sm:w-auto inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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