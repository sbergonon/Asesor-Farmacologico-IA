
import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { 
    AnalysisResult, 
    AnyInteraction,
    Medication
} from '../types';
import { translations } from '../lib/translations';
import DownloadIcon from './icons/DownloadIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ShareIcon from './icons/ShareIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import SummaryPanel from './SummaryPanel';
import { generateClinicalPDF } from '../lib/pdfGenerator';
import { 
  DrugDrugList, 
  DrugSubstanceList, 
  DrugAllergyList, 
  DrugConditionList, 
  DrugPgxList, 
  BeersCriteriaList 
} from './InteractionSections';

interface ResultDisplayProps {
  isLoading: boolean;
  analysisResult: AnalysisResult | null;
  medications: Medication[];
  patientId: string;
  dob: string;
  conditions: string;
  t: (typeof translations)['en'] | (typeof translations)['es'];
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, analysisResult, medications, patientId, dob, conditions, t }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drugDrug: true, drugSubstance: true, drugAllergy: true, drugCondition: true, drugPharmacogenetic: true, beersCriteria: true
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const summaryCounts = useMemo(() => {
    if (!analysisResult) return {};
    const counts: Record<string, number> = {};
    const allItems: AnyInteraction[] = [
      ...(analysisResult.drugDrugInteractions || []),
      ...(analysisResult.drugSubstanceInteractions || []),
      ...(analysisResult.drugAllergyAlerts || []),
      ...(analysisResult.drugConditionContraindications || []),
      ...(analysisResult.drugPharmacogeneticContraindications || []),
      ...(analysisResult.beersCriteriaAlerts || []),
    ];
    allItems.forEach(item => { if (item.riskLevel) counts[item.riskLevel] = (counts[item.riskLevel] || 0) + 1; });
    return counts;
  }, [analysisResult]);

  const handleExportPDF = async () => {
    if (!analysisResult) return;
    setIsExportingPdf(true);
    try {
      generateClinicalPDF('interaction', analysisResult, t, { id: patientId, medications, dob, conditions });
    } finally { setIsExportingPdf(false); }
  };

  const handleWhatsAppShare = () => {
    if (!analysisResult) return;
    const patientName = patientId || 'No especificado';
    const medsHeader = medications.length > 0 ? `*MEDICACIÓN:*%0A${medications.map(m => `• ${m.name}`).join('%0A')}` : '';
    
    const critico = [...analysisResult.drugDrugInteractions, ...analysisResult.drugAllergyAlerts, ...analysisResult.drugConditionContraindications]
        .filter(i => i.riskLevel.toLowerCase().includes('crít') || i.riskLevel.toLowerCase().includes('crit'));
    
    const riskText = critico.length > 0 
        ? `%0A%0A⚠️ *RIESGOS CRÍTICOS:*%0A${critico.map(r => `- ${(r as any).interaction || r.medication}`).join('%0A')}`
        : '%0A%0A✅ Sin riesgos críticos detectados.';

    const message = `*INFORME IA:* ${patientName}%0A${medsHeader}${riskText}%0A%0A_Generado por Asesor Farmacológico IA_`;
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const formattedText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mt-5 mb-2 border-b pb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 mt-6 mb-3">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 dark:text-white">$1</strong>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc mb-1 text-sm">$1</li>')
      .replace(/\n/g, '<br />');
  };

  if (isLoading) return <div className="mt-8 p-4 bg-white dark:bg-slate-800 rounded-2xl animate-pulse space-y-4 shadow-lg border border-slate-200 dark:border-slate-700">
    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
    <div className="h-20 bg-slate-100 dark:bg-slate-700 rounded"></div>
  </div>;
  if (!analysisResult) return null;

  const filterItems = (items: any[]) => activeFilter ? items.filter(i => i.riskLevel === activeFilter) : items;

  return (
    <div className="mt-6 space-y-4 md:space-y-6">
      <div className="p-4 md:p-8 bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t.results_title}</h2>
            <div className="flex gap-2 w-full sm:w-auto">
                <button 
                    onClick={handleWhatsAppShare} 
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group"
                >
                    <ShareIcon className="h-5 w-5" />
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider">WhatsApp</span>
                </button>
                <button 
                    onClick={handleExportPDF} 
                    disabled={isExportingPdf} 
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                    {isExportingPdf ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <DownloadIcon className="h-5 w-5" />}
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider">PDF</span>
                </button>
            </div>
          </div>

          <SummaryPanel counts={summaryCounts} activeFilter={activeFilter} onFilterChange={setActiveFilter} t={t} />

          <div className="grid gap-3 md:gap-4">
            <Section title={t.section_drug_drug} count={filterItems(analysisResult.drugDrugInteractions).length} sectionKey="drugDrug" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <DrugDrugList items={filterItems(analysisResult.drugDrugInteractions)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>

            <Section title={t.section_drug_substance} count={filterItems(analysisResult.drugSubstanceInteractions).length} sectionKey="drugSubstance" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <DrugSubstanceList items={filterItems(analysisResult.drugSubstanceInteractions)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>

            <Section title={t.section_drug_allergy} count={filterItems(analysisResult.drugAllergyAlerts).length} sectionKey="drugAllergy" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <DrugAllergyList items={filterItems(analysisResult.drugAllergyAlerts)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>

            <Section title={t.section_drug_condition} count={filterItems(analysisResult.drugConditionContraindications).length} sectionKey="drugCondition" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <DrugConditionList items={filterItems(analysisResult.drugConditionContraindications)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>

            <Section title={t.section_drug_pharmacogenetic} count={filterItems(analysisResult.drugPharmacogeneticContraindications).length} sectionKey="drugPharmacogenetic" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <DrugPgxList items={filterItems(analysisResult.drugPharmacogeneticContraindications)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>

            <Section title={t.section_beers_criteria} count={filterItems(analysisResult.beersCriteriaAlerts).length} sectionKey="beersCriteria" expandedSections={expandedSections} onToggle={(k) => setExpandedSections(p => ({...p, [k]: !p[k]}))}>
                <BeersCriteriaList items={filterItems(analysisResult.beersCriteriaAlerts)} t={t} onCopy={(txt, id) => { navigator.clipboard.writeText(txt); setCopiedItemId(id); setTimeout(() => setCopiedItemId(null), 2000); }} copiedId={copiedItemId} />
            </Section>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-3 flex items-center text-slate-800 dark:text-slate-100"><InfoCircleIcon className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" /> Informe Clínico IA</h3>
            <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: formattedText(analysisResult.analysisText) }}></div>
          </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; count: number; sectionKey: string; expandedSections: Record<string, boolean>; onToggle: (k: string) => void; children: React.ReactNode }> = ({ title, count, sectionKey, expandedSections, onToggle, children }) => {
  if (count === 0) return null;
  const isExpanded = expandedSections[sectionKey];
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
      <button onClick={() => onToggle(sectionKey)} className="w-full flex justify-between items-center p-3 md:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
        <div className="flex items-center space-x-2">
          <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</h3>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded-full">{count}</span>
        </div>
        <ChevronDownIcon className={`h-4 w-4 md:h-5 md:w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && <div className="p-3 md:p-4 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in overflow-x-auto">{children}</div>}
    </div>
  );
};

export default ResultDisplay;
