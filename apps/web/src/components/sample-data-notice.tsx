import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Shown wherever screening figures appear. The seeded ratios are illustrative placeholders, and a
 * religious-finance app must never let anyone mistake them for a real screening.
 */
export function SampleDataNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900',
        'dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong>Sample data.</strong> The ratios and verdicts here are illustrative placeholders,
        not a real Sharia screening. Do not use them for investment or religious decisions. A
        production version would use a licensed provider.
      </span>
    </p>
  );
}
