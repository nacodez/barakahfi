import type { ComplianceStatus } from '@barakahfi/shared';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const STYLES: Record<
  ComplianceStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  COMPLIANT: {
    label: 'Compliant',
    className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  DOUBTFUL: {
    label: 'Doubtful',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  NON_COMPLIANT: {
    label: 'Non-compliant',
    className: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
    Icon: XCircle,
  },
};

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: 'Compliant',
  DOUBTFUL: 'Doubtful',
  NON_COMPLIANT: 'Non-compliant',
};

/** Icon AND text, so the verdict never depends on colour alone. */
export function ComplianceBadge({
  status,
  className,
}: {
  status: ComplianceStatus | null;
  className?: string;
}) {
  if (!status) return <span className="text-sm text-zinc-400">—</span>;
  const { label, className: tone, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
