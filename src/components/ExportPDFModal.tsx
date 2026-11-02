import React, { useState } from 'react';
import { FileText, Table2, GitFork, X, Check, ArrowRight } from 'lucide-react';
import { MonthKey, BudgetYearData, MonthSummary } from '../types/budget';
import { MONTHS } from '../data/initialData';
import { generateMonthlyPDF, generateAnnualPDF, generateFlowPDF } from '../utils/pdfGenerator';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: MonthKey;
  currentYear: string;
  yearData: BudgetYearData;
  monthSummary: MonthSummary;
  activeTab?: string;
  onSwitchTab?: (tab: 'month' | 'sankey' | 'year' | 'analytics') => void;
}

export const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  currentMonth,
  currentYear,
  yearData,
  monthSummary,
  onSwitchTab,
}) => {
  if (!isOpen) return null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const currentMonthLabel = MONTHS.find(m => m.key === currentMonth)?.label || currentMonth;

  const handleExportMonthly = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        generateMonthlyPDF(currentMonth, currentYear, yearData, monthSummary);
        setIsGenerating(false);
        setDownloadSuccess('Rapport mensuel téléchargé !');
        setTimeout(() => {
          setDownloadSuccess(null);
          onClose();
        }, 1200);
      } catch (err) {
        console.error(err);
        setIsGenerating(false);
        alert('Erreur lors de la création du rapport mensuel.');
      }
    }, 80);
  };

  const handleExportAnnual = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        generateAnnualPDF(currentYear, yearData);
        setIsGenerating(false);
        setDownloadSuccess('Bilan annuel téléchargé !');
        setTimeout(() => {
          setDownloadSuccess(null);
          onClose();
        }, 1200);
      } catch (err) {
        console.error(err);
        setIsGenerating(false);
        alert('Erreur lors de la création du bilan annuel.');
      }
    }, 80);
  };

  const handleExportFlow = async () => {
    setIsGenerating(true);
    try {
      if (!document.getElementById('sankey-svg') && onSwitchTab) {
        onSwitchTab('sankey');
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await generateFlowPDF(currentMonth, currentYear, 'sankey-svg');
      setIsGenerating(false);
      setDownloadSuccess('Diagramme de flux téléchargé !');
      setTimeout(() => {
        setDownloadSuccess(null);
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
      alert('Erreur lors de la génération du PDF du flux.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Exporter en PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {downloadSuccess ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{downloadSuccess}</p>
            </div>
          ) : (
            <>
              {/* Option 1: Rapport Mensuel */}
              <button
                onClick={handleExportMonthly}
                disabled={isGenerating}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Rapport Mensuel • {currentMonthLabel} {currentYear}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Synthèse des KPIs, répartition et détail complet des opérations (A4 Portrait).
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Option 2: Bilan Annuel Consolidé */}
              <button
                onClick={handleExportAnnual}
                disabled={isGenerating}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <Table2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Bilan Annuel Consolidé • {currentYear}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tableau 12 mois avec synthèse des totaux et soldes nets mensuels (A4 Paysage).
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Option 3: Diagramme de Flux */}
              <button
                onClick={handleExportFlow}
                disabled={isGenerating}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                    <GitFork className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Diagramme de Flux • {currentMonthLabel} {currentYear}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rendu haute définition du diagramme de trésorerie (A4 Paysage).
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
