import type { Metadata } from 'next';
import { ScreenerView } from '@/components/screener/screener-view';

// Rendered only after the client-side session check, and fetches all data in the browser.
export const instant = false;

export const metadata: Metadata = { title: 'Halal screener · BarakahFi' };

export default function ScreenerPage() {
  return <ScreenerView />;
}
