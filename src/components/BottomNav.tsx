import React from 'react';
import { 
  Calendar, 
  GitFork, 
  Table2, 
  BarChart3, 
  Plus
} from 'lucide-react';

interface BottomNavProps {
  activeTab: 'month' | 'sankey' | 'year' | 'analytics';
  setActiveTab: (tab: 'month' | 'sankey' | 'year' | 'analytics') => void;
  onOpenQuickAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-900 px-3 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* 1. MOIS */}
        <button
          onClick={() => setActiveTab('month')}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'month' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Mois</span>
        </button>

        {/* 2. FLUX */}
        <button
          onClick={() => setActiveTab('sankey')}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'sankey' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <GitFork className="w-5 h-5" />
          <span className="text-[10px]">Flux</span>
        </button>

        {/* 3. CENTRAL QUICK ADD */}
        <div className="flex-1 flex justify-center -mt-4">
          <button
            onClick={onOpenQuickAdd}
            title="Ajouter une dépense"
            className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. ANNUEL */}
        <button
          onClick={() => setActiveTab('year')}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'year' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Table2 className="w-5 h-5" />
          <span className="text-[10px]">Annuel</span>
        </button>

        {/* 5. STATS */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'analytics' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Stats</span>
        </button>
      </div>
    </nav>
  );
};
