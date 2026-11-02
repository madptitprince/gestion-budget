import { useState, useEffect, useMemo } from 'react';
import { AllBudgetData, MonthKey, BudgetYearData, MonthSummary, BudgetItem } from '../types/budget';
import { getInitialBudgetData, MONTHS, emptyMonthValues } from '../data/initialData';

const STORAGE_KEY = 'adiack_budget_data_v2';

export const useBudget = () => {
  const [data, setData] = useState<AllBudgetData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading budget data from localStorage', e);
    }
    return getInitialBudgetData();
  });

  // Default to 2026 as in the Excel, or current calendar year if available
  const [currentYear, setCurrentYear] = useState<string>('2026');
  
  // Default to November ('nov') as local time is November 2026!
  const [currentMonth, setCurrentMonth] = useState<MonthKey>('nov');

  // Active view: 'month' | 'sankey' | 'year' | 'analytics'
  const [activeTab, setActiveTab] = useState<'month' | 'sankey' | 'year' | 'analytics'>('month');

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving budget data', e);
    }
  }, [data]);

  // Cloud sync with Neon PostgreSQL
  useEffect(() => {
    let isMounted = true;
    async function loadCloudBudget() {
      try {
        const res = await fetch('/api/budget');
        if (res.ok) {
          const result = await res.json();
          if (isMounted && result.data && typeof result.data === 'object') {
            setData(result.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
          } else if (isMounted && result.source === 'neon_empty') {
            // First time connecting to Neon: sync initial data to Neon
            fetch('/api/budget', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data }),
            }).catch(() => {});
          }
        }
      } catch (_) {
        // Offline or local dev fallback
      }
    }
    loadCloudBudget();
    return () => { isMounted = false; };
  }, []);

  // Sync to Neon when data changes (debounced 1.5s)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [data]);

  const yearData: BudgetYearData = useMemo(() => {
    if (data[currentYear]) return data[currentYear];
    // fallback create empty year
    const base = data['2026'] || getInitialBudgetData()['2026'];
    return {
      income: base.income.map(i => ({ ...i, values: emptyMonthValues() })),
      fixedExpenses: base.fixedExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
      savings: base.savings.map(i => ({ ...i, values: emptyMonthValues() })),
      variableExpenses: base.variableExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
    };
  }, [data, currentYear]);

  // Update a single value for an item
  const updateItemValue = (
    section: keyof BudgetYearData,
    itemId: string,
    month: MonthKey,
    val: number
  ) => {
    setData(prev => {
      const yearObj = prev[currentYear] || yearData;
      const sectionList = yearObj[section];
      const updatedList = sectionList.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            values: {
              ...item.values,
              [month]: Math.max(0, val)
            }
          };
        }
        return item;
      });

      return {
        ...prev,
        [currentYear]: {
          ...yearObj,
          [section]: updatedList
        }
      };
    });
  };

  // Add a new line item in a section
  const addItem = (section: keyof BudgetYearData, name: string) => {
    if (!name.trim()) return;
    const newItem: BudgetItem = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      name: name.trim(),
      values: emptyMonthValues(),
    };

    setData(prev => {
      const yearObj = prev[currentYear] || yearData;
      return {
        ...prev,
        [currentYear]: {
          ...yearObj,
          [section]: [...yearObj[section], newItem]
        }
      };
    });
  };

  // Delete an item
  const deleteItem = (section: keyof BudgetYearData, itemId: string) => {
    setData(prev => {
      const yearObj = prev[currentYear] || yearData;
      return {
        ...prev,
        [currentYear]: {
          ...yearObj,
          [section]: yearObj[section].filter(item => item.id !== itemId)
        }
      };
    });
  };

  // Fast pre-fill: duplicate fixed charges & savings from previous month
  const duplicateFromPreviousMonth = (targetMonth: MonthKey) => {
    const monthIndex = MONTHS.findIndex(m => m.key === targetMonth);
    if (monthIndex <= 0) return; // No previous month in current year
    const prevMonthKey = MONTHS[monthIndex - 1].key;

    setData(prev => {
      const yearObj = prev[currentYear] || yearData;
      const copySection = (list: BudgetItem[]) =>
        list.map(item => ({
          ...item,
          values: {
            ...item.values,
            [targetMonth]: item.values[prevMonthKey] || 0
          }
        }));

      return {
        ...prev,
        [currentYear]: {
          ...yearObj,
          income: copySection(yearObj.income),
          fixedExpenses: copySection(yearObj.fixedExpenses),
          savings: copySection(yearObj.savings),
          // We can also copy variable expenses or leave them for user choice
        }
      };
    });
  };

  // Quick expense addition (e.g. 24€ Resto)
  const addQuickExpense = (categoryName: string, amount: number, month: MonthKey) => {
    if (!amount || amount <= 0) return;
    setData(prev => {
      const yearObj = prev[currentYear] || yearData;
      
      // Look for item in variable expenses first, then fixed, then savings
      let foundSection: keyof BudgetYearData = 'variableExpenses';
      let foundItem = yearObj.variableExpenses.find(
        i => i.name.toLowerCase() === categoryName.toLowerCase() || i.id === categoryName
      );

      if (!foundItem) {
        foundItem = yearObj.fixedExpenses.find(
          i => i.name.toLowerCase() === categoryName.toLowerCase() || i.id === categoryName
        );
        if (foundItem) foundSection = 'fixedExpenses';
      }

      if (!foundItem) {
        foundItem = yearObj.savings.find(
          i => i.name.toLowerCase() === categoryName.toLowerCase() || i.id === categoryName
        );
        if (foundItem) foundSection = 'savings';
      }

      // If not found anywhere, create a new item in variableExpenses
      if (!foundItem) {
        const newItem: BudgetItem = {
          id: `${categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          name: categoryName,
          values: { ...emptyMonthValues(), [month]: amount }
        };
        return {
          ...prev,
          [currentYear]: {
            ...yearObj,
            variableExpenses: [...yearObj.variableExpenses, newItem]
          }
        };
      }

      // Else add amount to existing
      const currentVal = foundItem.values[month] || 0;
      const updatedSection = yearObj[foundSection].map(item => {
        if (item.id === foundItem!.id) {
          return {
            ...item,
            values: {
              ...item.values,
              [month]: Math.round((currentVal + amount) * 100) / 100
            }
          };
        }
        return item;
      });

      return {
        ...prev,
        [currentYear]: {
          ...yearObj,
          [foundSection]: updatedSection
        }
      };
    });
  };

  // Add a new Year (e.g. 2027 or 2028)
  const addYear = (yearStr: string) => {
    if (data[yearStr]) {
      setCurrentYear(yearStr);
      return;
    }
    const template = yearData;
    setData(prev => ({
      ...prev,
      [yearStr]: {
        income: template.income.map(i => ({ ...i, values: emptyMonthValues() })),
        fixedExpenses: template.fixedExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
        savings: template.savings.map(i => ({ ...i, values: emptyMonthValues() })),
        variableExpenses: template.variableExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
      }
    }));
    setCurrentYear(yearStr);
  };

  // Compute month summary
  const getMonthSummary = (month: MonthKey): MonthSummary => {
    const sumList = (list: BudgetItem[]) =>
      list.reduce((acc, curr) => acc + (Number(curr.values[month]) || 0), 0);

    const totalIncome = Math.round(sumList(yearData.income) * 100) / 100;
    const totalFixed = Math.round(sumList(yearData.fixedExpenses) * 100) / 100;
    const totalSavings = Math.round(sumList(yearData.savings) * 100) / 100;
    const totalVariable = Math.round(sumList(yearData.variableExpenses) * 100) / 100;

    // In the user's Excel:
    // Total Dépenses Fixes row 58 includes Logement, Transports, Abonnements AND Épargne/Investissements.
    // Row 60: "RESTE pour les dépenses variables" = TOTAL REVENUS - TOTAL DÉPENSES FIXES
    // Row 85: "RESTE AU TOTAL pour dépenses exceptionnelles" = Row 60 - TOTAL DÉPENSES VARIABLES
    // Here we make it crystal clear:
    const remainingForVariables = Math.round((totalIncome - (totalFixed + totalSavings)) * 100) / 100;
    const remainingNet = Math.round((remainingForVariables - totalVariable) * 100) / 100;
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalFixed,
      totalSavings,
      totalVariable,
      remainingForVariables,
      remainingNet,
      savingsRate
    };
  };

  // Export JSON backup
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adiack_budget_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (typeof json === 'object') {
          setData(json);
          alert('Données restaurées avec succès !');
        }
      } catch (err) {
        alert('Fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
  };

  // Reset to original Excel data
  const resetToExcel = () => {
    if (confirm('Réinitialiser toutes les données aux valeurs de votre fichier Excel initial ?')) {
      const init = getInitialBudgetData();
      setData(init);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return {
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
  };
};

