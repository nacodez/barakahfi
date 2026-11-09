import type { Metadata } from 'next';
import { BudgetsView } from '@/components/budgets/budgets-view';

// These pages render only after the client-side session check passes and fetch all of their
// data in the browser, so there is no server content for instant-navigation validation to check.
export const instant = false;

export const metadata: Metadata = { title: 'Budgets · BarakahFi' };

export default function BudgetsPage() {
  return <BudgetsView />;
}
