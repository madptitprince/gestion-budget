import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BudgetYearData, MonthKey, MonthSummary, BudgetItem } from '../types/budget';
import { MONTHS } from '../data/initialData';

// Standard clean currency formatter without non-breaking space issues
const formatNum = (val: number): string => {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(val || 0)
    .replace(/[\u202f\u00a0]/g, ' ');
  return `${formatted} €`;
};

// Short number formatter for large matrices
const formatShortNum = (val: number): string => {
  if (!val || val === 0) return '-';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(val)
    .replace(/[\u202f\u00a0]/g, ' ');
};

// --- 1. RAPPORT MENSUEL COMPLET (A4 Portrait) ---
export const generateMonthlyPDF = (
  month: MonthKey,
  year: string,
  yearData: BudgetYearData,
  summary: MonthSummary
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthLabel = MONTHS.find(m => m.key === month)?.label || month;
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // 1. TOP HEADER
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MAD', margin, 15);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text('FIN', margin + 14, 15);

  // Document Title & Date (Right aligned)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`RAPPORT BUDGET • ${monthLabel.toUpperCase()} ${year}`, pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Édité le ${todayStr}`, pageWidth - margin, 18, { align: 'right' });

  // 2. 5 EXECUTIVE KPI CARDS
  const cardY = 30;
  const gap = 3.5;
  const cardWidth = (pageWidth - margin * 2 - gap * 4) / 5;
  const cardHeight = 18;

  const fixedPct = summary.totalIncome > 0 ? Math.round((summary.totalFixed / summary.totalIncome) * 100) : 0;
  const savPct = summary.savingsRate;
  const varPct = summary.totalIncome > 0 ? Math.round((summary.totalVariable / summary.totalIncome) * 100) : 0;
  const netPct = summary.totalIncome > 0 ? Math.round((summary.remainingNet / summary.totalIncome) * 100) : 0;

  const kpis = [
    { label: 'Revenus', val: summary.totalIncome, pct: '100%', bg: [240, 253, 244], stroke: [187, 247, 208], text: [22, 101, 52] },
    { label: 'Charges Fixes', val: summary.totalFixed, pct: `${fixedPct}%`, bg: [239, 246, 255], stroke: [191, 219, 254], text: [30, 64, 175] },
    { label: 'Épargne & DCA', val: summary.totalSavings, pct: `${savPct}%`, bg: [250, 245, 255], stroke: [233, 213, 255], text: [107, 33, 168] },
    { label: 'Dép. Variables', val: summary.totalVariable, pct: `${varPct}%`, bg: [255, 241, 242], stroke: [254, 205, 211], text: [159, 18, 57] },
    { label: 'Solde Net / Reste', val: summary.remainingNet, pct: `${netPct}%`, bg: [236, 253, 245], stroke: [167, 243, 208], text: [4, 120, 87] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (cardWidth + gap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.stroke[0], kpi.stroke[1], kpi.stroke[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.8, 1.8, 'FD');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 2.5, cardY + 4.8);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatNum(kpi.val), x + 2.5, cardY + 11.2);

    // Percent Badge
    doc.setFontSize(7.2);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.pct, x + cardWidth - 2.5, cardY + 15.5, { align: 'right' });
  });

  // 3. VISUAL ALLOCATION BAR (Répartition globale)
  const barY = cardY + cardHeight + 4;
  const barW = pageWidth - margin * 2;
  const barH = 4.5;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, barY, barW, barH, 1.2, 1.2, 'F');

  if (summary.totalIncome > 0) {
    let currentX = margin;
    const segments = [
      { width: (summary.totalFixed / summary.totalIncome) * barW, color: [59, 130, 246] },
      { width: (summary.totalSavings / summary.totalIncome) * barW, color: [168, 85, 247] },
      { width: (summary.totalVariable / summary.totalIncome) * barW, color: [244, 63, 94] },
      { width: Math.max(0, (summary.remainingNet / summary.totalIncome) * barW), color: [16, 185, 129] },
    ];

    segments.forEach((seg, sIdx) => {
      if (seg.width > 0.5) {
        doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
        if (sIdx === 0 && segments.every((s, i) => i === 0 || s.width <= 0.5)) {
          doc.roundedRect(currentX, barY, seg.width, barH, 1.2, 1.2, 'F');
        } else {
          doc.rect(currentX, barY, seg.width, barH, 'F');
        }
        currentX += seg.width;
      }
    });
  }

  // Legend under the bar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const legendY = barY + barH + 3.8;
  const legendItems = [
    { label: `Charges Fixes (${fixedPct}%)`, color: [59, 130, 246] },
    { label: `Épargne & DCA (${savPct}%)`, color: [168, 85, 247] },
    { label: `Variables (${varPct}%)`, color: [244, 63, 94] },
    { label: `Solde Reste (${netPct}%)`, color: [16, 185, 129] },
  ];

  let legendX = margin;
  legendItems.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(legendX + 1.2, legendY - 1, 1.2, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, legendX + 4, legendY);
    legendX += doc.getTextWidth(item.label) + 10;
  });

  // 4. CATEGORIZED SECTIONS TABLES
  const buildTableData = (items: BudgetItem[]) => {
    const active = items.filter(i => (i.values[month] || 0) > 0);
    return active.map(i => {
      const val = i.values[month] || 0;
      const pct = summary.totalIncome > 0 ? `${Math.round((val / summary.totalIncome) * 100)}%` : '-';
      return [i.name, formatNum(val), pct];
    });
  };

  const sections = [
    { title: 'REVENUS DU MOIS', data: buildTableData(yearData.income), total: summary.totalIncome, headBg: [16, 185, 129] },
    { title: 'CHARGES FIXES (Logement, Abonnements, Crédits)', data: buildTableData(yearData.fixedExpenses), total: summary.totalFixed, headBg: [59, 130, 246] },
    { title: 'ÉPARGNE & INVESTISSEMENTS (PEA, Livret A, Crypto, AV)', data: buildTableData(yearData.savings), total: summary.totalSavings, headBg: [168, 85, 247] },
    { title: 'DÉPENSES VARIABLES (Courses, Restos, Loisirs, etc.)', data: buildTableData(yearData.variableExpenses), total: summary.totalVariable, headBg: [244, 63, 94] },
  ];

  let startY = legendY + 5.5;

  sections.forEach((sec) => {
    if (startY > pageHeight - 38) {
      doc.addPage();
      startY = 18;
    }

    const tableRows = [...sec.data];
    if (tableRows.length === 0) {
      tableRows.push(['Aucune opération enregistrée', '-', '-']);
    }

    // Add subtotal row
    tableRows.push([
      `TOTAL ${sec.title.split(' (')[0]}`,
      formatNum(sec.total),
      summary.totalIncome > 0 ? `${Math.round((sec.total / summary.totalIncome) * 100)}%` : '100%',
    ]);

    autoTable(doc, {
      startY: startY,
      margin: { left: margin, right: margin },
      head: [[sec.title, 'Montant', 'Part %']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [sec.headBg[0], sec.headBg[1], sec.headBg[2]],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.8,
        cellPadding: 2.2,
      },
      styles: {
        fontSize: 8.0,
        cellPadding: 2.3,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'normal' },
        1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 26, halign: 'right', fontStyle: 'normal' },
      },
      didParseCell: (data) => {
        // Highlight subtotal row
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    const lastAutoTable = (doc as any).lastAutoTable;
    startY = (lastAutoTable?.finalY || startY) + 5;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MADFIN • Document confidentiel • Page ${i} sur ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  doc.save(`MADFIN_Budget_${monthLabel}_${year}.pdf`);
};

// --- 2. BILAN ANNUEL CONSOLIDÉ 12 MOIS (A4 Paysage - 1 Seule Page) ---
export const generateAnnualPDF = (
  year: string,
  yearData: BudgetYearData
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // 1. Top Header (Compact 16 mm)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MAD', margin, 11);
  doc.setTextColor(16, 185, 129);
  doc.text('FIN', margin + 13, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`BILAN FINANCIER ANNUEL CONSOLIDÉ • ${year}`, pageWidth - margin, 9.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Édité le ${todayStr}`, pageWidth - margin, 13.5, { align: 'right' });

  // 2. Data Preparation
  const sumRow = (item: BudgetItem) =>
    MONTHS.reduce((acc, m) => acc + (item.values[m.key] || 0), 0);

  const sumSectionMonth = (items: BudgetItem[], mKey: MonthKey) =>
    items.reduce((acc, item) => acc + (item.values[mKey] || 0), 0);

  const sumSectionTotal = (items: BudgetItem[]) =>
    items.reduce((acc, item) => acc + sumRow(item), 0);

  const head = [
    ['Poste', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc', 'Total Annuel'],
  ];

  const body: any[] = [];

  const addSection = (title: string, items: BudgetItem[], titleColor: [number, number, number]) => {
    // Section Header row
    body.push([
      { content: title, colSpan: 14, styles: { fillColor: titleColor, textColor: [255, 255, 255], fontStyle: 'bold', cellPadding: 0.8 } },
    ]);

    const activeItems = items.filter(i => sumRow(i) > 0);
    const displayItems = activeItems.length > 0 ? activeItems : items.slice(0, 4);

    displayItems.forEach(item => {
      const row = [
        item.name,
        ...MONTHS.map(m => formatShortNum(item.values[m.key] || 0)),
        formatNum(sumRow(item)),
      ];
      body.push(row);
    });

    // Subtotal row
    const subtotalRow = [
      `SOUS-TOTAL ${title.split(' ')[0]}`,
      ...MONTHS.map(m => formatShortNum(sumSectionMonth(items, m.key))),
      formatNum(sumSectionTotal(items)),
    ];
    body.push(subtotalRow);
  };

  addSection('REVENUS', yearData.income, [16, 185, 129]);
  addSection('CHARGES FIXES', yearData.fixedExpenses, [59, 130, 246]);
  addSection('ÉPARGNE & INVESTISSEMENTS', yearData.savings, [168, 85, 247]);
  addSection('DÉPENSES VARIABLES', yearData.variableExpenses, [244, 63, 94]);

  // --- SYNTHÈSE TOTAUX DES MOIS ---
  body.push([
    {
      content: 'SYNTHÈSE DES TOTAUX MENSUELS',
      colSpan: 14,
      styles: { fillColor: [15, 23, 42], textColor: [16, 185, 129], fontStyle: 'bold', cellPadding: 0.8 },
    },
  ]);

  // Outflows row
  const outflowsRow = [
    'Total Sorties (Fixes + Épargne + Var)',
    ...MONTHS.map(m => {
      const val = sumSectionMonth(yearData.fixedExpenses, m.key) +
        sumSectionMonth(yearData.savings, m.key) +
        sumSectionMonth(yearData.variableExpenses, m.key);
      return formatShortNum(val);
    }),
    formatNum(
      sumSectionTotal(yearData.fixedExpenses) +
      sumSectionTotal(yearData.savings) +
      sumSectionTotal(yearData.variableExpenses)
    ),
  ];
  body.push(outflowsRow);

  // Net Cashflow row
  const netRow = [
    'SOLDE NET / RESTE À VIVRE',
    ...MONTHS.map(m => {
      const inc = sumSectionMonth(yearData.income, m.key);
      const out = sumSectionMonth(yearData.fixedExpenses, m.key) +
        sumSectionMonth(yearData.savings, m.key) +
        sumSectionMonth(yearData.variableExpenses, m.key);
      const net = inc - out;
      return inc === 0 && out === 0 ? '-' : formatShortNum(net);
    }),
    formatNum(
      sumSectionTotal(yearData.income) -
      (sumSectionTotal(yearData.fixedExpenses) +
        sumSectionTotal(yearData.savings) +
        sumSectionTotal(yearData.variableExpenses))
    ),
  ];
  body.push(netRow);

  // Savings rate row
  const rateRow = [
    "Taux d'Épargne (%)",
    ...MONTHS.map(m => {
      const inc = sumSectionMonth(yearData.income, m.key);
      const sav = sumSectionMonth(yearData.savings, m.key);
      return inc > 0 ? `${Math.round((sav / inc) * 100)}%` : '-';
    }),
    `${sumSectionTotal(yearData.income) > 0 ? Math.round((sumSectionTotal(yearData.savings) / sumSectionTotal(yearData.income)) * 100) : 0}%`,
  ];
  body.push(rateRow);

  autoTable(doc, {
    startY: 19,
    margin: { left: margin, right: margin, top: 6, bottom: 6 },
    head: head,
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.2,
      halign: 'center',
      cellPadding: 1.0,
    },
    styles: {
      fontSize: 5.8,
      cellPadding: 0.8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 47, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 16, halign: 'right' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 16, halign: 'right' },
      11: { cellWidth: 16, halign: 'right' },
      12: { cellWidth: 16, halign: 'right' },
      13: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      const rawRow = data.row.raw;
      const firstCol = Array.isArray(rawRow) ? String(rawRow[0] || '') : '';

      if (firstCol.startsWith('SOUS-TOTAL')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      } else if (firstCol.startsWith('Total Sorties')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [248, 250, 252];
      } else if (firstCol.startsWith('SOLDE NET')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [236, 253, 245];
        if (data.column.index > 0) {
          data.cell.styles.textColor = [5, 150, 105];
        }
      } else if (firstCol.startsWith("Taux d'Épargne")) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [250, 245, 255];
        if (data.column.index > 0) {
          data.cell.styles.textColor = [126, 34, 206];
        }
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MADFIN • Bilan Financier Annuel • Page ${i} sur ${totalPages}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  doc.save(`MADFIN_Bilan_Annuel_${year}.pdf`);
};

// --- 3. RAPPORT DU DIAGRAMME DE FLUX SANKEY (A4 Paysage - Haute Définition Optimisée) ---
export const generateFlowPDF = async (
  month: MonthKey,
  year: string,
  svgElementId: string = 'sankey-svg'
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const monthLabel = MONTHS.find(m => m.key === month)?.label || month;
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Top Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MAD', margin, 13);
  doc.setTextColor(16, 185, 129);
  doc.text('FIN', margin + 14, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.text(`DIAGRAMME DE FLUX DE TRÉSORERIE • ${monthLabel.toUpperCase()} ${year}`, pageWidth - margin, 10.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Édité le ${todayStr}`, pageWidth - margin, 15.5, { align: 'right' });

  // Convert SVG to Canvas and add image
  const svg = document.getElementById(svgElementId);
  if (svg) {
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');

    // Read viewBox for real dimensions
    const viewBox = svg.getAttribute('viewBox');
    let svgW = 1120;
    let svgH = 680;
    if (viewBox) {
      const parts = viewBox.split(' ');
      if (parts.length === 4) {
        svgW = parseFloat(parts[2]) || 1120;
        svgH = parseFloat(parts[3]) || 680;
      }
    }

    // High quality scale for sharp text rendering
    const scale = 2.0;
    canvas.width = svgW * scale;
    canvas.height = svgH * scale;
    const ctx = canvas.getContext('2d');

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = '#020617'; // Rich dark navy background
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Use JPEG 0.94 to keep file size ultra-light (~280 KB instead of 8.5 MB)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.94);

          // Place image in PDF keeping aspect ratio
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - 32;
          let drawW = maxW;
          let drawH = (svgH / svgW) * drawW;
          if (drawH > maxH) {
            drawH = maxH;
            drawW = (svgW / svgH) * drawH;
          }
          const posX = margin + (maxW - drawW) / 2;
          const posY = 24 + (maxH - drawH) / 2;

          // Draw dark card background behind image
          doc.setFillColor(2, 6, 23);
          doc.rect(posX, posY, drawW, drawH, 'F');
          doc.addImage(dataUrl, 'JPEG', posX, posY, drawW, drawH);

          // Frame border
          doc.setDrawColor(30, 41, 59);
          doc.setLineWidth(0.3);
          doc.rect(posX, posY, drawW, drawH, 'D');
        }
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `MADFIN • Diagramme de Flux Généré • Page 1 sur 1`,
    pageWidth / 2,
    pageHeight - 4,
    { align: 'center' }
  );

  doc.save(`MADFIN_Diagramme_Flux_${monthLabel}_${year}.pdf`);
};
