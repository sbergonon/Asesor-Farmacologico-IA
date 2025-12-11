
import React, { useMemo, useState, useRef } from 'react';
import type { HistoryItem, AnyInteraction } from '../types';
import ChartBarIcon from './icons/ChartBarIcon';
import AlertTriangleIcon from './icons-v2/AlertTriangleIcon';
import ClipboardListIcon from './icons-v2/ClipboardListIcon';
import PresentationChartLineIcon from './icons-v2/PresentationChartLineIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import DownloadIcon from './icons/DownloadIcon';
import ExportIcon from './icons/ExportIcon';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DashboardPanelProps {
  history: HistoryItem[];
  t: any;
}

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md flex items-center space-x-4 border border-slate-200 dark:border-slate-700">
        <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    </div>
);

const BarChart: React.FC<{ data: { label: string; value: number }[]; title: string; t: any }> = ({ data, title, t }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const riskOrder = ['Crítico', 'Critical', 'Alto', 'High', 'Moderado', 'Moderate', 'Bajo', 'Low'];

    const getRiskColorClass = (label: string) => {
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('crítico') || lowerLabel.includes('critical')) return 'bg-red-700';
        if (lowerLabel.includes('alto') || lowerLabel.includes('high')) return 'bg-red-500';
        if (lowerLabel.includes('moderado') || lowerLabel.includes('moderate')) return 'bg-amber-500';
        if (lowerLabel.includes('bajo') || lowerLabel.includes('low')) return 'bg-sky-500';
        return 'bg-slate-500';
    };
    
    const sortedData = [...data].sort((a, b) => {
        if (title === t.dashboard_risk_distribution) {
            const indexA = riskOrder.indexOf(a.label);
            const indexB = riskOrder.indexOf(b.label);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        }
        return b.value - a.value;
    });

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
            <h3 className="text-md font-semibold text-slate-800 dark:text-slate-200 mb-4">{title}</h3>
            <div className="space-y-3">
                {sortedData.map(({ label, value }) => (
                    <div key={label} className="flex items-center">
                        <div className="w-1/3 text-sm font-medium text-slate-600 dark:text-slate-300 truncate pr-2" title={label}>{label}</div>
                        <div className="w-2/3 flex items-center">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-5 mr-2">
                                <div
                                    className={`h-5 rounded-full ${getRiskColorClass(label)}`}
                                    style={{ width: maxValue > 0 ? `${(value / maxValue) * 100}%` : '0%' }}
                                />
                            </div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const DashboardPanel: React.FC<DashboardPanelProps> = ({ history, t }) => {
  const [subTab, setSubTab] = useState<'analysis' | 'patients'>('analysis');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- Logic for Analysis View (Existing logic) ---
  const analysisStats = useMemo(() => {
    if (!history || history.length === 0) return null;
    
    let totalFindings = 0;
    let highRiskFindings = 0;
    const riskLevelCounts: Record<string, number> = {};
    const medicationFrequency: Record<string, number> = {};
    const interactionTypeCounts: Record<string, number> = {};
    const specificInteractionCounts: Record<string, number> = {};
    
    const highRiskTerms = ['alto', 'high', 'crítico', 'critical'];

    history.forEach(item => {
        const allFindings: AnyInteraction[] = [
            ...(item.analysisResult.drugDrugInteractions || []),
            ...(item.analysisResult.drugSubstanceInteractions || []),
            ...(item.analysisResult.drugAllergyAlerts || []),
            ...(item.analysisResult.drugConditionContraindications || []),
            ...(item.analysisResult.drugPharmacogeneticContraindications || []),
            ...(item.analysisResult.beersCriteriaAlerts || []),
        ];
        
        totalFindings += allFindings.length;
        
        allFindings.forEach(finding => {
            // Risk level count
            const risk = finding.riskLevel || 'Unknown';
            riskLevelCounts[risk] = (riskLevelCounts[risk] || 0) + 1;
            
            // Interaction type count
            if ('interaction' in finding) interactionTypeCounts[t.interaction_drug_drug] = (interactionTypeCounts[t.interaction_drug_drug] || 0) + 1;
            else if ('substance' in finding) interactionTypeCounts[t.interaction_drug_substance] = (interactionTypeCounts[t.interaction_drug_substance] || 0) + 1;
            else if ('allergen' in finding) interactionTypeCounts[t.alert_allergy] = (interactionTypeCounts[t.alert_allergy] || 0) + 1;
            else if ('condition' in finding) interactionTypeCounts[t.contraindication_condition] = (interactionTypeCounts[t.contraindication_condition] || 0) + 1;
            else if ('geneticFactor' in finding) interactionTypeCounts[t.contraindication_pharmacogenetic] = (interactionTypeCounts[t.contraindication_pharmacogenetic] || 0) + 1;
            else if ('criteria' in finding) interactionTypeCounts[t.alert_beers_criteria] = (interactionTypeCounts[t.alert_beers_criteria] || 0) + 1;

            // Specific Critical/High interaction tracking
            if (highRiskTerms.some(term => risk.toLowerCase().includes(term))) {
                highRiskFindings++;
                
                let interactionName = '';
                if ('interaction' in finding) interactionName = finding.interaction; // DDI
                else if ('substance' in finding) interactionName = `${finding.medication} + ${finding.substance}`; // DSI
                else if ('allergen' in finding) interactionName = `${finding.medication} (Allergy: ${finding.allergen})`; // Allergy
                else if ('condition' in finding) interactionName = `${finding.medication} + ${finding.condition}`; // Condition
                
                if (interactionName) {
                    specificInteractionCounts[interactionName] = (specificInteractionCounts[interactionName] || 0) + 1;
                }
            }
            
            // Medication frequency count
            if ('medication' in finding) {
                const med = finding.medication;
                medicationFrequency[med] = (medicationFrequency[med] || 0) + 1;
            } else if ('interaction' in finding) {
                const meds = finding.interaction.split(' + ');
                meds.forEach(med => {
                    const cleanMed = med.trim();
                    medicationFrequency[cleanMed] = (medicationFrequency[cleanMed] || 0) + 1;
                });
            }
        });
    });

    return {
        totalAnalyses: history.length,
        totalFindings,
        highRiskFindings,
        riskDistribution: Object.entries(riskLevelCounts).map(([label, value]) => ({ label, value })),
        topMedications: Object.entries(medicationFrequency).sort(([, a], [, b]) => b - a).slice(0, 5).map(([label, value]) => ({ label, value })),
        topInteractionTypes: Object.entries(interactionTypeCounts).sort(([, a], [, b]) => b - a).map(([label, value]) => ({ label, value })),
        topSpecificInteractions: Object.entries(specificInteractionCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([label, value]) => ({ label, value })),
    };
  }, [history, t]);

  // --- Logic for Patient View (New logic) ---
  const patientStats = useMemo(() => {
      if (!history || history.length === 0) return null;

      // Group by Patient ID (filter out null IDs), keep only the LATEST analysis for each
      const uniquePatientsMap = new Map<string, HistoryItem>();
      
      // History is often sorted newest first, but let's be safe and sort by date
      const sortedHistory = [...history].sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());

      sortedHistory.forEach(item => {
          if (item.patientId && !uniquePatientsMap.has(item.patientId)) {
              uniquePatientsMap.set(item.patientId, item);
          }
      });

      const uniquePatients = Array.from(uniquePatientsMap.values());
      const totalUniquePatients = uniquePatients.length;
      
      let patientsWithRisk = 0;
      let totalMeds = 0;
      const conditionsFrequency: Record<string, number> = {};
      const highRiskTerms = ['alto', 'high', 'crítico', 'critical'];

      uniquePatients.forEach(item => {
          totalMeds += item.medications.length;

          // Conditions count
          const conditionsList = item.conditions.split(',').map(c => c.trim()).filter(Boolean);
          conditionsList.forEach(c => {
              conditionsFrequency[c] = (conditionsFrequency[c] || 0) + 1;
          });

          // Check if this patient has ANY high risk finding in their latest snapshot
          const allFindings: AnyInteraction[] = [
            ...(item.analysisResult.drugDrugInteractions || []),
            ...(item.analysisResult.drugSubstanceInteractions || []),
            ...(item.analysisResult.drugAllergyAlerts || []),
            ...(item.analysisResult.drugConditionContraindications || []),
            ...(item.analysisResult.drugPharmacogeneticContraindications || []),
            ...(item.analysisResult.beersCriteriaAlerts || []),
          ];

          const hasHighRisk = allFindings.some(f => highRiskTerms.some(term => f.riskLevel.toLowerCase().includes(term)));
          if (hasHighRisk) patientsWithRisk++;
      });

      const avgMeds = totalUniquePatients > 0 ? (totalMeds / totalUniquePatients).toFixed(1) : 0;

      return {
          totalUniquePatients,
          patientsWithRisk,
          avgMeds,
          topConditions: Object.entries(conditionsFrequency).sort(([, a], [, b]) => b - a).slice(0, 5).map(([label, value]) => ({ label, value })),
      };

  }, [history]);

  // --- Export Handlers ---

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExportingPdf(true);
    try {
        const canvas = await html2canvas(dashboardRef.current, {
            scale: 2, // Higher quality for text
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff', // Force white background
            onclone: (clonedDoc) => {
                // Force fixed width for A4 consistency
                const element = clonedDoc.getElementById('dashboard-content');
                if (element) {
                    element.style.width = '750px'; 
                    element.style.padding = '20px';
                }
            }
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.85); 
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const imgHeight = canvasHeight / ratio;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
        pdf.save('dashboard_report.pdf');
    } catch (e) {
        console.error("PDF Export failed", e);
    } finally {
        setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (subTab === 'analysis' && analysisStats) {
          csvContent += "Metric,Value\n";
          csvContent += `${t.dashboard_total_analyses},${analysisStats.totalAnalyses}\n`;
          csvContent += `${t.dashboard_total_findings},${analysisStats.totalFindings}\n`;
          csvContent += `${t.dashboard_high_risk_findings},${analysisStats.highRiskFindings}\n`;
          csvContent += "\nRisk Distribution\nRisk Level,Count\n";
          analysisStats.riskDistribution.forEach(row => csvContent += `${row.label},${row.value}\n`);
          csvContent += "\nTop Medications\nMedication,Count\n";
          analysisStats.topMedications.forEach(row => csvContent += `${row.label},${row.value}\n`);
          csvContent += "\nFinding Types\nType,Count\n";
          analysisStats.topInteractionTypes.forEach(row => csvContent += `${row.label},${row.value}\n`);
          csvContent += "\nSpecific High Risk Interactions\nInteraction,Count\n";
          analysisStats.topSpecificInteractions.forEach(row => csvContent += `"${row.label}",${row.value}\n`);
      } else if (subTab === 'patients' && patientStats) {
          csvContent += "Metric,Value\n";
          csvContent += `${t.dashboard_unique_patients},${patientStats.totalUniquePatients}\n`;
          csvContent += `${t.dashboard_patients_with_risk},${patientStats.patientsWithRisk}\n`;
          csvContent += `${t.dashboard_avg_meds},${patientStats.avgMeds}\n`;
          csvContent += "\nTop Conditions\nCondition,Count\n";
          patientStats.topConditions.forEach(row => csvContent += `${row.label},${row.value}\n`);
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dashboard_${subTab}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };


  if (!history || history.length === 0) {
    return (
        <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 h-full flex flex-col items-center justify-center text-center">
            <ChartBarIcon className="h-16 w-16 text-slate-400 dark:text-slate-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.dashboard_title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{t.dashboard_empty}</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 mr-3 text-blue-500" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t.dashboard_title}</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center">
                 <button
                    onClick={() => setSubTab('analysis')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${subTab === 'analysis' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                 >
                     {t.dashboard_subtab_analysis}
                 </button>
                 <button
                    onClick={() => setSubTab('patients')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${subTab === 'patients' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                 >
                     {t.dashboard_subtab_patients}
                 </button>
             </div>
             
             <div className="flex gap-2">
                 <button 
                    onClick={handleExportPDF}
                    disabled={isExportingPdf}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700" title={t.dashboard_export_pdf}
                 >
                     {isExportingPdf ? <span className="animate-spin h-5 w-5 block border-2 border-slate-400 rounded-full border-t-transparent"></span> : <DownloadIcon className="h-5 w-5" />}
                 </button>
                 <button 
                    onClick={handleExportCSV}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700" title={t.dashboard_export_csv}
                 >
                     <ExportIcon className="h-5 w-5" />
                 </button>
             </div>
          </div>
      </div>

      <div id="dashboard-content" ref={dashboardRef} className="space-y-6 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl">
        {/* Analysis View */}
        {subTab === 'analysis' && analysisStats && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title={t.dashboard_total_analyses} value={analysisStats.totalAnalyses} icon={PresentationChartLineIcon} />
                    <StatCard title={t.dashboard_total_findings} value={analysisStats.totalFindings} icon={ClipboardListIcon} />
                    <StatCard title={t.dashboard_high_risk_findings} value={analysisStats.highRiskFindings} icon={AlertTriangleIcon} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <BarChart data={analysisStats.riskDistribution} title={t.dashboard_risk_distribution} t={t} />
                    <BarChart data={analysisStats.topMedications} title={t.dashboard_top_5_meds} t={t} />
                    <div className="lg:col-span-2">
                        <BarChart data={analysisStats.topInteractionTypes} title={t.dashboard_finding_types} t={t} />
                    </div>
                </div>

                {/* NEW: Specific Critical Interactions Table */}
                {analysisStats.topSpecificInteractions.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-semibold text-red-800 dark:text-red-200 mb-4 flex items-center">
                            <AlertTriangleIcon className="h-5 w-5 mr-2" />
                            {t.dashboard_critical_interactions_title}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-red-50 dark:bg-red-900/20">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-red-900 dark:text-red-100">{t.results_interaction} / {t.results_contraindication}</th>
                                        <th className="px-4 py-2 text-right text-red-900 dark:text-red-100">Frecuencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-red-100 dark:divide-slate-700">
                                    {analysisStats.topSpecificInteractions.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{item.label}</td>
                                            <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-200">{item.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </>
        )}

        {/* Patients View */}
        {subTab === 'patients' && patientStats && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title={t.dashboard_unique_patients} value={patientStats.totalUniquePatients} icon={UserGroupIcon} />
                    <StatCard title={t.dashboard_patients_with_risk} value={patientStats.patientsWithRisk} icon={AlertTriangleIcon} />
                    <StatCard title={t.dashboard_avg_meds} value={patientStats.avgMeds} icon={ClipboardListIcon} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <BarChart data={patientStats.topConditions} title={t.dashboard_top_conditions} t={t} />
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                        <UserGroupIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Este resumen se basa en la última instantánea de cada ID de paciente único detectado en el historial.
                        </p>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default DashboardPanel;
