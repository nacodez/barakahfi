import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard-view';

// These pages render only after the client-side session check passes and fetch all of their
// data in the browser, so there is no server content for instant-navigation validation to check.
export const instant = false;

export const metadata: Metadata = { title: 'Dashboard · BarakahFi' };

export default function DashboardPage() {
  return <DashboardView />;
}
