'use client';

import type { ScreeningCheckDto } from '@barakahfi/shared';
import { Check, CircleHelp, X } from 'lucide-react';
import { ComplianceBadge } from '@/components/compliance-badge';
import { SampleDataNotice } from '@/components/sample-data-notice';
import { Button } from '@/components/ui/button';
import { useScreenerDetail } from '@/hooks/use-screener';
import { cn } from '@/lib/cn';
import { formatMarketCap, formatPercent } from '@/lib/format';
import { formatCents, toCents } from '@/lib/money';

function CheckRow({ check }: { check: ScreeningCheckDto }) {
  const Icon = check.passed === true ? Check : check.passed === false ? X : CircleHelp;
  const tone =
    check.passed === true
      ? 'text-emerald-700 dark:text-emerald-400'
      : check.passed === false
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600';
  const result = check.passed === true ? 'Pass' : check.passed === false ? 'Fail' : 'No data';

  return (
    <li className="flex items-start gap-3 py-3">
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{check.label}</p>
        {check.value !== null && check.threshold !== null ? (
          <p className="text-sm text-zinc-500">
            {formatPercent(check.value)} <span aria-hidden>·</span> limit: under{' '}
            {formatPercent(check.threshold, 0)}
          </p>
        ) : check.note ? (
          <p className="text-sm text-zinc-500">{check.note}</p>
        ) : null}
      </div>
      <span className={cn('text-sm font-medium', tone)}>{result}</span>
    </li>
  );
}

export function ScreenerDetail({
  symbol,
  onAdd,
}: {
  symbol: string;
  onAdd: (symbol: string) => void;
}) {
  const query = useScreenerDetail(symbol);

  if (query.isPending) return <p className="text-zinc-500">Loading…</p>;
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-red-600">Could not load this stock.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const { asset, screening, history, cached } = query.data;
  const price = formatCents(toCents(Number(asset.price).toFixed(2)), asset.currency);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-500">
          {asset.symbol} · {asset.exchange} · {asset.sector}
        </p>
        <h3 className="text-xl font-semibold">{asset.name}</h3>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-zinc-600 dark:text-zinc-400">
          <span className="text-lg font-semibold tabular-nums text-foreground">{price}</span>
          <span>Market cap ≈ {formatMarketCap(asset.marketCapUsd)}</span>
        </p>
      </div>

      {screening.isSample && <SampleDataNotice />}

      <section
        aria-label="Verdict"
        className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <ComplianceBadge status={screening.status} className="text-sm" />
          <span className="text-xs text-zinc-500">
            {cached ? 'Checked' : 'Re-checked'}{' '}
            {new Date(screening.screenedAt).toLocaleDateString('en', { dateStyle: 'medium' })}
          </span>
        </div>
        <p className="text-sm">{screening.explanation}</p>
      </section>

      <section aria-label="Screening breakdown">
        <h4 className="mb-1 font-semibold">How it was screened</h4>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {screening.checks.map((c) => (
            <CheckRow key={c.key} check={c} />
          ))}
        </ul>
      </section>

      <section aria-label="Purification" className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
        <h4 className="mb-1 font-semibold">Purification</h4>
        {screening.status === 'NON_COMPLIANT' ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Not applicable. Non-compliant stocks are not held, rather than purified.
          </p>
        ) : screening.purificationPercent > 0 ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Donate{' '}
              <strong className="text-foreground">
                {formatPercent(screening.purificationPercent)}
              </strong>{' '}
              of every dividend to charity. For example,{' '}
              {formatPercent(screening.purificationPercent)} of 100 in dividends is{' '}
              {(screening.purificationPercent * 100).toFixed(2)}.
            </p>
            {screening.haramRevenueSources.length > 0 && (
              <p className="mt-2 text-sm text-zinc-500">
                Source of the non-compliant revenue: {screening.haramRevenueSources.join(', ')}.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nothing to purify: no non-compliant revenue reported.
          </p>
        )}
      </section>

      {history.length > 1 && (
        <section aria-label="History">
          <h4 className="mb-2 font-semibold">History</h4>
          <ol className="flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.screenedAt} className="flex items-center justify-between gap-3 text-sm">
                <ComplianceBadge status={h.status} />
                <span className="text-zinc-500">
                  {new Date(h.screenedAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Button onClick={() => onAdd(asset.symbol)}>Add to portfolio</Button>
    </div>
  );
}
