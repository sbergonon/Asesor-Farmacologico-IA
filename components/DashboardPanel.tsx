import React, { useMemo } from 'react';
import type { HistoryItem, AnyInteraction } from '../types';
import ChartBarIcon from './icons/ChartBarIcon';
import AlertTriangleIcon from './icons-v2/AlertTriangleIcon';
import ClipboardListIcon from './icons-v2/ClipboardListIcon';
import PresentationChartLineIcon from './icons-v2/PresentationChartLineIcon';

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
                        <div className="w-1/3 text-sm font-medium text-slate-600 dark:text-slate-300 truncate pr-2">{label}</div>
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
  const dashboardData = useMemo(() => {
    if (!history || history.length === 0) {
      return null;
    }
    
    let totalFindings = 0;
    let highRiskFindings = 0;
    const riskLevelCounts: Record<string, number> = {};
    const medicationFrequency: Record<string, number> = {};
    const interactionTypeCounts: Record<string, number> = {};
    
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
            
            if (highRiskTerms.some(term => risk.toLowerCase().includes(term))) {
                highRiskFindings++;
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
            
            // Interaction type count
            if ('interaction' in finding) interactionTypeCounts[t.interaction_drug_drug] = (interactionTypeCounts[t.interaction_drug_drug] || 0) + 1;
            else if ('substance' in finding) interactionTypeCounts[t.interaction_drug_substance] = (interactionTypeCounts[t.interaction_drug_substance] || 0) + 1;
            else if ('allergen' in finding) interactionTypeCounts[t.alert_allergy] = (interactionTypeCounts[t.alert_allergy] || 0) + 1;
            else if ('condition' in finding) interactionTypeCounts[t.contraindication_condition] = (interactionTypeCounts[t.contraindication_condition] || 0) + 1;
            else if ('geneticFactor' in finding) interactionTypeCounts[t.contraindication_pharmacogenetic] = (interactionTypeCounts[t.contraindication_pharmacogenetic] || 0) + 1;
            else if ('criteria' in finding) interactionTypeCounts[t.alert_beers_criteria] = (interactionTypeCounts[t.alert_beers_criteria] || 0) + 1;

        });
    });

    const topMedications = Object.entries(medicationFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([label, value]) => ({ label, value }));

    const topInteractionTypes = Object.entries(interactionTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([label, value]) => ({ label, value }));
        
    const riskDistribution = Object.entries(riskLevelCounts)
        .map(([label, value]) => ({ label, value }));

    return {
        totalAnalyses: history.length,
        totalFindings,
        highRiskFindings,
        riskDistribution,
        topMedications,
        topInteractionTypes,
    };
  }, [history, t]);

  if (!dashboardData) {
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
      <div className="flex items-center">
        <ChartBarIcon className="h-8 w-8 mr-3 text-blue-500" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t.dashboard_title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title={t.dashboard_total_analyses} value={dashboardData.totalAnalyses} icon={PresentationChartLineIcon} />
        <StatCard title={t.dashboard_total_findings} value={dashboardData.totalFindings} icon={ClipboardListIcon} />
        <StatCard title={t.dashboard_high_risk_findings} value={dashboardData.highRiskFindings} icon={AlertTriangleIcon} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BarChart data={dashboardData.riskDistribution} title={t.dashboard_risk_distribution} t={t} />
          <BarChart data={dashboardData.topMedications} title={t.dashboard_top_5_meds} t={t} />
          <div className="lg:col-span-2">
            <BarChart data={dashboardData.topInteractionTypes} title={t.dashboard_finding_types} t={t} />
          </div>
      </div>
    </div>
  );
};

export default DashboardPanel;