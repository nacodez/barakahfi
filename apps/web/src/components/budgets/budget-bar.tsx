import type { BudgetStatus } from '@barakahfi/shared';
import { cn } from '@/lib/cn';

const COLORS: Record<BudgetStatus, string> = {
  ON_TRACK: 'bg-emerald-600',
  WARNING: 'bg-amber-500',
  OVER: 'bg-red-600',
};

export const STATUS_TEXT: Record<BudgetStatus, string> = {
  ON_TRACK: 'On track',
  WARNING: 'Getting close',
  OVER: 'Over budget',
};

export function BudgetBar({
  percent,
  status,
  label,
}: {
  percent: number;
  status: BudgetStatus;
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(percent))}
      aria-valuetext={`${percent}% used, ${STATUS_TEXT[status]}`}
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
    >
      <div
        className={cn('h-full rounded-full transition-all', COLORS[status])}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}
