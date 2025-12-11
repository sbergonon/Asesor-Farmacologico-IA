
import React, { useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '../contexts/AuthContext';
import type { 
    AnalysisResult, 
    AnyInteraction,
    DrugDrugInteraction,
    DrugSubstanceInteraction,
    DrugAllergyAlert,
    DrugConditionContraindication,
    DrugPharmacogeneticContraindication,
    BeersCriteriaAlert
} from '../types';
import { translations } from '../lib/translations';
import DownloadIcon from './icons/DownloadIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ExportIcon from './icons/ExportIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CopyIcon from './icons/CopyIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import SummaryPanel from './SummaryPanel';
import AlertCircleIcon from './icons/AlertCircleIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import RestrictedFeatureWrapper from './RestrictedFeatureWrapper';

// Inlined Icons to avoid creating new files
const CogIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l-1.41-.513M5.106 17.785l1.15-.964m11.6-9.642l1.149-.964M12 4.5l.007.007m-.007 0l-.007.007m.007-.007l-.007-.007m.007.007l.007-.007m-7.007 7.007l-.007.007m.007 0l.007.007m-.007-.007l.007-.007m-.007.007l-.007-.007m7.007 7.007l.007.007m-.007 0l-.007.007m.007-.007l.007-.007m.007.007l-.007-.007" />
  </svg>
);

const ArrowPathIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-11.667-11.667l3.181 3.183m0 0h-4.992m4.992 0v-4.992" />
  </svg>
);


interface ResultDisplayProps {
  isLoading: boolean;
  analysisResult: AnalysisResult | null;
  t: (typeof translations)['en'] | (typeof translations)['es'];
}

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
      </div>
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
       <div className="space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
      </div>
    </div>
);

const getRiskDetails = (riskLevel: string) => {
  const lowerRisk = riskLevel.toLowerCase();
  
  if (lowerRisk.includes('crítico') || lowerRisk.includes('critical')) {
    return {
      Icon: AlertTriangleIcon,
      badgeClasses: 'bg-red-700 text-white',
    };
  }
  if (lowerRisk.includes('alto') || lowerRisk.includes('high')) {
    return {
      Icon: AlertTriangleIcon,
      badgeClasses: 'bg-red-500 text-white',
    };
  }
  if (lowerRisk.includes('moderado') || lowerRisk.includes('moderate')) {
    return {
      Icon: AlertCircleIcon,
      badgeClasses: 'bg-amber-500 text-white',
    };
  }
  if (lowerRisk.includes('bajo') || lowerRisk.includes('low')) {
    return {
      Icon: InfoCircleIcon,
      badgeClasses: 'bg-sky-500 text-white',
    };
  }
  // Default case
  return {
    Icon: InfoCircleIcon,
    badgeClasses: 'bg-slate-400 dark:bg-slate-600 text-white',
  };
};

const RiskBadge: React.FC<{ riskLevel: string }> = ({ riskLevel }) => {
  const { Icon, badgeClasses } = getRiskDetails(riskLevel);

  return (
    <span className={`risk-badge flex-shrink-0 inline-flex items-center gap-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${badgeClasses}`}>
      <Icon className="h-4 w-4" />
      {riskLevel}
    </span>
  );
};


type HighRiskItem = {
    type: string;
    description: string;
};

