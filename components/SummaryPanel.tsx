import React from 'react';

interface SummaryPanelProps {
  counts: Record<string, number>;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  t: any; 
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ counts, activeFilter, onFilterChange, t }) => {
  
  const getRiskColorClasses = (risk: string, isActive: boolean) => {
    const lowerRisk = risk.toLowerCase();
    const baseClasses = "px-3 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900";
    const activeClass = isActive ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-105';
    
    if (lowerRisk.includes('crítico') || lowerRisk.includes('critical')) {
      return `${baseClasses} ${activeClass} bg-red-700 hover:bg-red-800 text-white focus:ring-red-500`;
    }
    if (lowerRisk.includes('alto') || lowerRisk.includes('high')) {
      return `${baseClasses} ${activeClass} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500`;
    }
    if (lowerRisk.includes('moderado') || lowerRisk.includes('moderate')) {
      return `${baseClasses} ${activeClass} bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500`;
    }
    if (lowerRisk.includes('bajo') || lowerRisk.includes('low')) {
      return `${baseClasses} ${activeClass} bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-500`;
    }
    return `${baseClasses} ${activeClass} bg-slate-500 hover:bg-slate-600 text-white focus:ring-slate-500`;
  };
  
  const riskOrder = ['Crítico', 'Critical', 'Alto', 'High', 'Moderado', 'Moderate', 'Bajo', 'Low'];
  const sortedRisks = Object.keys(counts).sort((a, b) => {
    const indexA = riskOrder.indexOf(a);
    const indexB = riskOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  if (sortedRisks.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-3">{t.summary_panel_title}</h3>
        <div className="flex flex-wrap gap-3">
            {sortedRisks.map(risk => (
                <button 
                    key={risk} 
                    onClick={() => onFilterChange(activeFilter === risk ? null : risk)}
                    className={getRiskColorClasses(risk, activeFilter === risk)}
                >
                    <span>{risk}</span>
                    <span className="ml-2 bg-white/20 text-xs font-bold rounded-full px-2 py-0.5">{counts[risk]}</span>
                </button>
            ))}
            {activeFilter && (
                 <button 
                    onClick={() => onFilterChange(null)}
                    className="px-3 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-slate-500"
                 >
                    {t.summary_show_all}
                </button>
            )}
        </div>
    </div>
  );
};

export default SummaryPanel;
