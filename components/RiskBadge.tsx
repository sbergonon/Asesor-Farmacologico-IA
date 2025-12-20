
import React from 'react';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import AlertCircleIcon from './icons/AlertCircleIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';

const getRiskDetails = (riskLevel: string) => {
  const lowerRisk = riskLevel.toLowerCase();
  
  if (lowerRisk.includes('crítico') || lowerRisk.includes('critical')) {
    return { Icon: AlertTriangleIcon, badgeClasses: 'bg-red-700 text-white' };
  }
  if (lowerRisk.includes('alto') || lowerRisk.includes('high')) {
    return { Icon: AlertTriangleIcon, badgeClasses: 'bg-red-500 text-white' };
  }
  if (lowerRisk.includes('moderado') || lowerRisk.includes('moderate')) {
    return { Icon: AlertCircleIcon, badgeClasses: 'bg-amber-500 text-white' };
  }
  if (lowerRisk.includes('bajo') || lowerRisk.includes('low')) {
    return { Icon: InfoCircleIcon, badgeClasses: 'bg-sky-500 text-white' };
  }
  return { Icon: InfoCircleIcon, badgeClasses: 'bg-slate-500 text-white' };
};

const RiskBadge: React.FC<{ riskLevel: string }> = ({ riskLevel }) => {
  const { Icon, badgeClasses } = getRiskDetails(riskLevel);
  return (
    <span className={`flex-shrink-0 inline-flex items-center gap-x-1 px-2.5 py-1 text-[10px] font-black uppercase rounded-full shadow-sm ${badgeClasses}`}>
      <Icon className="h-3 w-3" />
      {riskLevel}
    </span>
  );
};

export default RiskBadge;
