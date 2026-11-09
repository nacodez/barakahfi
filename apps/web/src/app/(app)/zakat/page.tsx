import type { Metadata } from 'next';
import { ZakatView } from '@/components/zakat/zakat-view';

// Rendered only after the client-side session check, and fetches all data in the browser.
export const instant = false;

export const metadata: Metadata = { title: 'Zakat · BarakahFi' };

export default function ZakatPage() {
  return <ZakatView />;
}
