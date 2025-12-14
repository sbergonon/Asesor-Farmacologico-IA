
import React, { useState, useRef } from 'react';
import type { InvestigatorResult, Medication } from '../types';
import { investigateSymptoms } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import DownloadIcon from './icons/DownloadIcon';
import ShareIcon from './icons/ShareIcon';
import { ApiKeyError } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvestigatorPanelProps {
  medications: Medication[];
  conditions: string;
  dateOfBirth: string;
  pharmacogenetics: string;
  t: any;
  lang: 'es' | 'en';
}

const InvestigatorPanel: React.FC<InvestigatorPanelProps> = ({ medications, conditions, dateOfBirth, pharmacogenetics, t, lang }) => {
  const [symptoms, setSymptoms] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InvestigatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleInvestigate = async () => {
    if (!symptoms.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
        const res = await investigateSymptoms(symptoms, medications, conditions, dateOfBirth, pharmacogenetics, lang);
        setResult(res);
    } catch (e: any) {
        if (e instanceof ApiKeyError) {
            setError(t.error_api_key_invalid);
        } else {
            setError(e.message || t.error_unexpected);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;

    // Build plain text summary
    const matchesSummary = result.matches.length > 0 
        ? result.matches.map(m => `- ${m.cause} (${m.probability}): ${m.mechanism}`).join('\n')
        : "Sin coincidencias directas.";

    const summaryText = [
        `🕵️‍♂️ ${t.investigator_title} - Informe`,
        `Síntoma: ${symptoms}`,
        '',
        'CAUSAS POTENCIALES:',
        matchesSummary,
        '',
        'Nota: Generado por IA. Consulte a un médico.',
    ].join('\n');

    const shareData = {
        title: 'Investigación Clínica',
        text: summaryText,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Share cancelled', err);
        }
    } else {
        // Fallback mailto
        const subject = encodeURIComponent("Informe de Investigación Clínica");
        const body = encodeURIComponent(summaryText);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);

    try {
        const canvas = await html2canvas(reportRef.current, {
            scale: 2, // High resolution
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const report = clonedDoc.getElementById('investigator-report-content');
                if (report) {
                    // Inject A4 print styles
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        #investigator-report-content {
                            width: 760px !important;
                            padding: 20px !important;
                            background: white !important;
                            color: #1e293b !important;
                            font-family: 'Inter', sans-serif !important;
                        }
                        * { color: #1e293b !important; }
                        h2, h3 { color: #2563eb !important; margin-bottom: 10px !important; }
                        p, li, td, th { font-size: 10px !important; }
                        table { border-collapse: collapse !important; width: 100% !important; margin-bottom: 15px !important; }
                        th { background-color: #f1f5f9 !important; text-transform: uppercase !important; font-size: 9px !important; }
                        td, th { padding: 8px !important; border-bottom: 1px solid #e2e8f0 !important; }
                        .risk-badge { padding: 2px 6px !important; font-size: 9px !important; border-radius: 4px !important; display: inline-block !important; }
                        .bg-red-100 { background-color: #fee2e2 !important; color: #991b1b !important; }
                        .bg-amber-100 { background-color: #fef3c7 !important; color: #92400e !important; }
                        .bg-blue-100 { background-color: #dbeafe !important; color: #1e40af !important; }
                        .prose { max-width: 100% !important; font-size: 10px !important; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const imgHeight = canvasHeight / ratio;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save('clinical_investigation_report.pdf');

    } catch (e) {
        console.error("PDF Export failed", e);
    } finally {
        setIsExportingPdf(false);
    }
  };

  const formattedText = (text: string) => {
    return text
    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n---\n/g, '<hr />')
    .replace(/\n/g, '<br />');
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 animate-fade-in">
        <div className="flex items-center mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg mr-3">
                <SparklesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.investigator_title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.investigator_subtitle}</p>
            </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wide">Contexto Clínico Activo</p>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <p><strong>Meds:</strong> {medications.length > 0 ? medications.map(m => m.name).join(', ') : 'Ninguno'}</p>
                <p><strong>Cond:</strong> {conditions || 'Ninguna'}</p>
                <p><strong>Genetics:</strong> {pharmacogenetics || 'N/A'}</p>
            </div>
            <p className="mt-2 text-xs text-slate-400 italic">{t.investigator_context_notice}</p>
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Síntomas Observados / Signos Clínicos</label>
                <textarea 
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder={t.investigator_input_placeholder}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px]"
                />
            </div>
            <button
                onClick={handleInvestigate}
                disabled={isLoading || !symptoms.trim()}
                className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analizando...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        {t.investigator_button}
                    </>
                )}
            </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center">
                <AlertTriangleIcon className="h-5 w-5 mr-2" />
                {error}
            </div>
        )}

        {result && (
            <div className="mt-8 space-y-6 animate-fade-in">
                {/* Printable Container */}
                <div ref={reportRef} id="investigator-report-content" className="space-y-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b pb-2">Informe de Investigación Clínica</h3>
                    
                    {/* Patient Context Summary for Print */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded text-xs text-slate-600 dark:text-slate-400">
                        <p><strong>Síntoma Reportado:</strong> {symptoms}</p>
                        <p><strong>Contexto:</strong> {medications.map(m => m.name).join(', ')} | {conditions}</p>
                    </div>

                    {result.matches.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 border-b border-indigo-100 dark:border-slate-700">
                                <h4 className="font-bold text-indigo-800 dark:text-indigo-200 text-sm">{t.investigator_results_title}</h4>
                            </div>
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.investigator_cause}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.investigator_mechanism}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t.investigator_probability}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {result.matches.map((match, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{match.cause}</td>
                                            <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{match.mechanism}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`risk-badge px-2 py-1 rounded-full text-xs font-bold 
                                                    ${match.probability.toLowerCase().includes('high') ? 'bg-red-100 text-red-800' : 
                                                    match.probability.toLowerCase().includes('medium') ? 'bg-amber-100 text-amber-800' : 
                                                    'bg-blue-100 text-blue-800'}`}>
                                                    {match.probability}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="prose prose-slate dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formattedText(result.analysisText) }}></div>
                    
                    {result.sources.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fuentes Consultadas</h4>
                            <ul className="space-y-1">
                                {result.sources.map((src, i) => (
                                    <li key={i}>
                                        <a href={src.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                            {src.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        onClick={handleShare}
                        className="inline-flex items-center justify-center py-2 px-4 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 w-full sm:w-auto"
                    >
                        <ShareIcon className="h-5 w-5 mr-2" />
                        Compartir / Email
                    </button>

                    <button
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                        className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-colors duration-200 w-full sm:w-auto"
                    >
                        {isExportingPdf ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t.export_pdf_loading}
                            </>
                        ) : (
                            <>
                                <DownloadIcon className="h-5 w-5 mr-2" />
                                {t.export_pdf_button}
                            </>
                        )}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default InvestigatorPanel;
