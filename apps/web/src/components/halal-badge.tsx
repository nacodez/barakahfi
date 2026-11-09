import type { HalalStatus } from '@barakahfi/shared';

const BADGES: Record<
  Exclude<HalalStatus, 'NEUTRAL'>,
  { symbol: string; label: string; className: string }
> = {
  HALAL: { symbol: '✓', label: 'Halal', className: 'text-emerald-700 dark:text-emerald-400' },
  HARAM: { symbol: '✗', label: 'Haram', className: 'text-red-600 dark:text-red-400' },
  DOUBTFUL: { symbol: '?', label: 'Doubtful', className: 'text-amber-600 dark:text-amber-400' },
};

export const halalHint = (status: HalalStatus | null): string =>
  status === 'HALAL'
    ? ' ✓'
    : status === 'HARAM'
      ? ' ✗ haram'
      : status === 'DOUBTFUL'
        ? ' ? doubtful'
        : '';

/** Neutral categories show nothing; the others get an indicator that doesn't rely on colour alone. */
export function HalalBadge({ status }: { status: HalalStatus | null }) {
  if (!status || status === 'NEUTRAL') return null;
  const b = BADGES[status];
  return (
    <span title={b.label} aria-label={b.label} className={`text-xs font-semibold ${b.className}`}>
      {b.symbol}
    </span>
  );
}
