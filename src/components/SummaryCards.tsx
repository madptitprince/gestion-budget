import React from 'react';
import { 
  TrendingUp, 
  ArrowDownRight, 
  PiggyBank, 
  ShoppingBag, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { MonthSummary } from '../types/budget';

interface SummaryCardsProps {
  summary: MonthSummary;
}

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(val || 0)
    .replace(/[\u202f\u00a0]/g, ' ');
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const isPositive = summary.remainingNet >= 0;
  const inc = summary.totalIncome || 1;

  const fixedPct = summary.totalIncome > 0 ? Math.round((summary.totalFixed / inc) * 100) : 0;
  const savingsPct = summary.totalIncome > 0 ? Math.round((summary.totalSavings / inc) * 100) : 0;
  const varPct = summary.totalIncome > 0 ? Math.round((summary.totalVariable / inc) * 100) : 0;
  const remainingPct = summary.totalIncome > 0 ? Math.round((summary.remainingNet / inc) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
      {/* 1. Revenus */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Revenus</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(summary.totalIncome)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">100%</span>
        </div>
      </div>

      {/* 2. Charges Fixes */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Charges fixes</span>
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ArrowDownRight className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(summary.totalFixed)}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
            {fixedPct}%
          </span>
        </div>
      </div>

      {/* 3. Épargne & DCA */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Épargne & DCA</span>
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <PiggyBank className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(summary.totalSavings)}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400">
            {savingsPct}%
          </span>
        </div>
      </div>

      {/* 4. Dépenses Variables */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Variables</span>
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(summary.totalVariable)}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400">
            {varPct}%
          </span>
        </div>
      </div>

      {/* 5. Reste à vivre */}
      <div className={`col-span-2 lg:col-span-1 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between border shadow-sm transition-colors ${
        isPositive
          ? 'bg-emerald-50/60 dark:bg-slate-900/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-400'
          : 'bg-rose-50/60 dark:bg-slate-900/80 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-400'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reste à vivre</span>
          <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'}`}>
            {isPositive ? <Sparkles className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black tracking-tight">
            {formatCurrency(summary.remainingNet)}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            isPositive ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}>
            {remainingPct}%
          </span>
        </div>
      </div>
    </div>
  );
};
