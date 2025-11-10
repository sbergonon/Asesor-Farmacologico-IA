import React, { useMemo } from 'react';
import type { Medication, ProactiveAlert } from '../types';
import { criticalAllergyRules, criticalConditionRules, criticalDrugInteractionRules } from '../data/proactiveAlerts';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface ProactiveAlertsProps {
  medications: Medication[];
  allergies: string;
  conditions: string;
  t: any;
}

const ProactiveAlerts: React.FC<ProactiveAlertsProps> = ({ medications, allergies, conditions, t }) => {

  const activeAlerts = useMemo<ProactiveAlert[]>(() => {
    const alerts: ProactiveAlert[] = [];
    const medNamesLower = medications.map(m => m.name.toLowerCase());
    const allergyListLower = allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
    const conditionListLower = conditions.toLowerCase().split(',').map(c => c.trim()).filter(Boolean);

    // 1. Check for critical allergy alerts
    allergyListLower.forEach(allergy => {
      for (const group in criticalAllergyRules) {
        if (allergy.includes(group)) {
          const conflictingDrugs = criticalAllergyRules[group];
          medNamesLower.forEach((medName, index) => {
            if (conflictingDrugs.includes(medName)) {
              const med = medications[index];
              alerts.push({
                id: `allergy-${med.name}-${group}`,
                type: 'allergy',
                title: t.allergy_alert_title,
                message: t.allergy_alert_text
                  .replace('{medication}', med.name)
                  .replace('{allergyGroup}', group.charAt(0).toUpperCase() + group.slice(1)),
              });
            }
          });
        }
      }
    });

    // 2. Check for critical drug-condition contraindications
    conditionListLower.forEach(condition => {
      for (const group in criticalConditionRules) {
        if (condition.includes(group)) {
          const rule = criticalConditionRules[group];
          medNamesLower.forEach((medName, index) => {
            if (rule.drugs.includes(medName)) {
              const med = medications[index];
              alerts.push({
                id: `condition-${med.name}-${group}`,
                type: 'condition',
                title: t.condition_alert_title,
                message: t.condition_alert_text
                  .replace('{medication}', med.name)
                  .replace('{condition}', group.charAt(0).toUpperCase() + group.slice(1))
                  .replace('{reason}', t[rule.reasonKey]),
              });
            }
          });
        }
      }
    });

    // 3. Check for critical drug-drug interactions
    criticalDrugInteractionRules.forEach(rule => {
      const [drug1, drug2] = rule.pair;
      if (medNamesLower.includes(drug1) && medNamesLower.includes(drug2)) {
        const med1 = medications.find(m => m.name.toLowerCase() === drug1)!;
        const med2 = medications.find(m => m.name.toLowerCase() === drug2)!;
        alerts.push({
          id: `ddi-${drug1}-${drug2}`,
          type: 'drug-drug',
          title: t.ddi_alert_title,
          message: t.ddi_alert_text
            .replace('{med1}', med1.name)
            .replace('{med2}', med2.name)
            .replace('{reason}', t[rule.reasonKey]),
        });
      }
    });

    // Deduplicate alerts
    const uniqueAlerts = Array.from(new Map(alerts.map(item => [item.id, item])).values());
    return uniqueAlerts;

  }, [medications, allergies, conditions, t]);

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center">
        <AlertTriangleIcon className="h-6 w-6 mr-2" />
        {t.proactive_alert_title}
      </h3>
      {activeAlerts.map(alert => (
        <div key={alert.id} className="p-4 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-r-lg" role="alert">
          <h4 className="font-bold">{alert.title}</h4>
          <p className="mt-1 text-sm">{alert.message}</p>
          <p className="mt-2 text-xs font-semibold">{t.alert_recommendation}</p>
        </div>
      ))}
    </div>
  );
};

export default ProactiveAlerts;