interface SectionProps {
  title: string;
  count: number;
  sectionKey: string;
  children?: React.ReactNode;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, analysisResult, t }) => {
  const { permissions } = useAuth();
  const resultRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCsv, setIsGeneratingCsv] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // CRITICAL FIX: useMemo MUST be called before any conditional return statements.
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

    allItems.forEach(item => {
      const risk = item.riskLevel;
      if (risk) {
        counts[risk] = (counts[risk] || 0) + 1;
      }
    });
    return counts;
  }, [analysisResult]);

  const handleToggleSection = (section: string) => {
      setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCopy = (textToCopy: string, itemId: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedItemId(itemId);
      setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleExportCsv = () => {
    if (!analysisResult) return;
    setIsGeneratingCsv(true);

    try {
        const escapeCsvField = (field: string | undefined | null): string => {
            if (field === null || field === undefined) return '""';
            const stringField = String(field).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return `"${stringField}"`;
        };

        const headers = [t.csv_type, t.csv_primary_item, t.csv_secondary_item, t.csv_risk_level, t.csv_clinical_summary, t.csv_details, t.csv_recommendations, t.csv_dosage_adjustment, t.csv_therapeutic_alternative, t.csv_references];
        const csvRows = [headers.join(',')];

        analysisResult.drugDrugInteractions.forEach(item => {
            const [medA, medB] = item.interaction.split(' + ');
            csvRows.push([
                escapeCsvField(t.interaction_drug_drug),
                escapeCsvField(medA),
                escapeCsvField(medB),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(item.potentialEffects),
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });

        analysisResult.drugSubstanceInteractions.forEach(item => {
            csvRows.push([
                escapeCsvField(t.interaction_drug_substance),
                escapeCsvField(item.medication),
                escapeCsvField(item.substance),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(item.potentialEffects),
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });
        
        analysisResult.drugAllergyAlerts.forEach(item => {
            csvRows.push([
                escapeCsvField(t.alert_allergy),
                escapeCsvField(item.medication),
                escapeCsvField(item.allergen),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(item.alertDetails),
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });

        analysisResult.drugConditionContraindications.forEach(item => {
            csvRows.push([
                escapeCsvField(t.contraindication_condition),
                escapeCsvField(item.medication),
                escapeCsvField(item.condition),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(item.contraindicationDetails),
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });

        analysisResult.drugPharmacogeneticContraindications.forEach(item => {
            const secondaryItem = item.variantAllele
                ? `${item.geneticFactor} (${item.variantAllele})`
                : item.geneticFactor;
            csvRows.push([
                escapeCsvField(t.contraindication_pharmacogenetic),
                escapeCsvField(item.medication),
                escapeCsvField(secondaryItem),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(item.implication),
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });

        analysisResult.beersCriteriaAlerts.forEach(item => {
            csvRows.push([
                escapeCsvField(t.alert_beers_criteria),
                escapeCsvField(item.medication),
                escapeCsvField(item.criteria),
                escapeCsvField(item.riskLevel),
                escapeCsvField(item.clinicalSummary),
                escapeCsvField(t.csv_na), // Details/Effects not applicable in the same way
                escapeCsvField(item.recommendations),
                escapeCsvField(item.dosageAdjustment),
                escapeCsvField(item.therapeuticAlternative),
                escapeCsvField(item.references),
            ].join(','));
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'drug_interaction_analysis.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch(error) {
        console.error("Error generating CSV:", error);
    } finally {
        setIsGeneratingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    const elementToCapture = resultRef.current;
    if (!elementToCapture) {
      return;
    }

    setIsGeneratingPdf(true);
    const originalExpandedState = { ...expandedSections };
    const originalFilter = activeFilter;
    
    try {
      // Expand all sections and clear filter to capture the full report
      setExpandedSections({
          drugDrug: true,
          drugSubstance: true,
          drugAllergy: true,
          drugCondition: true,
          drugPharmacogenetic: true,
          beersCriteria: true,
          sources: true,
      });
      setActiveFilter(null);

      // Give React more time to re-render the expanded sections
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // High resolution for text clarity
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff', // Force white background
        onclone: (clonedDoc) => {
            const report = clonedDoc.getElementById('analysis-report');
            if (report) {
                // --- OPTIMIZED A4 PRINT STYLES ---
                
                // Add a style block to override existing Tailwind classes more reliably
                const style = clonedDoc.createElement('style');
                style.innerHTML = `
                    #analysis-report {
                        width: 760px !important; /* Fixed width optimized for A4 */
                        padding: 20px !important;
                        background: white !important;
                        color: #1e293b !important;
                        font-family: 'Inter', sans-serif !important;
                    }
                    * {
                        color: #1e293b !important; /* Force dark text for readability */
                    }
                    /* Compact Typography */
                    h2 { font-size: 18px !important; margin-bottom: 8px !important; color: #2563eb !important; }
                    h3 { font-size: 14px !important; margin-bottom: 4px !important; font-weight: 700 !important; }
                    h4 { font-size: 11px !important; margin-bottom: 2px !important; font-weight: 700 !important; }
                    h5 { font-size: 9px !important; margin-bottom: 0px !important; text-transform: uppercase; color: #64748b !important; letter-spacing: 0.05em !important; margin-top: 4px !important; }
                    p, li, span, div { font-size: 9px !important; line-height: 1.25 !important; }
                    
                    /* Compact Spacing */
                    .space-y-6 > * + * { margin-top: 10px !important; } 
                    .space-y-4 > * + * { margin-top: 6px !important; }
                    .space-y-3 > * + * { margin-top: 4px !important; }
                    .p-4 { padding: 6px 10px !important; }
                    .mb-3 { margin-bottom: 4px !important; }
                    .pt-3 { padding-top: 4px !important; }
                    
                    /* Hide UI elements */
                    button { display: none !important; }
                    .summary-filters { display: none !important; } /* Hide filter chips */
                    
                    /* Adjust Visuals */
                    .risk-badge { transform: scale(0.9); }
                    svg { width: 10px !important; height: 10px !important; }
                    .border-t { border-top-width: 1px !important; border-color: #e2e8f0 !important; }
                    
                    /* Prose (Summary Text) */
                    .prose { font-size: 9px !important; max-width: 100% !important; }
                    .prose p { margin-bottom: 4px !important; }
                    .prose ul { margin-top: 0 !important; margin-bottom: 4px !important; }
                    .prose li { margin-top: 0 !important; margin-bottom: 0 !important; }
                `;
                clonedDoc.head.appendChild(style);

                // Manual cleanups if needed
                const h2 = report.querySelector('h2');
                if (h2) {
                    h2.style.backgroundImage = 'none';
                    h2.style.webkitBackgroundClip = 'initial';
                    h2.style.backgroundClip = 'initial';
                }
            }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85); // High quality JPEG
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit width perfectly
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / pdfWidth;
      const imgHeight = canvasHeight / ratio;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Subsequent pages
      while (heightLeft > 0) {
        position -= pdfHeight; // Move image up
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('drug_interaction_analysis.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
      setExpandedSections(originalExpandedState); // Restore original state
      setActiveFilter(originalFilter);
    }
  };
  
  if (isLoading) {
    return (
      <div className="mt-8 p-4 md:p-6 bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!analysisResult) {
    return null;
  }
  
  const filterByRisk = <T extends AnyInteraction>(items: T[] | undefined): T[] => {
    if (!items) return [];
    if (!activeFilter) return items;
    return items.filter(item => item.riskLevel === activeFilter);
  };
  
  const filteredDrugDrug = filterByRisk<DrugDrugInteraction>(analysisResult.drugDrugInteractions);
  const filteredDrugSubstance = filterByRisk<DrugSubstanceInteraction>(analysisResult.drugSubstanceInteractions);
  const filteredDrugAllergy = filterByRisk<DrugAllergyAlert>(analysisResult.drugAllergyAlerts);
  const filteredDrugCondition = filterByRisk<DrugConditionContraindication>(analysisResult.drugConditionContraindications);
  const filteredDrugPgx = filterByRisk<DrugPharmacogeneticContraindication>(analysisResult.drugPharmacogeneticContraindications);
  const filteredBeers = filterByRisk<BeersCriteriaAlert>(analysisResult.beersCriteriaAlerts);

  const Section = ({ title, count, sectionKey, children }: SectionProps) => {
    if (count === 0) return null;
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button
                onClick={() => handleToggleSection(sectionKey)}
                className="w-full flex justify-between items-center p-4 text-left bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-200"
                aria-expanded={expandedSections[sectionKey]}
                aria-controls={`section-content-${sectionKey}`}
            >
                <div className="flex items-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">{count}</span>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0 transform transition-transform duration-200 ${expandedSections[sectionKey] ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections[sectionKey] && (
                <div id={`section-content-${sectionKey}`} className="p-4 bg-white dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
  };
  
  const getHighRiskItems = (): HighRiskItem[] => {
    if (!analysisResult) return [];
    const items: HighRiskItem[] = [];
    const highRiskTerms = ['alto', 'high', 'crítico', 'critical'];
    
    analysisResult.drugDrugInteractions
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.interaction_drug_drug, description: i.interaction }));
        
    analysisResult.drugSubstanceInteractions
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.interaction_drug_substance, description: `${i.medication} + ${i.substance}` }));

    analysisResult.drugAllergyAlerts
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.alert_allergy, description: `${i.medication} (allergy to ${i.allergen})`}));

    analysisResult.drugConditionContraindications
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.contraindication_condition, description: `${i.medication} with ${i.condition}` }));

    analysisResult.drugPharmacogeneticContraindications
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.contraindication_pharmacogenetic, description: `${i.medication} (${i.geneticFactor})` }));
    
    analysisResult.beersCriteriaAlerts
        .filter(i => highRiskTerms.includes(i.riskLevel.toLowerCase()))
        .forEach(i => items.push({ type: t.alert_beers_criteria, description: `${i.medication} (${i.criteria})` }));

    return items;
  };

  const highRiskItems = getHighRiskItems();

  const formattedText = (text: string) => {
    let processedText = text;

    // Wrap lists in <ul>
    processedText = processedText.replace(/(\n\*   [^\n]+)+/g, (match) => {
        const items = match.trim().split('\n').map(item => 
            `<li>${item.replace(/^\*   /, '').trim()}</li>`
        ).join('');
        return `<ul>${items}</ul>`;
    });
    
    // Process other markdown elements
    return processedText
    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n---\n/g, '<hr />')
    .replace(/\n/g, '<br />')
    .replace(/<br \/>(\s*<(?:h3|ul|hr)>)/g, '$1') 
    .replace(/(<\/(?:h3|ul|li)>)\s*<br \/>/g, '$1')
    .replace(/<hr \/>\s*<br \/>/g, '<hr />');
  }
  
  const criticalSummaryMatch = analysisResult.analysisText.match(new RegExp(`### ${t.prompt.criticalSummaryTitle}([\\s\\S]*?)(?=### \\d\\.|\\n---|$)`));
  const criticalSummary = criticalSummaryMatch ? `### ${t.prompt.criticalSummaryTitle}\n${criticalSummaryMatch[1].trim()}` : analysisResult.analysisText.split(/### \d\.|\n---/)[0];

  return (
    <>
      <div className="mt-8">
        <div ref={resultRef} id="analysis-report" className="p-4 md:p-6 bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">{t.results_title}</h2>

            <div className="summary-filters">
                <SummaryPanel
                counts={summaryCounts}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                t={t}
                />
            </div>

            {highRiskItems.length > 0 && !activeFilter && (
              <div className="p-4 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-r-lg" role="alert">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangleIcon className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-bold">{t.results_high_risk_alert_title}</h3>
                    <div className="mt-2 text-sm">
                      <p>{t.results_high_risk_alert_intro}</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        {highRiskItems.map((item, index) => (
                          <li key={index}>
                            <strong>{item.type}:</strong> {item.description}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 font-semibold">
                        {t.results_high_risk_alert_advice}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {!activeFilter && (
                <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formattedText(criticalSummary) }}></div>
            )}

            <Section title={t.section_drug_drug} count={filteredDrugDrug.length} sectionKey="drugDrug">
                {filteredDrugDrug.map((item, index) => {
                    const itemId = `drugDrug-${index}`;
                    const textToCopy = [
                        `${t.results_interaction}: ${item.interaction}`,
                        `${t.results_risk_level}: ${item.riskLevel}`,
                        item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                        `${t.results_potential_effects}: ${item.potentialEffects}`,
                        `${t.results_recommendations}: ${item.recommendations}`,
                        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                        item.references ? `${t.results_references}: ${item.references}` : ''
                    ].filter(Boolean).join('\n');

                    return (
                        <div key={index} className="relative p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.interaction}</h4>
                                <RiskBadge riskLevel={item.riskLevel} />
                            </div>
                            
                            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                {item.clinicalSummary && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                    </div>
                                )}
                                {item.potentialEffects && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_potential_effects}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.potentialEffects}</p>
                                    </div>
                                )}
                                {item.recommendations && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                    </div>
                                )}
                                {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                        {item.dosageAdjustment && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_dosage_adjustment}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                            </div>
                                        )}
                                        {item.therapeuticAlternative && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_therapeutic_alternative}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.references && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => handleCopy(textToCopy, itemId)}
                                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                aria-label={t.copy_button_aria_label}
                            >
                                {copiedItemId === itemId ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                    <CopyIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </Section>

            <Section title={t.section_drug_substance} count={filteredDrugSubstance.length} sectionKey="drugSubstance">
                {filteredDrugSubstance.map((item, index) => {
                    const itemId = `drugSubstance-${index}`;
                    const textToCopy = [
                        `${t.results_interaction}: ${item.medication} + ${item.substance}`,
                        `${t.results_risk_level}: ${item.riskLevel}`,
                        item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                        `${t.results_potential_effects}: ${item.potentialEffects}`,
                        `${t.results_recommendations}: ${item.recommendations}`,
                        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                        item.references ? `${t.results_references}: ${item.references}` : ''
                    ].filter(Boolean).join('\n');

                    return (
                         <div key={index} className="relative p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.medication} + {item.substance}</h4>
                                <RiskBadge riskLevel={item.riskLevel} />
                            </div>
                            
                            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                {item.clinicalSummary && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                    </div>
                                )}
                                {item.potentialEffects && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_potential_effects}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.potentialEffects}</p>
                                    </div>
                                )}
                                {item.recommendations && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                    </div>
                                )}
                                {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                        {item.dosageAdjustment && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_dosage_adjustment}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                            </div>
                                        )}
                                        {item.therapeuticAlternative && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_therapeutic_alternative}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.references && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => handleCopy(textToCopy, itemId)}
                                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                aria-label={t.copy_button_aria_label}
                            >
                                {copiedItemId === itemId ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                    <CopyIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </Section>

            <Section title={t.section_drug_allergy} count={filteredDrugAllergy.length} sectionKey="drugAllergy">
                {filteredDrugAllergy.map((item, index) => {
                    const itemId = `drugAllergy-${index}`;
                    const textToCopy = [
                        `${t.results_medication}: ${item.medication}`,
                        `${t.results_allergen}: ${item.allergen}`,
                        `${t.results_risk_level}: ${item.riskLevel}`,
                        item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                        `${t.results_alert_details}: ${item.alertDetails}`,
                        `${t.results_recommendations}: ${item.recommendations}`,
                        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                        item.references ? `${t.results_references}: ${item.references}` : ''
                    ].filter(Boolean).join('\n');

                    return (
                        <div key={index} className="relative p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.medication}</h4>
                                <RiskBadge riskLevel={item.riskLevel} />
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">{t.results_allergen}: <span className="font-bold">{item.allergen}</span></p>
                            
                            <div className="space-y-4 pt-3 border-t border-red-200 dark:border-red-700">
                                {item.clinicalSummary && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                    </div>
                                )}
                                {item.alertDetails && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_alert_details}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.alertDetails}</p>
                                    </div>
                                )}
                                {item.recommendations && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                    </div>
                                )}
                                {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                        {item.dosageAdjustment && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_dosage_adjustment}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                            </div>
                                        )}
                                        {item.therapeuticAlternative && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_therapeutic_alternative}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.references && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => handleCopy(textToCopy, itemId)}
                                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                aria-label={t.copy_button_aria_label}
                            >
                                {copiedItemId === itemId ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                    <CopyIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </Section>


            <Section title={t.section_drug_condition} count={filteredDrugCondition.length} sectionKey="drugCondition">
                {filteredDrugCondition.map((item, index) => {
                     const itemId = `drugCondition-${index}`;
                     const textToCopy = [
                         `${t.results_contraindication}: ${item.medication} with ${item.condition}`,
                         `${t.results_risk_level}: ${item.riskLevel}`,
                         item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                         `${t.results_details}: ${item.contraindicationDetails}`,
                         `${t.results_recommendations}: ${item.recommendations}`,
                         item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                         item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                         item.references ? `${t.results_references}: ${item.references}` : ''
                     ].filter(Boolean).join('\n');

                    return (
                        <div key={index} className="relative p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.medication}</h4>
                                <RiskBadge riskLevel={item.riskLevel} />
                            </div>
                             <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">Contraindicated with: <span className="font-bold">{item.condition}</span></p>

                            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                {item.clinicalSummary && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                    </div>
                                )}
                                {item.contraindicationDetails && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_details}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.contraindicationDetails}</p>
                                    </div>
                                )}
                                {item.recommendations && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                        <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                    </div>
                                )}
                                {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                        {item.dosageAdjustment && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_dosage_adjustment}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                            </div>
                                        )}
                                        {item.therapeuticAlternative && (
                                            <div>
                                                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                    <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {t.results_therapeutic_alternative}
                                                </h5>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.references && (
                                    <div>
                                        <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => handleCopy(textToCopy, itemId)}
                                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                aria-label={t.copy_button_aria_label}
                            >
                                {copiedItemId === itemId ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                    <CopyIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </Section>
            
            <Section title={t.section_drug_pharmacogenetic} count={filteredDrugPgx.length} sectionKey="drugPharmacogenetic">
                {filteredDrugPgx.map((item, index) => {
                    const itemId = `drugPgx-${index}`;
                    const textToCopy = [
                        `${t.results_medication}: ${item.medication}`,
                        `${t.results_genetic_factor}: ${item.geneticFactor}`,
                        item.variantAllele ? `${t.results_genetic_variant}: ${item.variantAllele}`: '',
                        `${t.results_risk_level}: ${item.riskLevel}`,
                        item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                        `${t.results_implication}: ${item.implication}`,
                        `${t.results_recommendations}: ${item.recommendations}`,
                        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                        item.references ? `${t.results_references}: ${item.references}` : ''
                    ].filter(Boolean).join('\n');
                    
                    return (
                     <div key={index} className="relative p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                            <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.medication}</h4>
                            <RiskBadge riskLevel={item.riskLevel} />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">{t.results_genetic_factor}: <span className="font-bold">{item.geneticFactor} {item.variantAllele ? `(${item.variantAllele})` : ''}</span></p>

                        <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                            {item.clinicalSummary && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                </div>
                            )}
                            {item.implication && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_implication}</h5>
                                    <p className="text-sm text-slate-700 dark:text-slate-400">{item.implication}</p>
                                </div>
                            )}
                            {item.recommendations && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                    <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                </div>
                            )}
                            {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                    {item.dosageAdjustment && (
                                        <div>
                                            <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {t.results_dosage_adjustment}
                                            </h5>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                        </div>
                                    )}
                                    {item.therapeuticAlternative && (
                                        <div>
                                            <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {t.results_therapeutic_alternative}
                                            </h5>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {item.references && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                </div>
                            )}
                        </div>
                        
                        <button
                            onClick={() => handleCopy(textToCopy, itemId)}
                            className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            aria-label={t.copy_button_aria_label}
                        >
                            {copiedItemId === itemId ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            ) : (
                                <CopyIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    );
                })}
            </Section>

            <Section title={t.section_beers_criteria} count={filteredBeers.length} sectionKey="beersCriteria">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300">{t.beers_criteria_explanation_title}</h4>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {t.beers_criteria_explanation_text}
                    </p>
                </div>
                {filteredBeers.map((item, index) => {
                    const itemId = `beers-${index}`;
                    const textToCopy = [
                        `${t.results_medication}: ${item.medication}`,
                        `${t.results_risk_level}: ${item.riskLevel}`,
                        item.clinicalSummary ? `${t.results_clinical_summary}: ${item.clinicalSummary}` : '',
                        `${t.results_criteria_reason}: ${item.criteria}`,
                        `${t.results_recommendations}: ${item.recommendations}`,
                        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}`: '',
                        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}`: '',
                        item.references ? `${t.results_references}: ${item.references}` : ''
                    ].filter(Boolean).join('\n');

                    return (
                     <div key={index} className="relative p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                            <h4 className="text-md font-bold text-slate-800 dark:text-slate-100">{item.medication}</h4>
                            <RiskBadge riskLevel={item.riskLevel} />
                        </div>
                        
                        <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                            {item.clinicalSummary && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_clinical_summary}</h5>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.clinicalSummary}</p>
                                </div>
                            )}
                            {item.criteria && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_criteria_reason}</h5>
                                    <p className="text-sm text-slate-700 dark:text-slate-400">{item.criteria}</p>
                                </div>
                            )}
                            {item.recommendations && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_recommendations}</h5>
                                    <p className="text-sm text-slate-700 dark:text-slate-400">{item.recommendations}</p>
                                </div>
                            )}
                             {(item.dosageAdjustment || item.therapeuticAlternative) && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
                                    {item.dosageAdjustment && (
                                        <div>
                                            <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {t.results_dosage_adjustment}
                                            </h5>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.dosageAdjustment}</p>
                                        </div>
                                    )}
                                    {item.therapeuticAlternative && (
                                        <div>
                                            <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                                <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {t.results_therapeutic_alternative}
                                            </h5>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{item.therapeuticAlternative}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {item.references && (
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{item.references}</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handleCopy(textToCopy, itemId)}
                            className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            aria-label={t.copy_button_aria_label}
                        >
                            {copiedItemId === itemId ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            ) : (
                                <CopyIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    );
                })}
            </Section>


            {analysisResult.sources.length > 0 && !activeFilter && (
                <div className="pt-6">
                    <Section title={t.section_sources} count={analysisResult.sources.length} sectionKey="sources">
                        <ul className="space-y-3">
                            {analysisResult.sources.map((source, index) => (
                                <li key={index} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0 pb-3">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {source.summary || 'No summary available.'}
                                    </p>
                                    <a 
                                        href={source.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1"
                                    >
                                        {t.results_visit_source}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Section>
                </div>
            )}
        </div>
      </div>
      <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <RestrictedFeatureWrapper 
             isAllowed={permissions.canExportData} 
             message="Exportar datos a CSV es una función exclusiva para profesionales."
          >
              <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={isGeneratingCsv}
                  className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors duration-200 w-full sm:w-auto"
              >
                  {isGeneratingCsv ? (
                      <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t.export_csv_loading}
                      </>
                  ) : (
                      <>
                          <ExportIcon className="h-5 w-5 mr-2" />
                          {t.export_csv_button}
                      </>
                  )}
              </button>
          </RestrictedFeatureWrapper>

          <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-colors duration-200"
          >
              {isGeneratingPdf ? (
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
    </>
  );
};

export default ResultDisplay;
