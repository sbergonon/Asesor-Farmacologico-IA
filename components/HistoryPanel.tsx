import React, { useState } from 'react';
import type { HistoryItem } from '../types';
import HistoryIcon from './icons/HistoryIcon';
import TrashIcon from './icons/TrashIcon';
import ExportIcon from './icons/ExportIcon';

interface HistoryPanelProps {
  history: HistoryItem[];
  onLoadHistory: (id: string) => void;
  onClearHistory: () => void;
  t: any;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoadHistory, onClearHistory, t }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = () => {
    if (!history.length) return;
    setIsExporting(true);

    try {
        const escapeCsvField = (field: string | undefined | null): string => {
            if (field === null || field === undefined) return '""';
            const stringField = String(field).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return `"${stringField}"`;
        };

        const headers = [
            t.csv_history_date,
            t.csv_history_time,
            t.csv_history_patient_id,
            t.csv_history_medications,
            t.csv_history_summary
        ];
        const csvRows = [headers.join(',')];

        history.forEach(item => {
            const analysisDate = new Date(item.id);
            const formattedDate = analysisDate.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
            const formattedTime = analysisDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const medsString = item.medications.map(med => med.name).join('; ');

            const { analysisResult } = item;
            const summaryParts: string[] = [];
            if (analysisResult.drugDrugInteractions?.length > 0) summaryParts.push(`${analysisResult.drugDrugInteractions.length} ${t.summary_type_d_d}`);
            if (analysisResult.drugSubstanceInteractions?.length > 0) summaryParts.push(`${analysisResult.drugSubstanceInteractions.length} ${t.summary_type_d_s}`);
            if (analysisResult.drugConditionContraindications?.length > 0) summaryParts.push(`${analysisResult.drugConditionContraindications.length} ${t.summary_type_d_c}`);
            if (analysisResult.drugPharmacogeneticContraindications?.length > 0) summaryParts.push(`${analysisResult.drugPharmacogeneticContraindications.length} ${t.summary_type_d_p}`);
            if (analysisResult.beersCriteriaAlerts?.length > 0) summaryParts.push(`${analysisResult.beersCriteriaAlerts.length} ${t.summary_type_beers}`);
            const summary = summaryParts.length > 0 ? summaryParts.join(', ') : t.summary_no_findings;

            csvRows.push([
                escapeCsvField(formattedDate),
                escapeCsvField(formattedTime),
                escapeCsvField(item.patientId || 'N/A'),
                escapeCsvField(medsString),
                escapeCsvField(summary),
            ].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'analysis_history.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error generating history CSV:", error);
    } finally {
        setIsExporting(false);
    }
  };


  return (
    <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 h-full">
      <div className="flex items-center mb-4">
        <HistoryIcon className="h-6 w-6 mr-3 text-blue-500" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.history_title}</h2>
      </div>
      
      {history.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {history.map((item) => {
            const analysisDate = new Date(item.id);
            const formattedDate = analysisDate.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const formattedTime = analysisDate.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });
            
            return (
              <button
                key={item.id}
                onClick={() => onLoadHistory(item.id)}
                className="w-full text-left p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                {item.patientId && (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    ID: {item.patientId}
                  </p>
                )}
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {item.medications.map(m => m.name).join(', ')}
                </p>
                <div className="flex justify-between items-center mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formattedDate}</span>
                  <span>{formattedTime}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          {t.history_empty}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors duration-200"
            >
                {isExporting ? (
                  <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.export_csv_loading}
                  </>
              ) : (
                  <>
                    <ExportIcon className="h-4 w-4 mr-2" />
                    {t.history_export_csv_button}
                  </>
              )}
            </button>
            <button
                type="button"
                onClick={onClearHistory}
                className="w-full inline-flex justify-center items-center py-2 px-4 border border-red-300 dark:border-red-700 rounded-md shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
            >
                <TrashIcon className="h-4 w-4 mr-2" />
                {t.history_clear_button}
            </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;