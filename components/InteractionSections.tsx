
import React from 'react';
import InteractionCard, { InteractionContentSection } from './InteractionCard';
import type { 
  DrugDrugInteraction, 
  DrugSubstanceInteraction, 
  DrugAllergyAlert, 
  DrugConditionContraindication, 
  DrugPharmacogeneticContraindication, 
  BeersCriteriaAlert 
} from '../types';

interface SectionProps<T> {
  items: T[];
  t: any;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const DrugDrugList: React.FC<SectionProps<DrugDrugInteraction>> = ({ items, t, onCopy, copiedId }) => (
  <>
    {items.map((item, index) => {
      const itemId = `drugDrug-${index}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_potential_effects, value: item.potentialEffects },
        { label: t.results_recommendations, value: item.recommendations },
      ];
      
      const textToCopy = [
        `${t.results_interaction}: ${item.interaction}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={item.interaction}
          riskLevel={item.riskLevel}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
        />
      );
    })}
  </>
);

export const DrugSubstanceList: React.FC<SectionProps<DrugSubstanceInteraction>> = ({ items, t, onCopy, copiedId }) => (
  <>
    {items.map((item, index) => {
      const itemId = `drugSubstance-${index}`;
      const title = `${item.medication} + ${item.substance}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_potential_effects, value: item.potentialEffects },
        { label: t.results_recommendations, value: item.recommendations },
      ];

      const textToCopy = [
        `${t.results_interaction}: ${title}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={title}
          riskLevel={item.riskLevel}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
        />
      );
    })}
  </>
);

export const DrugAllergyList: React.FC<SectionProps<DrugAllergyAlert>> = ({ items, t, onCopy, copiedId }) => (
  <>
    {items.map((item, index) => {
      const itemId = `drugAllergy-${index}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_alert_details, value: item.alertDetails },
        { label: t.results_recommendations, value: item.recommendations },
      ];

      const textToCopy = [
        `${t.results_medication}: ${item.medication}`,
        `${t.results_allergen}: ${item.allergen}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={item.medication}
          riskLevel={item.riskLevel}
          subTitle={<>
            {t.results_allergen}: <span className="font-bold">{item.allergen}</span>
          </>}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
          borderColorClass="border-red-200 dark:border-red-700/50"
          bgColorClass="bg-red-50 dark:bg-red-900/30"
        />
      );
    })}
  </>
);

export const DrugConditionList: React.FC<SectionProps<DrugConditionContraindication>> = ({ items, t, onCopy, copiedId }) => (
  <>
    {items.map((item, index) => {
      const itemId = `drugCondition-${index}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_details, value: item.contraindicationDetails },
        { label: t.results_recommendations, value: item.recommendations },
      ];

      const textToCopy = [
        `${t.results_contraindication}: ${item.medication} with ${item.condition}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={item.medication}
          riskLevel={item.riskLevel}
          subTitle={<>
            Contraindicated with: <span className="font-bold">{item.condition}</span>
          </>}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
        />
      );
    })}
  </>
);

export const DrugPgxList: React.FC<SectionProps<DrugPharmacogeneticContraindication>> = ({ items, t, onCopy, copiedId }) => (
  <>
    {items.map((item, index) => {
      const itemId = `drugPgx-${index}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_implication, value: item.implication },
        { label: t.results_recommendations, value: item.recommendations },
      ];

      const textToCopy = [
        `${t.results_medication}: ${item.medication}`,
        `${t.results_genetic_factor}: ${item.geneticFactor} ${item.variantAllele ? `(${item.variantAllele})` : ''}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={item.medication}
          riskLevel={item.riskLevel}
          subTitle={<>
            {t.results_genetic_factor}: <span className="font-bold">{item.geneticFactor} {item.variantAllele ? `(${item.variantAllele})` : ''}</span>
          </>}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
        />
      );
    })}
  </>
);

export const BeersCriteriaList: React.FC<SectionProps<BeersCriteriaAlert>> = ({ items, t, onCopy, copiedId }) => (
  <>
    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
        <h4 className="font-bold text-blue-800 dark:text-blue-300">{t.beers_criteria_explanation_title}</h4>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {t.beers_criteria_explanation_text}
        </p>
    </div>
    {items.map((item, index) => {
      const itemId = `beers-${index}`;
      const content: InteractionContentSection[] = [
        { label: t.results_clinical_summary, value: item.clinicalSummary, isBold: true },
        { label: t.results_criteria_reason, value: item.criteria },
        { label: t.results_recommendations, value: item.recommendations },
      ];

      const textToCopy = [
        `${t.results_medication}: ${item.medication}`,
        `${t.results_risk_level}: ${item.riskLevel}`,
        ...content.map(c => c.value ? `${c.label}: ${c.value}` : ''),
        item.dosageAdjustment ? `${t.results_dosage_adjustment}: ${item.dosageAdjustment}` : '',
        item.therapeuticAlternative ? `${t.results_therapeutic_alternative}: ${item.therapeuticAlternative}` : '',
        item.references ? `${t.results_references}: ${item.references}` : ''
      ].filter(Boolean).join('\n');

      return (
        <InteractionCard
          key={index}
          title={item.medication}
          riskLevel={item.riskLevel}
          content={content}
          dosageAdjustment={item.dosageAdjustment}
          therapeuticAlternative={item.therapeuticAlternative}
          references={item.references}
          onCopy={() => onCopy(textToCopy, itemId)}
          isCopied={copiedId === itemId}
          copyLabel={t.copy_button_aria_label}
          t={t}
        />
      );
    })}
  </>
);
