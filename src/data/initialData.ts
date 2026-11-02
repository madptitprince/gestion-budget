import initialRawData from './initialData.json';
import { AllBudgetData, MonthKey, BudgetYearData } from '../types/budget';

export const MONTHS: { key: MonthKey; label: string; short: string }[] = [
  { key: 'jan', label: 'Janvier', short: 'Jan' },
  { key: 'feb', label: 'Février', short: 'Fév' },
  { key: 'mar', label: 'Mars', short: 'Mar' },
  { key: 'apr', label: 'Avril', short: 'Avr' },
  { key: 'may', label: 'Mai', short: 'Mai' },
  { key: 'jun', label: 'Juin', short: 'Juin' },
  { key: 'jul', label: 'Juillet', short: 'Juil' },
  { key: 'aug', label: 'Août', short: 'Août' },
  { key: 'sep', label: 'Septembre', short: 'Sep' },
  { key: 'oct', label: 'Octobre', short: 'Oct' },
  { key: 'nov', label: 'Novembre', short: 'Nov' },
  { key: 'dec', label: 'Décembre', short: 'Déc' },
];

export const emptyMonthValues = (): Record<MonthKey, number> => ({
  jan: 0,
  feb: 0,
  mar: 0,
  apr: 0,
  may: 0,
  jun: 0,
  jul: 0,
  aug: 0,
  sep: 0,
  oct: 0,
  nov: 0,
  dec: 0,
});

// Prepare default data ensuring 2027 and other years have standard template categories
const defaultYearTemplate = (baseData: BudgetYearData): BudgetYearData => ({
  income: baseData.income.map(i => ({ ...i, values: emptyMonthValues() })),
  fixedExpenses: baseData.fixedExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
  savings: baseData.savings.map(i => ({ ...i, values: emptyMonthValues() })),
  variableExpenses: baseData.variableExpenses.map(i => ({ ...i, values: emptyMonthValues() })),
});

export const getInitialBudgetData = (): AllBudgetData => {
  const data = initialRawData as unknown as AllBudgetData;
  
  // If 2027 is missing savings or categories from 2026, copy structure
  if (data['2026']) {
    if (!data['2027'] || data['2027'].savings.length === 0) {
      data['2027'] = defaultYearTemplate(data['2026']);
    }
  }

  return data;
};

