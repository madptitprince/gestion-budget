import React from 'react';
import { BudgetYearData, MonthKey, BudgetItem } from '../types/budget';
import { MONTHS } from '../data/initialData';
import { formatCurrency } from './SummaryCards';
import { FileDown, Sparkles } from 'lucide-react';

interface YearOverviewProps {
  currentYear: string;
  yearData: BudgetYearData;
  onSelectMonth: (month: MonthKey) => void;
  onExportPDF?: () => void;
}

export const YearOverview: React.FC<YearOverviewProps> = ({
  currentYear,
  yearData,
  onSelectMonth,
  onExportPDF,
}) => {
  const sumRow = (item: BudgetItem) =>
    MONTHS.reduce((acc, m) => acc + (item.values[m.key] || 0), 0);

  const sumSectionMonth = (items: BudgetItem[], mKey: MonthKey) =>
    items.reduce((acc, item) => acc + (item.values[mKey] || 0), 0);

  const sumSectionTotal = (items: BudgetItem[]) =>
    items.reduce((acc, item) => acc + sumRow(item), 0);

  // Compute monthly grand totals
  const monthlyTotals = MONTHS.map(m => {
    const inc = sumSectionMonth(yearData.income, m.key);
    const fix = sumSectionMonth(yearData.fixedExpenses, m.key);
    const sav = sumSectionMonth(yearData.savings, m.key);
    const varExp = sumSectionMonth(yearData.variableExpenses, m.key);
    const outflows = fix + sav + varExp;
    const net = inc - outflows;
    const rate = inc > 0 ? Math.round((sav / inc) * 100) : 0;
    return {
      monthKey: m.key,
      income: inc,
      fixed: fix,
      savings: sav,
      variable: varExp,
      outflows,
      net,
      savingsRate: rate,
    };
  });

  const annualIncome = sumSectionTotal(yearData.income);
  const annualFixed = sumSectionTotal(yearData.fixedExpenses);
  const annualSavings = sumSectionTotal(yearData.savings);
  const annualVariable = sumSectionTotal(yearData.variableExpenses);
  const annualOutflows = annualFixed + annualSavings + annualVariable;
  const annualNet = annualIncome - annualOutflows;
  const annualSavingsRate = annualIncome > 0 ? Math.round((annualSavings / annualIncome) * 100) : 0;

  const renderSectionRows = (
    title: string,
    items: BudgetItem[],
    headerColor: string,
    totalBgColor: string
  ) => {
    const activeItems = items.filter(i => sumRow(i) > 0);
    const displayItems = activeItems.length > 0 ? activeItems : items.slice(0, 5);

    return (
      <>
        {/* Section Header */}
        <tr className={`${headerColor} border-t-2 border-slate-700/60 dark:border-slate-700`}>
          <td colSpan={14} className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {title}
          </td>
        </tr>

        {/* Item Rows */}
        {displayItems.map((item, idx) => {
          const rowTotal = sumRow(item);
          return (
            <tr key={`${item.id}_${idx}`} className="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900/90 z-10 backdrop-blur-sm">
                {item.name}
              </td>
              {MONTHS.map((m) => {
                const val = item.values[m.key] || 0;
                return (
                  <td
                    key={m.key}
                    onClick={() => onSelectMonth(m.key)}
                    className="py-2 px-3 text-xs text-right font-mono text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 cursor-pointer"
                  >
                    {val > 0 ? val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                  </td>
                );
              })}
              <td className="py-2 px-4 text-xs text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100/60 dark:bg-slate-800/40">
                {formatCurrency(rowTotal)}
              </td>
            </tr>
          );
        })}

        {/* Section Total Row */}
        <tr className={`${totalBgColor} font-bold text-xs border-b border-slate-300 dark:border-slate-700`}>
          <td className="py-2 px-4 sticky left-0 z-10 bg-inherit whitespace-nowrap text-slate-900 dark:text-white">
            Sous-total {title}
          </td>
          {MONTHS.map((m) => {
            const secTotal = sumSectionMonth(items, m.key);
            return (
              <td key={m.key} className="py-2 px-3 text-right font-mono text-slate-900 dark:text-white">
                {secTotal > 0 ? secTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
              </td>
            );
          })}
          <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-white font-extrabold">
            {formatCurrency(sumSectionTotal(items))}
          </td>
        </tr>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Tableau Annuel {currentYear}
        </h2>
        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-slate-100 text-xs font-semibold shadow-sm transition-all active:scale-95 print:hidden"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exporter PDF</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4 sticky left-0 bg-slate-100 dark:bg-slate-950 z-20 min-w-[200px]">Poste</th>
                {MONTHS.map((m) => (
                  <th
                    key={m.key}
                    onClick={() => onSelectMonth(m.key)}
                    className="py-3 px-3 text-right min-w-[85px] hover:text-emerald-500 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                  >
                    {m.short}
                  </th>
                ))}
                <th className="py-3 px-4 text-right min-w-[120px] text-slate-900 dark:text-white">Total Annuel</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. REVENUS */}
              {renderSectionRows(
                'Revenus',
                yearData.income,
                'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
                'bg-emerald-100/60 dark:bg-emerald-950/50'
              )}

              {/* 2. DÉPENSES FIXES */}
              {renderSectionRows(
                'Charges Fixes',
                yearData.fixedExpenses,
                'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
                'bg-blue-100/60 dark:bg-blue-950/50'
              )}

              {/* 3. ÉPARGNE & INVESTISSEMENTS */}
              {renderSectionRows(
                'Épargne & Investissements',
                yearData.savings,
                'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
                'bg-purple-100/60 dark:bg-purple-950/50'
              )}

              {/* 4. DÉPENSES VARIABLES */}
              {renderSectionRows(
                'Dépenses Variables',
                yearData.variableExpenses,
                'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400',
                'bg-rose-100/60 dark:bg-rose-950/50'
              )}

              {/* === SYNTHÈSE TOTAUX DES MOIS === */}
              <tr className="bg-slate-900 text-white border-t-4 border-slate-700">
                <td colSpan={14} className="py-2.5 px-4 font-black text-xs uppercase tracking-wider text-emerald-400 bg-slate-950">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Synthèse des Totaux Mensuels</span>
                  </div>
                </td>
              </tr>

              {/* Row: Total Sorties du mois */}
              <tr className="bg-slate-100 dark:bg-slate-900/90 font-bold border-b border-slate-200 dark:border-slate-800">
                <td className="py-2.5 px-4 sticky left-0 z-10 bg-inherit text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  Total Sorties (Fixes + Épargne + Var)
                </td>
                {monthlyTotals.map((mt) => (
                  <td key={mt.monthKey} className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                    {mt.outflows > 0 ? mt.outflows.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                  {formatCurrency(annualOutflows)}
                </td>
              </tr>

              {/* Row: Reste à Vivre Net du mois */}
              <tr className="bg-slate-200/80 dark:bg-slate-950 font-black border-b-2 border-slate-400 dark:border-slate-700">
                <td className="py-3 px-4 sticky left-0 z-10 bg-inherit whitespace-nowrap text-slate-900 dark:text-white">
                  SOLDE NET / RESTE À VIVRE
                </td>
                {monthlyTotals.map((mt) => {
                  const isPos = mt.net >= 0;
                  return (
                    <td
                      key={mt.monthKey}
                      className={`py-3 px-3 text-right font-mono font-extrabold ${
                        mt.income === 0 && mt.outflows === 0
                          ? 'text-slate-400'
                          : isPos
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {mt.income === 0 && mt.outflows === 0
                        ? '-'
                        : mt.net.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className={`py-3 px-4 text-right font-mono font-black text-sm ${
                  annualNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatCurrency(annualNet)}
                </td>
              </tr>

              {/* Row: Taux d'épargne du mois */}
              <tr className="bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold border-b border-purple-200 dark:border-purple-900/50">
                <td className="py-2 px-4 sticky left-0 z-10 bg-inherit whitespace-nowrap">
                  Taux d'Épargne (%)
                </td>
                {monthlyTotals.map((mt) => (
                  <td key={mt.monthKey} className="py-2 px-3 text-right font-mono">
                    {mt.income > 0 ? `${mt.savingsRate}%` : '-'}
                  </td>
                ))}
                <td className="py-2 px-4 text-right font-mono font-extrabold">
                  {annualSavingsRate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
