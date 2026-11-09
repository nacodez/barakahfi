import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioView } from '@/components/portfolio/portfolio-view';

// Rendered only after the client-side session check, and fetches all data in the browser.
export const instant = false;

export const metadata: Metadata = { title: 'Portfolio · BarakahFi' };

export default function PortfolioPage() {
  // useSearchParams() (for the ?add=SYMBOL prefill) needs a Suspense boundary.
  return (
    <Suspense>
      <PortfolioView />
    </Suspense>
  );
}
