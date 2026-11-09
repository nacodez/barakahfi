'use client';

import dynamic from 'next/dynamic';

const Placeholder = () => (
  <div className="h-64 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" aria-hidden />
);

// Recharts is heavy and browser-only, so it loads in its own chunk after the page is interactive.
export const IncomeExpenseChart = dynamic(() => import('./income-expense-chart-impl'), {
  ssr: false,
  loading: Placeholder,
});
