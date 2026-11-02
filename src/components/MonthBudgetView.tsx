import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Wallet, 
  Home, 
  TrendingUp, 
  ShoppingBag,
  Search,
  Check
} from 'lucide-react';
import { MonthKey, BudgetYearData, BudgetItem, MonthSummary } from '../types/budget';
import { MONTHS } from '../data/initialData';
import { formatCurrency } from './SummaryCards';

interface MonthBudgetViewProps {
  currentMonth: MonthKey;
  currentYear: string;
  yearData: BudgetYearData;
  summary: MonthSummary;
  onUpdateValue: (section: keyof BudgetYearData, itemId: string, month: MonthKey, val: number) => void;
  onAddItem: (section: keyof BudgetYearData, name: string) => void;
  onDeleteItem: (section: keyof BudgetYearData, itemId: string) => void;
  onDuplicateFromPreviousMonth: (targetMonth: MonthKey) => void;
}

export const MonthBudgetView: React.FC<MonthBudgetViewProps> = ({
  currentMonth,
  currentYear,
  yearData,
  summary,
  onUpdateValue,
  onAddItem,
  onDeleteItem,
  onDuplicateFromPreviousMonth,
}) => {
  const currentMonthLabel = MONTHS.find(m => m.key === currentMonth)?.label || currentMonth;
  const monthIndex = MONTHS.findIndex(m => m.key === currentMonth);
  const prevMonthLabel = monthIndex > 0 ? MONTHS[monthIndex - 1].label : null;

  const [copiedNotification, setCopiedNotification] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newIncomeName, setNewIncomeName] = useState('');
  const [newFixedName, setNewFixedName] = useState('');
  const [newSavingsName, setNewSavingsName] = useState('');
  const [newVarName, setNewVarName] = useState('');

  const handleDuplicate = () => {
    if (window.confirm(`Copier les charges fixes et l'épargne de ${prevMonthLabel} vers ${currentMonthLabel} ?`)) {
      onDuplicateFromPreviousMonth(currentMonth);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  const renderSection = (
    title: string,
    sectionKey: keyof BudgetYearData,
    icon: React.ReactNode,
    colorClasses: { bg: string; text: string; accent: string; badge: string },
    items: BudgetItem[],
    sectionTotal: number,
    newNameInput: string,
    setNewNameInput: (s: string) => void
  ) => {
    const filteredItems = items.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const shareOfIncome = summary.totalIncome > 0 ? Math.round((sectionTotal / summary.totalIncome) * 100) : 0;

    return (
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-sm transition-colors">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${colorClasses.bg} ${colorClasses.text}`}>
              {icon}
            </div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${colorClasses.accent}`}>
              {formatCurrency(sectionTotal)}
            </span>
            {sectionKey !== 'income' && summary.totalIncome > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClasses.badge}`}>
                {shareOfIncome}%
              </span>
            )}
          </div>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/40 max-h-[360px] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Aucune ligne trouvée.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const val = item.values[currentMonth] || 0;
              const itemShare = summary.totalIncome > 0 && val > 0 ? Math.round((val / summary.totalIncome) * 100) : 0;

              return (
                <div
                  key={`${item.id}_${idx}`}
                  className="group px-4 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={item.name}>
                      {item.name}
                    </span>
                    {itemShare > 0 && (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        ({itemShare}%)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={val === 0 ? '' : val}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        onUpdateValue(sectionKey, item.id, currentMonth, isNaN(parsed) ? 0 : parsed);
                      }}
                      className="w-24 text-right px-2 py-1 text-xs font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />

                    <button
                      onClick={() => onDeleteItem(sectionKey, item.id)}
                      title="Supprimer"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Row Input */}
        <div className="p-2 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 mt-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newNameInput.trim()) {
                onAddItem(sectionKey, newNameInput.trim());
                setNewNameInput('');
              }
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              placeholder="+ Ajouter une ligne..."
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!newNameInput.trim()}
              className="p-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    );
  };

  const fixedPercent = summary.totalIncome > 0 ? (summary.totalFixed / summary.totalIncome) * 100 : 0;
  const savingsPercent = summary.totalIncome > 0 ? (summary.totalSavings / summary.totalIncome) * 100 : 0;
  const variablePercent = summary.totalIncome > 0 ? (summary.totalVariable / summary.totalIncome) * 100 : 0;
  const remainingPercent = Math.max(0, 100 - (fixedPercent + savingsPercent + variablePercent));

  return (
    <div className="space-y-4">
      {/* Clean Top Bar: Month Title, Filter & Duplicate */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {currentMonthLabel} {currentYear}
        </h2>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filtrer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          {/* Duplicate previous month */}
          {prevMonthLabel && (
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-all active:scale-95 whitespace-nowrap shadow-sm"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reprendre {prevMonthLabel}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Sleek Minimal Cashflow Progress Bar with % */}
      {summary.totalIncome > 0 && (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, fixedPercent)}%` }}
              className="bg-blue-500"
              title={`Fixes : ${formatCurrency(summary.totalFixed)} (${Math.round(fixedPercent)}%)`}
            />
            <div
              style={{ width: `${Math.min(100 - fixedPercent, savingsPercent)}%` }}
              className="bg-purple-500"
              title={`Épargne : ${formatCurrency(summary.totalSavings)} (${Math.round(savingsPercent)}%)`}
            />
            <div
              style={{ width: `${Math.min(100 - (fixedPercent + savingsPercent), variablePercent)}%` }}
              className="bg-rose-500"
              title={`Variables : ${formatCurrency(summary.totalVariable)} (${Math.round(variablePercent)}%)`}
            />
            <div
              style={{ width: `${Math.max(0, remainingPercent)}%` }}
              className="bg-emerald-500"
              title={`Reste libre : ${formatCurrency(summary.remainingNet)} (${Math.round(remainingPercent)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-0.5">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 
                Fixes <strong className="text-slate-700 dark:text-slate-200">{Math.round(fixedPercent)}%</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> 
                Épargne <strong className="text-slate-700 dark:text-slate-200">{Math.round(savingsPercent)}%</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 
                Variables <strong className="text-slate-700 dark:text-slate-200">{Math.round(variablePercent)}%</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 
                Reste <strong className="text-slate-700 dark:text-slate-200">{Math.round(remainingPercent)}%</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {renderSection(
          'Revenus',
          'income',
          <Wallet className="w-3.5 h-3.5" />,
          { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', accent: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400' },
          yearData.income,
          summary.totalIncome,
          newIncomeName,
          setNewIncomeName
        )}

        {renderSection(
          'Charges fixes',
          'fixedExpenses',
          <Home className="w-3.5 h-3.5" />,
          { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', accent: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-400' },
          yearData.fixedExpenses,
          summary.totalFixed,
          newFixedName,
          setNewFixedName
        )}

        {renderSection(
          'Épargne & Investissements',
          'savings',
          <TrendingUp className="w-3.5 h-3.5" />,
          { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', accent: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-400' },
          yearData.savings,
          summary.totalSavings,
          newSavingsName,
          setNewSavingsName
        )}

        {renderSection(
          'Dépenses variables',
          'variableExpenses',
          <ShoppingBag className="w-3.5 h-3.5" />,
          { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', accent: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-400' },
          yearData.variableExpenses,
          summary.totalVariable,
          newVarName,
          setNewVarName
        )}
      </div>
    </div>
  );
};
