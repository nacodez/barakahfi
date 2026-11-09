import type { Metadata } from 'next';
import { TransactionsView } from '@/components/transactions/transactions-view';

// These pages render only after the client-side session check passes and fetch all of their
// data in the browser, so there is no server content for instant-navigation validation to check.
export const instant = false;

export const metadata: Metadata = { title: 'Transactions · BarakahFi' };

export default function TransactionsPage() {
  return <TransactionsView />;
}
