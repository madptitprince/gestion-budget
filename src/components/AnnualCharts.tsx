import React, { useState } from 'react';
import { BudgetYearData, MonthKey, BudgetItem } from '../types/budget';
import { MONTHS } from '../data/initialData';
import { formatCurrency } from './SummaryCards';
import { TrendingUp, PieChart, BarChart2 } from 'lucide-react';

interface AnnualChartsProps {
  currentYear: string;
  yearData: BudgetYearData;
  currentMonth: MonthKey;
}

export const AnnualCharts: React.FC<AnnualChartsProps> = ({
  currentYear,
  yearData,
  currentMonth,
}) => {
  const [selectedChartMonth, setSelectedChartMonth] = useState<MonthKey>(currentMonth);

  const sumSectionMonth = (items: BudgetItem[], mKey: MonthKey) =>
    items.reduce((acc, item) => acc + (item.values[mKey] || 0), 0);

  // Monthly stats
  const monthlyData = MONTHS.map((m) => {
    const inc = sumSectionMonth(yearData.income, m.key);
    const fix = sumSectionMonth(yearData.fixedExpenses, m.key);
    const sav = sumSectionMonth(yearData.savings, m.key);
    const varExp = sumSectionMonth(yearData.variableExpenses, m.key);
    const net = inc - (fix + sav + varExp);

    return {
      monthKey: m.key,
      short: m.short,
      label: m.label,
      income: inc,
      fixed: fix,
      savings: sav,
      variable: varExp,
      net: net,
    };
  });

  const maxVal = Math.max(
    ...monthlyData.map(d => Math.max(d.income, d.fixed + d.savings + d.variable, 100)),
    500
  );

  // Cumulative savings calculation
  let runningSavings = 0;
  const cumulativeSavings = monthlyData.map((d) => {
    runningSavings += d.savings;
    return {
      month: d.short,
      total: runningSavings,
    };
  });
  const maxSavings = Math.max(runningSavings, 500);

  // Selected month breakdown
  const selData = monthlyData.find(d => d.monthKey === selectedChartMonth) || monthlyData[0];
  const selTotalExpenses = selData.fixed + selData.savings + selData.variable;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Analyses Financières {currentYear}
        </h2>

        {/* Month selector for the donut */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 self-start shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400">Mois :</span>
          <select
            value={selectedChartMonth}
            onChange={(e) => setSelectedChartMonth(e.target.value as MonthKey)}
            className="bg-transparent text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer"
          >
            {MONTHS.map(m => (
              <option key={m.key} value={m.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Bar Chart: Cashflow 12 Months */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <BarChart2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Flux Mensuels</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Revenus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span>Épargne</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>Dépenses</span>
              </div>
            </div>
          </div>

          {/* SVG Barchart */}
          <div className="h-64 w-full flex items-end justify-between gap-1 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
            {monthlyData.map((d) => {
              const incHeight = (d.income / maxVal) * 100;
              const expHeight = ((d.fixed + d.variable) / maxVal) * 100;
              const savHeight = (d.savings / maxVal) * 100;

              return (
                <div
                  key={d.monthKey}
                  onClick={() => setSelectedChartMonth(d.monthKey)}
                  className={`flex-1 flex flex-col items-center justify-end h-full gap-1 cursor-pointer group rounded-lg p-1 transition-all ${
                    selectedChartMonth === d.monthKey ? 'bg-slate-100 dark:bg-slate-800/60 ring-1 ring-emerald-500/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    <div
                      style={{ height: `${Math.max(incHeight, 2)}%` }}
                      className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-sm group-hover:brightness-110 transition-all"
                      title={`Revenus : ${formatCurrency(d.income)}`}
                    />
                    <div
                      style={{ height: `${Math.max(expHeight, 2)}%` }}
                      className="w-1.5 sm:w-2 bg-rose-500/80 rounded-t-sm group-hover:brightness-110 transition-all"
                      title={`Dépenses : ${formatCurrency(d.fixed + d.variable)}`}
                    />
                    <div
                      style={{ height: `${Math.max(savHeight, 2)}%` }}
                      className="w-1.5 sm:w-2 bg-purple-500 rounded-t-sm group-hover:brightness-110 transition-all"
                      title={`Épargne : ${formatCurrency(d.savings)}`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-1">
                    {d.short}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 text-center">
            Passez la souris pour afficher les montants. Cliquez pour sélectionner le mois.
          </div>
        </div>

        {/* Donut / Pie Breakdown for Selected Month */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parts {selData.label}</h3>
              <p className="text-[11px] text-slate-400">Total sorties : {formatCurrency(selTotalExpenses)}</p>
            </div>
          </div>

          {selTotalExpenses === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400">
              Aucune dépense enregistrée sur ce mois.
            </div>
          ) : (
            <div className="space-y-4 my-auto">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Charges Fixes</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selData.fixed)} ({Math.round((selData.fixed / selTotalExpenses) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(selData.fixed / selTotalExpenses) * 100}%` }}
                    className="bg-blue-500 h-full rounded-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">Épargne & Investissements</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selData.savings)} ({Math.round((selData.savings / selTotalExpenses) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(selData.savings / selTotalExpenses) * 100}%` }}
                    className="bg-purple-500 h-full rounded-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-rose-600 dark:text-rose-400 font-medium">Dépenses Variables</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selData.variable)} ({Math.round((selData.variable / selTotalExpenses) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(selData.variable / selTotalExpenses) * 100}%` }}
                    className="bg-rose-500 h-full rounded-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Reste à vivre du mois :</span>
            <span className={`font-bold ${selData.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(selData.net)}
            </span>
          </div>
        </div>
      </div>

      {/* Cumulative Savings Chart */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accumulation de l'Épargne & Investissements</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Livret A + PEA + Bitcoin + Assurance Vie sur l'année</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total annuel :</span>
            <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">{formatCurrency(runningSavings)}</div>
          </div>
        </div>

        {/* SVG Area curve */}
        <div className="h-44 w-full flex items-end justify-between gap-2 pt-4 px-2 border-b border-slate-200 dark:border-slate-800">
          {cumulativeSavings.map((d) => {
            const heightPercent = (d.total / maxSavings) * 100;
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full group">
                <div
                  style={{ height: `${Math.max(heightPercent, 4)}%` }}
                  className="w-full bg-gradient-to-t from-purple-200 dark:from-purple-900/40 to-purple-500 rounded-t-lg group-hover:brightness-110 transition-all relative"
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap shadow z-10">
                    {formatCurrency(d.total)}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
