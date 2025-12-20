
import React, { useState, useRef } from 'react';
import type { InvestigatorResult, Medication } from '../types';
import { investigateSymptoms } from '../services/geminiService';
import { generateClinicalPDF } from '../lib/pdfGenerator';
import SparklesIcon from './icons/SparklesIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import DownloadIcon from './icons/DownloadIcon';
import GlobeAltIcon from './icons/GlobeAltIcon';
import BatchInvestigator from './BatchInvestigator';

interface InvestigatorPanelProps {
  medications: Medication[];
  conditions: string;
  dateOfBirth: string;
  pharmacogenetics: string;
  allergies?: string;
  t: any;
  lang: 'es' | 'en';
}

const InvestigatorPanel: React.FC<InvestigatorPanelProps> = ({ medications, conditions, dateOfBirth, pharmacogenetics, allergies, t, lang }) => {
  const [mode, setMode] = useState<'individual' | 'batch'>('individual');
  const [symptoms, setSymptoms] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<InvestigatorResult | null>(null);

  const handleInvestigate = async () => {
    if (!symptoms.trim()) return;
    setIsLoading(true);
    try {
        const res = await investigateSymptoms(symptoms, medications, conditions, dateOfBirth, pharmacogenetics, allergies || '', lang);
        setResult(res);
    } finally { setIsLoading(false); }
  };

  const handleExportPDF = async () => {
    if (!result) return;
    setIsExporting(true);
    try {
      generateClinicalPDF('investigator', result, t, { id: symptoms, medications, dob: dateOfBirth, conditions, allergies: allergies || '' });
    } finally { setIsExporting(false); }
  };

  const formattedText = (text: string) => {
    if (!text) return "";
    let cleanText = text.replace(/PARTE [1-2]:/gi, '').replace(/INFORME TÉCNICO:/gi, '').replace(/TECHNICAL REPORT:/gi, '').trim();
    return cleanText
      .replace(/^### (.*$)/gim, '<h3 class="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-2 border-b pb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-8 mb-4">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-700 dark:text-indigo-300">$1</strong>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc mb-1 text-sm md:text-base">$1</li>')
      .replace(/\n/g, '<br />');
  };

  const emptyLabel = lang === 'es' ? 'Ninguno/a' : 'None';
  const naLabel = lang === 'es' ? 'No disponible' : 'N/A';

  return (
    <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <SparklesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.investigator_title}</h2>
                    <p className="text-[10px] md:text-xs text-slate-500">{t.investigator_subtitle}</p>
                </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg shadow-inner w-full sm:w-auto">
                <button onClick={() => setMode('individual')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'individual' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{t.mode_individual}</button>
                <button onClick={() => setMode('batch')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'batch' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{t.mode_batch}</button>
            </div>
        </div>

        <div className="mb-6 p-4 md:p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center">
                <InfoCircleIcon className="h-3 w-3 mr-1.5" /> {t.investigator_context_title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-y-6 md:gap-x-8">
                <div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{t.investigator_treatment_label}</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{medications.length > 0 ? medications.map(m => m.name).join(', ') : emptyLabel}</p>
                </div>
                <div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{t.investigator_diagnosis_label}</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{conditions || naLabel}</p>
                </div>
                <div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{t.investigator_allergy_label}</span>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-0.5">{allergies || emptyLabel}</p>
                </div>
                <div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{t.investigator_age_label}</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{dateOfBirth || naLabel}</p>
                </div>
                <div className="sm:col-span-2">
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{t.investigator_pgx_label}</span>
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">{pharmacogenetics || naLabel}</p>
                </div>
            </div>
        </div>

        {mode === 'batch' ? <BatchInvestigator t={t} lang={lang} onViewResult={() => {}} /> : (
            <div className="space-y-6">
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <label className="block text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-wide">Observación Clínica / Síntoma a Investigar</label>
                    <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder={t.investigator_input_placeholder} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px] text-sm font-medium" />
                </div>
                <button onClick={handleInvestigate} disabled={isLoading || !symptoms.trim()} className="w-full py-3 md:py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center tracking-widest uppercase text-[10px] md:text-xs">
                    {isLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> : <SparklesIcon className="h-5 w-5 mr-2" />}
                    {isLoading ? t.investigator_reasoning_btn : t.investigator_button}
                </button>

                {result && (
                    <div className="mt-6 md:mt-8 space-y-6 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 md:space-y-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <h3 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white">{t.investigator_causality_analysis}</h3>
                                <button onClick={handleExportPDF} disabled={isExporting} className="w-full sm:w-auto p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                    {isExporting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <DownloadIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                                </button>
                            </div>
                            
                            {result.matches.length > 0 && (
                                <div className="grid gap-3">
                                    {result.matches.map((match, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border-l-4 border-l-indigo-500 flex flex-col sm:flex-row justify-between items-start gap-3 transition-all shadow-sm">
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">{match.cause}</h4>
                                                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{match.mechanism}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase h-fit shadow-sm whitespace-nowrap ${match.probability.toLowerCase().includes('high') || match.probability.toLowerCase().includes('alta') ? 'bg-red-100 text-red-700' : match.probability.toLowerCase().includes('medium') || match.probability.toLowerCase().includes('media') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{match.probability}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-[10px] md:text-sm font-bold uppercase text-slate-400 mb-4 flex items-center">
                                    <InfoCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" /> {t.investigator_technical_justification}
                                </h4>
                                <div className="prose prose-indigo dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: formattedText(result.analysisText) }}></div>
                            </div>

                            {/* Added rendering of bibliography sources extracted via Google Search grounding */}
                            {result.sources && result.sources.length > 0 && (
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <h4 className="text-[10px] md:text-sm font-bold uppercase text-slate-400 mb-4 flex items-center">
                                        <GlobeAltIcon className="h-4 w-4 mr-2 flex-shrink-0" /> {t.section_sources}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {result.sources.map((source, idx) => (
                                            <a
                                                key={idx}
                                                href={source.uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                            >
                                                <span className="truncate max-w-[200px]">{source.title}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default InvestigatorPanel;
