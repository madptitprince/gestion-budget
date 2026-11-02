import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Calendar, 
  BarChart3, 
  Table2, 
  Download, 
  Upload, 
  RotateCcw,
  GitFork,
  FileDown,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { MONTHS } from '../data/initialData';
import { MonthKey } from '../types/budget';
import { Logo } from './Logo';

interface NavbarProps {
  currentYear: string;
  setCurrentYear: (year: string) => void;
  availableYears: string[];
  currentMonth: MonthKey;
  setCurrentMonth: (month: MonthKey) => void;
  activeTab: 'month' | 'sankey' | 'year' | 'analytics';
  setActiveTab: (tab: 'month' | 'sankey' | 'year' | 'analytics') => void;
  onOpenQuickAdd: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onAddYear: (year: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onExportPDF: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentYear,
  setCurrentYear,
  availableYears,
  currentMonth,
  setCurrentMonth,
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onExport,
  onImport,
  onReset,
  onAddYear,
  theme,
  onToggleTheme,
  onExportPDF,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (newYearInput.trim()) {
      onAddYear(newYearInput.trim());
      setShowYearModal(false);
      setNewYearInput('');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/60 print:hidden transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div onClick={() => setActiveTab('month')}>
            <Logo size="md" />
          </div>

          {/* Desktop Nav Pills */}
          <nav className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'month'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Mois</span>
            </button>
            <button
              onClick={() => setActiveTab('sankey')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'sankey'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Flux</span>
            </button>
            <button
              onClick={() => setActiveTab('year')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'year'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Annuel</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Stats</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Year Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-xl px-1.5 py-0.5">
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 py-1 pl-1 pr-2 rounded focus:outline-none cursor-pointer"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {yr}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowYearModal(true)}
                title="Ajouter une année"
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Quick Add (Desktop) */}
            <button
              onClick={onOpenQuickAdd}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Dépense</span>
            </button>

            {/* PDF Export Button */}
            <button
              onClick={onExportPDF}
              title="Exporter en PDF / Imprimer"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <FileDown className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button (Dark default, Light on toggle) */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Backup actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 pl-1 text-slate-400 border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={onExport}
                title="Sauvegarde JSON"
                className="p-1.5 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Restaurer JSON"
                className="p-1.5 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                }}
              />
              <button
                onClick={onReset}
                title="Réinitialiser"
                className="p-1.5 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Déconnexion"
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clean Month Pills */}
        {(activeTab === 'month' || activeTab === 'sankey') && (
          <div className="py-2 overflow-x-auto flex items-center gap-1 no-scrollbar border-t border-slate-200 dark:border-slate-900">
            {MONTHS.map(m => {
              const isSelected = currentMonth === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setCurrentMonth(m.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-emerald-400 font-bold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Year Modal */}
      {showYearModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateYear}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nouvelle année</h3>
            <input
              type="number"
              placeholder="Ex: 2028"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowYearModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400"
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};
