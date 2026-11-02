import React, { useState } from 'react';
import { useBudget } from './hooks/useBudget';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { MonthBudgetView } from './components/MonthBudgetView';
import { YearOverview } from './components/YearOverview';
import { AnnualCharts } from './components/AnnualCharts';
import { SankeyDiagram } from './components/SankeyDiagram';
import { QuickAddModal } from './components/QuickAddModal';
import { ExportPDFModal } from './components/ExportPDFModal';
import { LoginPage } from './components/LoginPage';
import { BottomNav } from './components/BottomNav';
import { Logo } from './components/Logo';

export const App: React.FC = () => {
  const {
    data,
    yearData,
    currentYear,
    setCurrentYear,
    currentMonth,
    setCurrentMonth,
    activeTab,
    setActiveTab,
    updateItemValue,
    addItem,
    deleteItem,
    duplicateFromPreviousMonth,
    addQuickExpense,
    addYear,
    getMonthSummary,
    exportBackup,
    importBackup,
    resetToExcel,
  } = useBudget();

  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isLoading: isAuthLoading, error: authError, login, logout } = useAuth();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isExportPDFOpen, setIsExportPDFOpen] = useState(false);

  const availableYears = Object.keys(data).sort();
  const currentMonthSummary = getMonthSummary(currentMonth);

  const handleExportPDF = () => {
    setIsExportPDFOpen(true);
  };

  // 1. Initial Auth Loading State
  if (isAuthLoading && isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Logo size="lg" />
        <div className="mt-5 w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Not Authenticated -> Show Login Page
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        theme={theme}
        onToggleTheme={toggleTheme}
        initialError={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 transition-colors">
      {/* Top Navbar */}
      <Navbar
        currentYear={currentYear}
        setCurrentYear={setCurrentYear}
        availableYears={availableYears}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onExport={exportBackup}
        onImport={importBackup}
        onReset={resetToExcel}
        onAddYear={addYear}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExportPDF={handleExportPDF}
        onLogout={logout}
      />

      {/* Main Content with comfortable mobile spacing */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 md:pb-6 space-y-5 print:p-0 print:m-0 print:max-w-none">
        {/* KPI Cards (visible in Month and Sankey views) */}
        {(activeTab === 'month' || activeTab === 'sankey') && (
          <SummaryCards summary={currentMonthSummary} />
        )}

        {/* Tab 1: Month View */}
        {activeTab === 'month' && (
          <MonthBudgetView
            currentMonth={currentMonth}
            currentYear={currentYear}
            yearData={yearData}
            summary={currentMonthSummary}
            onUpdateValue={updateItemValue}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onDuplicateFromPreviousMonth={duplicateFromPreviousMonth}
          />
        )}

        {/* Tab 2: Flow (Sankey) */}
        {activeTab === 'sankey' && (
          <SankeyDiagram
            yearData={yearData}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onSelectMonth={(m) => setCurrentMonth(m)}
          />
        )}

        {/* Tab 3: Year View */}
        {activeTab === 'year' && (
          <YearOverview
            currentYear={currentYear}
            yearData={yearData}
            onSelectMonth={(m) => {
              setCurrentMonth(m);
              setActiveTab('month');
            }}
            onExportPDF={handleExportPDF}
          />
        )}

        {/* Tab 4: Stats View */}
        {activeTab === 'analytics' && (
          <AnnualCharts
            currentYear={currentYear}
            yearData={yearData}
            currentMonth={currentMonth}
          />
        )}
      </main>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        currentMonth={currentMonth}
        yearData={yearData}
        onAddQuickExpense={addQuickExpense}
      />

      {/* Export PDF Modal */}
      <ExportPDFModal
        isOpen={isExportPDFOpen}
        onClose={() => setIsExportPDFOpen(false)}
        currentMonth={currentMonth}
        currentYear={currentYear}
        yearData={yearData}
        monthSummary={currentMonthSummary}
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
      />

      {/* Mobile Bottom Navigation Bar */}
      <div className="print:hidden">
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        />
      </div>

      {/* Discreet Desktop Footer */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-900 py-4 text-xs text-slate-500 print:hidden transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-400">MADFIN</span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportPDF}
              className="text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-white transition-colors"
            >
              Imprimer / Exporter PDF
            </button>
            <span>•</span>
            <button
              onClick={exportBackup}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sauvegarde JSON
            </button>
            <span>•</span>
            <button
              onClick={logout}
              className="text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
