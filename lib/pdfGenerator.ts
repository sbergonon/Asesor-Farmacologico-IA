
import jsPDF from 'jspdf';
import type { AnalysisResult, InvestigatorResult, Medication } from '../types';

export const generateClinicalPDF = (
  type: 'interaction' | 'investigator',
  data: any,
  t: any,
  patientInfo: { id: string; medications: Medication[]; dob: string; conditions: string; allergies?: string }
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Pie de página con numeración total
  const addFinalPageNumbers = () => {
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const pageText = `${t.lang_code === 'es' ? 'Página' : 'Page'} ${i} ${t.lang_code === 'es' ? 'de' : 'of'} ${totalPages}`;
      doc.text(pageText, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      doc.setFontSize(7);
      doc.text(t.footer_disclaimer, pageWidth / 2, pageHeight - 15, { align: 'center' });
    }
  };

  const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [0, 0, 0]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    
    lines.forEach(line => {
      if (y + (size / 2) > pageHeight - 25) {
        doc.addPage();
        y = margin + 10;
      }
      doc.text(line, margin, y);
      y += (size / 2) * 1.15; // Interlineado aún más ajustado
    });
    y += 0.8; // Espaciado entre bloques aún más reducido
  };

  const drawDivider = () => {
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3; // Divider spacing ajustado
  };

  // 1. Cabecera Profesional
  doc.setFillColor(30, 58, 138); 
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(t.appName, margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(type === 'interaction' ? t.results_title : 'Investigación de Causalidad Clínica', margin, 28);
  doc.text(new Date().toLocaleDateString(), pageWidth - margin, 28, { align: 'right' });
  y = 50;

  // 2. Caja de Contexto (Más compacta)
  doc.setFillColor(248, 250, 252);
  doc.rect(margin - 5, y - 5, pageWidth - (margin * 2) + 10, 28, 'F'); // Aumentado ligeramente para incluir alergias
  y += 1;
  addText(t.form_patient_id_label + ': ' + (patientInfo.id || 'N/A'), 11, 'bold');
  addText(t.form_dob_label + ': ' + (patientInfo.dob || 'N/A') + ' | ' + t.form_conditions_label + ': ' + (patientInfo.conditions || 'N/A'), 9);
  addText(t.form_allergies_label + ': ' + (patientInfo.allergies || 'Ninguna'), 9);
  y += 2.5;

  // 3. Contenido Principal
  if (type === 'interaction') {
    const res = data as AnalysisResult;
    const sections = [
        { label: t.section_drug_drug, items: res.drugDrugInteractions },
        { label: t.section_drug_substance, items: res.drugSubstanceInteractions },
        { label: t.section_drug_allergy, items: res.drugAllergyAlerts },
        { label: t.section_drug_condition, items: res.drugConditionContraindications },
        { label: t.section_drug_pharmacogenetic, items: res.drugPharmacogeneticContraindications },
        { label: t.section_beers_criteria, items: res.beersCriteriaAlerts }
    ];

    sections.forEach(sec => {
        if (sec.items && sec.items.length > 0) {
            y += 1.5;
            addText(sec.label, 11.5, 'bold', [30, 58, 138]);
            sec.items.forEach((item: any) => {
                const title = item.interaction || item.medication || item.allergen;
                const riskColor: [number, number, number] = item.riskLevel?.toLowerCase().includes('crít') ? [185, 28, 28] : [217, 119, 6];
                
                addText(`> ${title} [${item.riskLevel}]`, 10, 'bold', riskColor);
                addText(`Resumen: ${item.clinicalSummary}`, 9, 'normal', [50, 50, 50]);
                if (item.recommendations) addText(`Rec: ${item.recommendations}`, 9, 'normal', [70, 70, 70]);
                y += 0.4;
            });
            drawDivider();
        }
    });

    y += 2;
    addText("ANÁLISIS CLÍNICO DETALLADO", 11, 'bold', [30, 58, 138]);
    addText(res.analysisText.replace(/[#*]/g, ''), 9.5);

  } else {
    const res = data as InvestigatorResult;
    addText("Hallazgos de Causalidad:", 11.5, 'bold', [30, 58, 138]);
    res.matches.forEach((m: any) => {
        addText(`• ${m.cause} (${m.probability})`, 10, 'bold', [79, 70, 229]);
        addText(`Mecanismo: ${m.mechanism}`, 9);
        y += 0.8;
    });

    y += 3;
    drawDivider();
    addText("Justificación Técnica:", 11, 'bold', [30, 58, 138]);
    addText(res.analysisText.replace(/[#*]/g, ''), 9.5);
  }

  addFinalPageNumbers();
  const safeId = (patientInfo.id || 'Anon').replace(/[^a-z0-9]/gi, '_').slice(0, 20);
  doc.save(`${type === 'interaction' ? 'Informe' : 'Causalidad'}_${safeId}.pdf`);
};
