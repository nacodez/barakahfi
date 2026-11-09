'use client';

import dynamic from 'next/dynamic';

const Placeholder = () => (
  <div className="h-64 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" aria-hidden />
);

export const BudgetChart = dynamic(() => import('./budget-chart-impl'), {
  ssr: false,
  loading: Placeholder,
});
