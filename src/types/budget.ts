export type MonthKey =
  | 'jan'
  | 'feb'
  | 'mar'
  | 'apr'
  | 'may'
  | 'jun'
  | 'jul'
  | 'aug'
  | 'sep'
  | 'oct'
  | 'nov'
  | 'dec';

export interface BudgetItem {
  id: string;
  name: string;
  values: Record<MonthKey, number>;
  categoryTag?: string;
}

export interface BudgetYearData {
  income: BudgetItem[];
  fixedExpenses: BudgetItem[];
  savings: BudgetItem[];
  variableExpenses: BudgetItem[];
}

export type AllBudgetData = Record<string, BudgetYearData>;

export interface MonthSummary {
  totalIncome: number;
  totalFixed: number;
  totalSavings: number;
  totalVariable: number;
  remainingForVariables: number;
  remainingNet: number;
  savingsRate: number;
}

