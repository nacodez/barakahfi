/** Mirrors Prisma enums so the web app never imports the Prisma client. */
export const AccountType = {
  BANK: 'BANK',
  INVESTMENT: 'INVESTMENT',
  CASH: 'CASH',
  GOLD: 'GOLD',
  REAL_ESTATE: 'REAL_ESTATE',
  CRYPTO: 'CRYPTO',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const CategoryType = { INCOME: 'INCOME', EXPENSE: 'EXPENSE' } as const;
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export const HalalStatus = {
  HALAL: 'HALAL',
  HARAM: 'HARAM',
  DOUBTFUL: 'DOUBTFUL',
  NEUTRAL: 'NEUTRAL',
} as const;
export type HalalStatus = (typeof HalalStatus)[keyof typeof HalalStatus];

export const Role = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const BudgetPeriod = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const;
export type BudgetPeriod = (typeof BudgetPeriod)[keyof typeof BudgetPeriod];

/** Budget health. Thresholds live in budget-status.ts. */
export const BudgetStatus = { ON_TRACK: 'ON_TRACK', WARNING: 'WARNING', OVER: 'OVER' } as const;
export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus];
