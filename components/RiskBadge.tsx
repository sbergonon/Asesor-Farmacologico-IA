
import React from 'react';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import AlertCircleIcon from './icons/AlertCircleIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';

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

export default RiskBadge;
