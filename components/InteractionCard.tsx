
import React from 'react';
import RiskBadge from './RiskBadge';
import CogIcon from './icons/CogIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CopyIcon from './icons/CopyIcon';

export interface InteractionContentSection {
  label: string;
  value?: string;
  isBold?: boolean; // For Clinical Summary usually
}

interface InteractionCardProps {
  title: string;
  riskLevel: string;
  subTitle?: React.ReactNode;
  content: InteractionContentSection[];
  dosageAdjustment?: string;
  therapeuticAlternative?: string;
  references?: string;
  onCopy: () => void;
  isCopied: boolean;
  copyLabel: string;
  t: any;
  borderColorClass?: string; // Optional override for border color (e.g. for allergies)
  bgColorClass?: string; // Optional override for bg color
}

const InteractionCard: React.FC<InteractionCardProps> = ({
  title,
  riskLevel,
  subTitle,
  content,
  dosageAdjustment,
  therapeuticAlternative,
  references,
  onCopy,
  isCopied,
  copyLabel,
  t,
  borderColorClass = "border-slate-200 dark:border-slate-700/50",
  bgColorClass = "bg-slate-50 dark:bg-slate-900/50"
}) => {
  return (
    <div className={`relative p-4 rounded-lg border ${borderColorClass} ${bgColorClass}`}>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
        <h4 className="text-md font-bold text-slate-800 dark:text-slate-100 pr-8">{title}</h4>
        <RiskBadge riskLevel={riskLevel} />
      </div>
      
      {subTitle && (
        <div className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          {subTitle}
        </div>
      )}

      <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        {content.map((section, idx) => (
          section.value ? (
            <div key={idx}>
              <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{section.label}</h5>
              <p className={`text-sm ${section.isBold ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-400'}`}>
                {section.value}
              </p>
            </div>
          ) : null
        ))}

        {(dosageAdjustment || therapeuticAlternative) && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg space-y-3">
            {dosageAdjustment && (
              <div>
                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  <CogIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  {t.results_dosage_adjustment}
                </h5>
                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{dosageAdjustment}</p>
              </div>
            )}
            {therapeuticAlternative && (
              <div>
                <h5 className="flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  <ArrowPathIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  {t.results_therapeutic_alternative}
                </h5>
                <p className="text-sm text-slate-700 dark:text-slate-300 pl-5">{therapeuticAlternative}</p>
              </div>
            )}
          </div>
        )}

        {references && (
          <div>
            <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">{t.results_references}</h5>
            <p className="text-xs text-slate-500 dark:text-slate-500 break-all">{references}</p>
          </div>
        )}
      </div>

      <button
        onClick={onCopy}
        className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label={copyLabel}
      >
        {isCopied ? (
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
        ) : (
          <CopyIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default InteractionCard;
