import React, { useState, useMemo } from 'react';
import { BudgetYearData, MonthKey, BudgetItem } from '../types/budget';
import { MONTHS } from '../data/initialData';
import { formatCurrency } from './SummaryCards';
import { Download, FileDown, Check } from 'lucide-react';
import { generateFlowPDF } from '../utils/pdfGenerator';

interface SankeyDiagramProps {
  yearData: BudgetYearData;
  currentYear: string;
  currentMonth: MonthKey;
  onSelectMonth: (month: MonthKey) => void;
}

interface NodeData {
  id: string;
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
  height: number;
  percent: number;
  pillarId?: string;
}

interface FlowData {
  id: string;
  sourceId: string;
  targetId: string;
  sourceY0: number;
  sourceY1: number;
  targetY0: number;
  targetY1: number;
  sourceX: number;
  targetX: number;
  value: number;
  color: string;
  label?: string;
}

export const SankeyDiagram: React.FC<SankeyDiagramProps> = ({
  yearData,
  currentYear,
  currentMonth,
  onSelectMonth,
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'annualAverage'>('month');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const currentMonthLabel = MONTHS.find(m => m.key === currentMonth)?.label || currentMonth;

  // Helper to extract value (either single month or annual monthly average)
  const getItemValue = (item: BudgetItem): number => {
    if (viewMode === 'month') {
      return item.values[currentMonth] || 0;
    } else {
      // Annual monthly average of active months
      const total = MONTHS.reduce((acc, m) => acc + (item.values[m.key] || 0), 0);
      return Math.round((total / 12) * 100) / 100;
    }
  };

  // Group items into pillars exactly like Finary:
  // 1. Investissements & Épargne
  // 2. Logement & Charges
  // 3. Abonnements & Services
  // 4. Vie Quotidienne & Variables
  // 5. Reste Libre / Épargne de sécurité
  const {
    incomes,
    totalIncome,
    pillarInvest,
    pillarHousing,
    pillarSubs,
    pillarDaily,
    remainingSurplus,
    activeItemsCount,
  } = useMemo(() => {
    // 1. Incomes
    const activeIncomes = yearData.income
      .map(item => ({ id: item.id, name: item.name, value: getItemValue(item) }))
      .filter(item => item.value > 0);

    const sumIncome = activeIncomes.reduce((acc, curr) => acc + curr.value, 0);

    // 2. Investissements & Épargne
    const investItems = yearData.savings
      .map(item => ({ id: item.id, name: item.name, value: getItemValue(item) }))
      .filter(item => item.value > 0);

    // 3. Split Fixed Expenses into Housing/Charges vs Abonnements
    const housingKeywords = ['loyer', 'charges', 'copropriété', 'prêt', 'crédit', 'assurance habitation', 'taxe'];
    const housingItems: { id: string; name: string; value: number }[] = [];
    const subsItems: { id: string; name: string; value: number }[] = [];

    yearData.fixedExpenses.forEach(item => {
      const val = getItemValue(item);
      if (val <= 0) return;
      const lower = item.name.toLowerCase();
      if (housingKeywords.some(k => lower.includes(k))) {
        housingItems.push({ id: item.id, name: item.name, value: val });
      } else {
        subsItems.push({ id: item.id, name: item.name, value: val });
      }
    });

    // 4. Daily life & Variable Expenses
    const dailyItems = yearData.variableExpenses
      .map(item => ({ id: item.id, name: item.name, value: getItemValue(item) }))
      .filter(item => item.value > 0);

    // Totals
    const sumInvest = investItems.reduce((acc, c) => acc + c.value, 0);
    const sumHousing = housingItems.reduce((acc, c) => acc + c.value, 0);
    const sumSubs = subsItems.reduce((acc, c) => acc + c.value, 0);
    const sumDaily = dailyItems.reduce((acc, c) => acc + c.value, 0);

    const totalOutflows = sumInvest + sumHousing + sumSubs + sumDaily;
    const surplus = Math.max(0, Math.round((sumIncome - totalOutflows) * 100) / 100);

    const count =
      investItems.length +
      housingItems.length +
      subsItems.length +
      dailyItems.length +
      (surplus > 0 ? 1 : 0);

    return {
      incomes: activeIncomes,
      totalIncome: sumIncome,
      pillarInvest: { name: 'Investissements & Épargne', items: investItems, total: sumInvest, color: '#f43f5e', ribbon: '#fb7185' },
      pillarHousing: { name: 'Logement & Charges', items: housingItems, total: sumHousing, color: '#a855f7', ribbon: '#c084fc' },
      pillarDaily: { name: 'Vie quotidienne', items: dailyItems, total: sumDaily, color: '#6366f1', ribbon: '#818cf8' },
      pillarSubs: { name: 'Abonnements', items: subsItems, total: sumSubs, color: '#0d9488', ribbon: '#2dd4bf' },
      remainingSurplus: surplus,
      activeItemsCount: count,
    };
  }, [yearData, currentMonth, viewMode]);

  // SVG Geometry Calculation
  const { width, height, nodes, flows } = useMemo(() => {
    const W = 1120;
    // Dynamic height based on item density
    const H = Math.max(680, activeItemsCount * 36 + 120);

    // Reference total value for vertical scale
    const totalRef = Math.max(
      totalIncome,
      pillarInvest.total + pillarHousing.total + pillarDaily.total + pillarSubs.total + remainingSurplus,
      100
    );

    const topPadding = 60;
    const bottomPadding = 60;
    const usableH = H - topPadding - bottomPadding;

    // X positions of the 4 columns
    const X0_bar = 200; // Incomes right bar (ample space for label on left)
    const X1 = 390; // Total budget bar
    const X2 = 650; // Pillars bar
    const X3 = 940; // Detailed items bar

    const nodeList: NodeData[] = [];
    const flowList: FlowData[] = [];

    // Helper for gap management
    const computeLayout = (
      items: { id: string; label: string; value: number; color: string; pillarId?: string }[],
      startX: number,
      targetH: number
    ) => {
      const minItemH = 18;
      const count = items.length;
      if (count === 0) return [];
      const totalGap = (count - 1) * 12;
      const scaleH = Math.max(10, targetH - totalGap);

      let currentY = topPadding + (usableH - targetH) / 2;

      return items.map(item => {
        const rawH = (item.value / totalRef) * scaleH;
        const h = Math.max(minItemH, rawH);
        const node: NodeData = {
          id: item.id,
          label: item.label,
          value: item.value,
          color: item.color,
          x: startX,
          y: currentY,
          height: h,
          percent: totalRef > 0 ? Math.round((item.value / totalRef) * 100) : 0,
          pillarId: item.pillarId,
        };
        currentY += h + 12;
        return node;
      });
    };

    // --- COLUMN 0: INCOMES ---
    const incomeItems = incomes.length > 0
      ? incomes.map(i => ({ id: `inc_${i.id}`, label: i.name, value: i.value, color: '#3b82f6' }))
      : [{ id: 'inc_default', label: 'Salaire / Revenus', value: totalRef, color: '#3b82f6' }];

    const incomeNodes = computeLayout(incomeItems, X0_bar, usableH * 0.7);
    incomeNodes.forEach(n => nodeList.push(n));

    // --- COLUMN 1: TOTAL BUDGET ---
    const budgetH = Math.max(40, (totalIncome / totalRef) * usableH * 0.75);
    const budgetY = topPadding + (usableH - budgetH) / 2;
    const budgetNode: NodeData = {
      id: 'node_budget',
      label: 'Budget',
      value: totalIncome,
      color: '#f97316', // Vibrant Finary Orange
      x: X1,
      y: budgetY,
      height: budgetH,
      percent: 100,
    };
    nodeList.push(budgetNode);

    // Flows: Incomes -> Budget
    let budgetInOffset = 0;
    incomeNodes.forEach(incNode => {
      const flowFraction = incNode.value / (totalIncome || 1);
      const flowHOnBudget = flowFraction * budgetH;
      flowList.push({
        id: `flow_${incNode.id}_budget`,
        sourceId: incNode.id,
        targetId: budgetNode.id,
        sourceX: X0_bar,
        targetX: X1,
        sourceY0: incNode.y,
        sourceY1: incNode.y + incNode.height,
        targetY0: budgetY + budgetInOffset,
        targetY1: budgetY + budgetInOffset + flowHOnBudget,
        value: incNode.value,
        color: '#93c5fd', // Soft blue ribbon
      });
      budgetInOffset += flowHOnBudget;
    });

    // --- COLUMN 2: PILLARS ---
    const pillarDefs = [
      { id: 'p_invest', label: pillarInvest.name, value: pillarInvest.total, color: pillarInvest.color, ribbon: pillarInvest.ribbon },
      { id: 'p_housing', label: pillarHousing.name, value: pillarHousing.total, color: pillarHousing.color, ribbon: pillarHousing.ribbon },
      { id: 'p_daily', label: pillarDaily.name, value: pillarDaily.total, color: pillarDaily.color, ribbon: pillarDaily.ribbon },
      { id: 'p_subs', label: pillarSubs.name, value: pillarSubs.total, color: pillarSubs.color, ribbon: pillarSubs.ribbon },
    ].filter(p => p.value > 0);

    if (remainingSurplus > 0) {
      pillarDefs.push({
        id: 'p_surplus',
        label: 'Reste disponible',
        value: remainingSurplus,
        color: '#10b981',
        ribbon: '#34d399',
      });
    }

    const pillarNodes = computeLayout(pillarDefs, X2, usableH * 0.85);
    pillarNodes.forEach(n => nodeList.push(n));

    // Flows: Budget -> Pillars
    let budgetOutOffset = 0;
    pillarNodes.forEach(pNode => {
      const flowFraction = pNode.value / (totalIncome || 1);
      const flowHOnBudget = flowFraction * budgetH;

      flowList.push({
        id: `flow_budget_${pNode.id}`,
        sourceId: budgetNode.id,
        targetId: pNode.id,
        sourceX: X1,
        targetX: X2,
        sourceY0: budgetY + budgetOutOffset,
        sourceY1: budgetY + budgetOutOffset + flowHOnBudget,
        targetY0: pNode.y,
        targetY1: pNode.y + pNode.height,
        value: pNode.value,
        color: '#fed7aa', // Peach ribbon
      });
      budgetOutOffset += flowHOnBudget;
    });

    // --- COLUMN 3: DETAILED SUB-ITEMS ---
    const allDetailItems: { id: string; label: string; value: number; color: string; pillarId: string }[] = [];

    pillarInvest.items.forEach(it => {
      allDetailItems.push({ id: `item_${it.id}`, label: it.name, value: it.value, color: pillarInvest.color, pillarId: 'p_invest' });
    });
    pillarHousing.items.forEach(it => {
      allDetailItems.push({ id: `item_${it.id}`, label: it.name, value: it.value, color: pillarHousing.color, pillarId: 'p_housing' });
    });
    pillarDaily.items.forEach(it => {
      allDetailItems.push({ id: `item_${it.id}`, label: it.name, value: it.value, color: pillarDaily.color, pillarId: 'p_daily' });
    });
    pillarSubs.items.forEach(it => {
      allDetailItems.push({ id: `item_${it.id}`, label: it.name, value: it.value, color: pillarSubs.color, pillarId: 'p_subs' });
    });
    if (remainingSurplus > 0) {
      allDetailItems.push({ id: 'item_surplus', label: 'Épargne libre / Imprévus', value: remainingSurplus, color: '#10b981', pillarId: 'p_surplus' });
    }

    const detailNodes = computeLayout(allDetailItems, X3, usableH);
    detailNodes.forEach(n => nodeList.push(n));

    // Flows: Pillars -> Detailed Items
    pillarNodes.forEach(pNode => {
      const childNodes = detailNodes.filter(d => d.pillarId === pNode.id);
      let pOutOffset = 0;
      const pColorDef = pillarDefs.find(pd => pd.id === pNode.id);
      const ribbonColor = pColorDef?.ribbon || pNode.color;

      childNodes.forEach(childNode => {
        const flowFraction = childNode.value / (pNode.value || 1);
        const flowHOnPillar = flowFraction * pNode.height;

        flowList.push({
          id: `flow_${pNode.id}_${childNode.id}`,
          sourceId: pNode.id,
          targetId: childNode.id,
          sourceX: X2,
          targetX: X3,
          sourceY0: pNode.y + pOutOffset,
          sourceY1: pNode.y + pOutOffset + flowHOnPillar,
          targetY0: childNode.y,
          targetY1: childNode.y + childNode.height,
          value: childNode.value,
          color: ribbonColor,
        });
        pOutOffset += flowHOnPillar;
      });
    });

    return {
      width: W,
      height: H,
      nodes: nodeList,
      flows: flowList,
      totalReference: totalRef,
    };
  }, [
    incomes,
    totalIncome,
    pillarInvest,
    pillarHousing,
    pillarSubs,
    pillarDaily,
    remainingSurplus,
    activeItemsCount,
  ]);

  // Bézier path generator
  const createFlowPath = (f: FlowData): string => {
    const curvature = 0.48;
    const dx = f.targetX - f.sourceX;
    const cp1x = f.sourceX + dx * curvature;
    const cp2x = f.targetX - dx * curvature;

    return `
      M ${f.sourceX} ${f.sourceY0}
      C ${cp1x} ${f.sourceY0}, ${cp2x} ${f.targetY0}, ${f.targetX} ${f.targetY0}
      L ${f.targetX} ${f.targetY1}
      C ${cp2x} ${f.targetY1}, ${cp1x} ${f.sourceY1}, ${f.sourceX} ${f.sourceY1}
      Z
    `;
  };

  // Export diagram as PNG
  const exportImage = () => {
    const svg = document.getElementById('sankey-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = `MADFIN_Flux_${currentMonth}_${currentYear}.png`;
        a.href = url;
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Month Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Flux de trésorerie
        </h2>

        {/* View Mode & Month Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {currentMonthLabel}
            </button>
            <button
              onClick={() => setViewMode('annualAverage')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'annualAverage'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Moyenne
            </button>
          </div>

          {/* Month Selector Dropdown if in month mode */}
          {viewMode === 'month' && (
            <select
              value={currentMonth}
              onChange={(e) => onSelectMonth(e.target.value as MonthKey)}
              className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer"
            >
              {MONTHS.map(m => (
                <option key={m.key} value={m.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {m.label} {currentYear}
                </option>
              ))}
            </select>
          )}

          {/* Export PNG & PDF buttons */}
          <div className="flex items-center gap-1 pl-1 print:hidden">
            <button
              onClick={exportImage}
              title="Exporter l'image du flux (PNG)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PNG</span>
            </button>
            <button
              onClick={async () => {
                if (isGeneratingPDF) return;
                setIsGeneratingPDF(true);
                try {
                  await generateFlowPDF(currentMonth, currentYear, 'sankey-svg');
                  setPdfSuccess(true);
                  setTimeout(() => setPdfSuccess(false), 2000);
                } catch (e) {
                  console.error(e);
                  alert('Erreur lors de la génération du PDF');
                } finally {
                  setIsGeneratingPDF(false);
                }
              }}
              disabled={isGeneratingPDF}
              title="Exporter le diagramme en PDF (Haute Définition A4 Paysage)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              {pdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline text-emerald-500">Téléchargé</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isGeneratingPDF ? 'PDF...' : 'PDF'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sankey Canvas Container */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Pillar Summary Pills with Percentages */}
        <div className="flex flex-wrap items-center gap-4 pb-3 mb-2 border-b border-slate-900 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-300 font-medium">Revenus {formatCurrency(totalIncome)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-slate-300 font-medium">
              Épargne {formatCurrency(pillarInvest.total)} <strong className="text-rose-400">({totalIncome > 0 ? Math.round((pillarInvest.total / totalIncome) * 100) : 0}%)</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-slate-300 font-medium">
              Logement {formatCurrency(pillarHousing.total)} <strong className="text-purple-400">({totalIncome > 0 ? Math.round((pillarHousing.total / totalIncome) * 100) : 0}%)</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-slate-300 font-medium">
              Abonnements {formatCurrency(pillarSubs.total)} <strong className="text-teal-400">({totalIncome > 0 ? Math.round((pillarSubs.total / totalIncome) * 100) : 0}%)</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-slate-300 font-medium">
              Vie quotidienne {formatCurrency(pillarDaily.total)} <strong className="text-indigo-400">({totalIncome > 0 ? Math.round((pillarDaily.total / totalIncome) * 100) : 0}%)</strong>
            </span>
          </div>
          {remainingSurplus > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-medium">
                Reste libre {formatCurrency(remainingSurplus)} <strong className="text-emerald-400">({totalIncome > 0 ? Math.round((remainingSurplus / totalIncome) * 100) : 0}%)</strong>
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Container on Mobile */}
        <div className="overflow-x-auto no-scrollbar py-2">
          <div className="min-w-[880px] lg:min-w-full">
            <svg
              id="sankey-svg"
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none font-sans"
              style={{ maxHeight: '720px' }}
            >
              <defs>
                {/* Linear gradients for ribbons */}
                {flows.map(f => (
                  <linearGradient
                    key={`grad_${f.id}`}
                    id={`grad_${f.id}`}
                    x1={f.sourceX}
                    y1="0"
                    x2={f.targetX}
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={f.color} stopOpacity={hoveredFlow === f.id ? 0.85 : 0.45} />
                    <stop offset="100%" stopColor={f.color} stopOpacity={hoveredFlow === f.id ? 0.95 : 0.55} />
                  </linearGradient>
                ))}
              </defs>

              {/* 1. FLOW RIBBONS */}
              <g className="flows">
                {flows.map(f => {
                  const isHighlighted =
                    hoveredFlow === f.id ||
                    hoveredNode === f.sourceId ||
                    hoveredNode === f.targetId;
                  const isDimmed =
                    (hoveredFlow && !isHighlighted) ||
                    (hoveredNode && !isHighlighted);

                  return (
                    <path
                      key={f.id}
                      d={createFlowPath(f)}
                      fill={`url(#grad_${f.id})`}
                      className="transition-all duration-200 cursor-pointer"
                      style={{
                        opacity: isDimmed ? 0.15 : isHighlighted ? 1 : 0.75,
                        filter: isHighlighted ? 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))' : 'none',
                      }}
                      onMouseEnter={() => setHoveredFlow(f.id)}
                      onMouseLeave={() => setHoveredFlow(null)}
                    >
                      <title>{`${formatCurrency(f.value)}`}</title>
                    </path>
                  );
                })}
              </g>

              {/* 2. NODES (Vertical Pillars & Bars) */}
              <g className="nodes">
                {nodes.map(node => {
                  const isHovered = hoveredNode === node.id;
                  const isDimmed = hoveredNode && !isHovered && !flows.some(f => (f.sourceId === node.id && f.targetId === hoveredNode) || (f.targetId === node.id && f.sourceId === hoveredNode));

                  // Node bar thickness
                  const barWidth = 6;
                  const isBudget = node.id === 'node_budget';
                  const isIncome = node.id.startsWith('inc_');
                  const isPillar = node.id.startsWith('p_');
                  const isDetail = node.id.startsWith('item_');

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer transition-opacity duration-200"
                      style={{ opacity: isDimmed ? 0.35 : 1 }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Vertical Color Pillar / Line */}
                      <rect
                        x={node.x - barWidth / 2}
                        y={node.y}
                        width={barWidth}
                        height={node.height}
                        rx={3}
                        fill={node.color}
                        className="transition-all duration-150"
                        style={{
                          filter: isHovered ? `drop-shadow(0 0 8px ${node.color})` : 'none',
                        }}
                      />

                      {/* Text Labels */}
                      {isIncome && (
                        <text
                          x={node.x - 14}
                          y={node.y + node.height / 2 + 4}
                          textAnchor="end"
                          fill="#f1f5f9"
                          fontSize="11"
                          fontWeight="600"
                          fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
                          className="fill-slate-100 text-[11px] font-semibold"
                        >
                          {node.label}: {formatCurrency(node.value)}
                        </text>
                      )}

                      {isBudget && (
                        <text
                          x={node.x - 14}
                          y={node.y + node.height / 2 + 4}
                          textAnchor="end"
                          fill="#fde047"
                          fontSize="12"
                          fontWeight="800"
                          fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
                          className="fill-amber-300 text-[12px] font-black"
                        >
                          Budget: {formatCurrency(node.value)}
                        </text>
                      )}

                      {isPillar && (
                        <text
                          x={node.x - 14}
                          y={node.y + node.height / 2 + 4}
                          textAnchor="end"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="700"
                          fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
                          className="fill-white text-[11px] font-bold"
                        >
                          {node.label}: {formatCurrency(node.value)} ({node.percent}%)
                        </text>
                      )}

                      {isDetail && (
                        <>
                          <text
                            x={node.x - 14}
                            y={node.y + node.height / 2 + 4}
                            textAnchor="end"
                            fill="#cbd5e1"
                            fontSize="10.5"
                            fontWeight="500"
                            fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
                            className="fill-slate-300 text-[10.5px] font-medium"
                          >
                            {node.label}: {formatCurrency(node.value)} ({node.percent}%)
                          </text>

                          {/* Colored square / pip on right */}
                          <rect
                            x={node.x + 8}
                            y={node.y + node.height / 2 - 3}
                            width={6}
                            height={6}
                            rx={1.5}
                            fill={node.color}
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* 3. Powered By MADFIN branding at bottom left */}
              <g transform={`translate(40, ${height - 25})`}>
                <text
                  fill="#64748b"
                  fontSize="10"
                  fontWeight="600"
                  letterSpacing="1"
                  fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
                >
                  POWERED BY <tspan fill="#10b981" fontWeight="800">MADFIN</tspan>
                </text>
              </g>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
};
