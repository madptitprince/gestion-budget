import React, { useState } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { MonthKey, BudgetYearData } from '../types/budget';
import { MONTHS } from '../data/initialData';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: MonthKey;
  yearData: BudgetYearData;
  onAddQuickExpense: (categoryName: string, amount: number, month: MonthKey) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  currentMonth,
  yearData,
  onAddQuickExpense,
}) => {
  if (!isOpen) return null;

  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Courses alimentaires');
  const [targetMonth, setTargetMonth] = useState<MonthKey>(currentMonth);

  const quickCategories = [
    'Courses alimentaires',
    'Restaurants / bars',
    'Transports en commun',
    'Vêtements',
    'Épargne Livret A',
    'DCA PEA',
    'Vacances / voyages'
  ];

  const allCategories = [
    ...yearData.variableExpenses.map(i => i.name),
    ...yearData.savings.map(i => i.name),
    ...yearData.fixedExpenses.map(i => i.name),
    ...yearData.income.map(i => i.name),
  ];
  const uniqueCategories = Array.from(new Set(allCategories));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0 && selectedCategory.trim()) {
      onAddQuickExpense(selectedCategory.trim(), parsedAmount, targetMonth);
      onClose();
      setAmount('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors"
      >
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Dépense Express</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Montant (€)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Ex: 35.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-4 top-3 text-xl font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                €
              </span>
            </div>
          </div>

          {/* Quick chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Suggestions rapides
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickCategories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-xl font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Category Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Catégorie
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {uniqueCategories.map((c) => (
                <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Target Month */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Mois
            </label>
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value as MonthKey)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.key} value={m.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Ajouter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
