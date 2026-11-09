'use client';

import type { HoldingDto, PortfolioTotalsDto } from '@barakahfi/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ComplianceBadge } from '@/components/compliance-badge';
import { SampleDataNotice } from '@/components/sample-data-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { controlClass } from '@/components/ui/field';
import { useRealtime } from '@/components/realtime-provider';
import {
  PORTFOLIO_PAGE_SIZE,
  useDeleteHolding,
  usePortfolio,
  type PortfolioParams,
  type PortfolioSort,
} from '@/hooks/use-portfolio';
import { cn } from '@/lib/cn';
import { formatNumber, formatSignedPercent } from '@/lib/format';
import { formatCents, toCents } from '@/lib/money';
import { AddHoldingForm } from './add-holding-form';
import { HoldingEdit } from './holding-edit';

const money = (v: string, currency: string) => formatCents(toCents(v), currency);
const priceText = (v: string, currency: string) =>
  formatCents(toCents(Number(v).toFixed(2)), currency);
const tone = (v: string | number) =>
  Number(v) > 0
    ? 'text-emerald-700 dark:text-emerald-400'
    : Number(v) < 0
      ? 'text-red-600 dark:text-red-400'
      : '';
const signed = (v: string, currency: string) => `${Number(v) > 0 ? '+' : ''}${money(v, currency)}`;

function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums break-words sm:text-xl', className)}>
        {value}
      </p>
      {sub && <p className={cn('text-sm tabular-nums', className)}>{sub}</p>}
    </div>
  );
}

function Totals({ t }: { t: PortfolioTotalsDto }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Portfolio value" value={money(t.value, t.currency)} />
      <Stat
        label="Total gain / loss"
        value={signed(t.gainLoss, t.currency)}
        sub={formatSignedPercent(t.gainLossPercent)}
        className={tone(t.gainLoss)}
      />
      <Stat
        label="Today"
        value={signed(t.dayChange, t.currency)}
        sub={formatSignedPercent(t.dayChangePercent)}
        className={tone(t.dayChange)}
      />
      <Stat
        label="Purification due"
        value={money(t.purificationDue, t.currency)}
        sub="to donate from dividends"
      />
    </div>
  );
}

type Dir = 'asc' | 'desc';

function SortTh({
  label,
  field,
  sort,
  dir,
  onSort,
  right,
}: {
  label: string;
  field: PortfolioSort;
  sort: PortfolioSort;
  dir: Dir;
  onSort: (f: PortfolioSort) => void;
  right?: boolean;
}) {
  const active = sort === field;
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2 font-medium', right && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {label}
        {active && <Icon className="size-3.5" aria-hidden />}
      </button>
    </th>
  );
}

export function PortfolioView() {
  const addSymbol = useSearchParams().get('add') ?? '';
  const [params, setParams] = useState<PortfolioParams>({ sort: 'value', dir: 'desc', page: 1 });
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(addSymbol !== '');
  const query = usePortfolio(params);
  const remove = useDeleteHolding();
  const { status: live } = useRealtime();

  const sort = params.sort ?? 'value';
  const dir = params.dir ?? 'desc';
  const onSort = (field: PortfolioSort) =>
    setParams({
      sort: field,
      dir: field === sort ? (dir === 'asc' ? 'desc' : 'asc') : field === 'name' ? 'asc' : 'desc',
      page: 1,
    });

  const rows: HoldingDto[] = query.data?.data.rows ?? [];
  const totals = query.data?.data.totals;
  const total = query.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PORTFOLIO_PAGE_SIZE));
  const page = params.page ?? 1;
  const anySample = rows.some((r) => r.isSample);

  const onDelete = (h: HoldingDto) =>
    window.confirm(`Remove ${h.symbol} from your portfolio?`) && remove.mutate(h.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Your holdings, with compliance and purification tracked per stock.
          </p>
        </div>
        <span
          aria-live="polite"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            live === 'live'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400',
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full',
              live === 'live' ? 'bg-emerald-500' : 'bg-zinc-400',
            )}
            aria-hidden
          />
          {live === 'live'
            ? 'Live prices'
            : live === 'connecting'
              ? 'Connecting…'
              : 'Prices update when markets are open'}
        </span>
      </div>

      {query.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : query.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-red-600">Could not load your portfolio.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        totals && <Totals t={totals} />
      )}

      {anySample && <SampleDataNotice />}

      <Card
        title={`Holdings${total ? ` (${total})` : ''}`}
        action={
          <Button variant="outline" className="h-9" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Close' : 'Add holding'}
          </Button>
        }
      >
        {showAdd && (
          <div className="mb-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <AddHoldingForm defaultSymbol={addSymbol} onDone={() => setShowAdd(false)} />
          </div>
        )}

        {query.isSuccess && rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-zinc-500">
              No holdings yet. Find a stock in the screener, or add one you already own.
            </p>
            <Link
              href="/screener"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Open the halal screener
            </Link>
          </div>
        ) : (
          rows.length > 0 && (
            <div className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}>
              {/* Phones: sorting through a menu, since there are no column headers. */}
              <div className="mb-3 flex items-center gap-2 md:hidden">
                <label className="flex flex-1 items-center gap-2 text-sm whitespace-nowrap">
                  Sort by
                  <select
                    className={cn(controlClass, 'bg-background')}
                    value={sort}
                    onChange={(e) => onSort(e.target.value as PortfolioSort)}
                  >
                    <option value="value">Value</option>
                    <option value="name">Name</option>
                    <option value="gainLossPercent">Gain / loss %</option>
                    <option value="allocation">Allocation</option>
                    <option value="status">Compliance</option>
                  </select>
                </label>
                <Button
                  variant="outline"
                  aria-label={
                    dir === 'asc'
                      ? 'Ascending, switch to descending'
                      : 'Descending, switch to ascending'
                  }
                  onClick={() =>
                    setParams({ ...params, dir: dir === 'asc' ? 'desc' : 'asc', page: 1 })
                  }
                >
                  {dir === 'asc' ? (
                    <ArrowUp className="size-4" aria-hidden />
                  ) : (
                    <ArrowDown className="size-4" aria-hidden />
                  )}
                </Button>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <SortTh label="Stock" field="name" sort={sort} dir={dir} onSort={onSort} />
                      <SortTh
                        label="Qty"
                        field="quantity"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh
                        label="Avg cost"
                        field="avgBuyPrice"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh
                        label="Price"
                        field="currentPrice"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh
                        label="Value"
                        field="value"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh
                        label="Gain / loss"
                        field="gainLoss"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh
                        label="Alloc."
                        field="allocation"
                        sort={sort}
                        dir={dir}
                        onSort={onSort}
                        right
                      />
                      <SortTh label="Status" field="status" sort={sort} dir={dir} onSort={onSort} />
                      <th scope="col" className="px-3 py-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {rows.map((h) => (
                      <tr key={h.id} className="align-top">
                        <td className="px-3 py-2">
                          <span className="font-medium">{h.symbol}</span>
                          <span className="block max-w-[11rem] truncate text-xs text-zinc-500">
                            {h.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(h.quantity)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {priceText(h.avgBuyPrice, h.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {priceText(h.currentPrice, h.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(h.valueBase, totals?.currency ?? h.currency)}
                        </td>
                        <td className={cn('px-3 py-2 text-right tabular-nums', tone(h.gainLoss))}>
                          {signed(h.gainLoss, h.currency)}
                          <span className="block text-xs">
                            {formatSignedPercent(h.gainLossPercent)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {h.allocationPercent.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2">
                          <ComplianceBadge status={h.status} />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            className="h-8 px-2"
                            aria-label={`Edit ${h.symbol}`}
                            onClick={() => setEditing(editing === h.id ? null : h.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-zinc-500"
                            aria-label={`Remove ${h.symbol}`}
                            onClick={() => onDelete(h)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows
                  .filter((h) => h.id === editing)
                  .map((h) => (
                    <div key={h.id} className="mt-3">
                      <HoldingEdit holding={h} onDone={() => setEditing(null)} />
                    </div>
                  ))}
              </div>

              <ul className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
                {rows.map((h) => (
                  <li key={h.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{h.symbol}</p>
                        <p className="truncate text-sm text-zinc-500">{h.name}</p>
                      </div>
                      <ComplianceBadge status={h.status} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-zinc-500">Value</dt>
                      <dd className="text-right tabular-nums">
                        {money(h.valueBase, totals?.currency ?? h.currency)}
                      </dd>
                      <dt className="text-zinc-500">Gain / loss</dt>
                      <dd className={cn('text-right tabular-nums', tone(h.gainLoss))}>
                        {signed(h.gainLoss, h.currency)} ({formatSignedPercent(h.gainLossPercent)})
                      </dd>
                      <dt className="text-zinc-500">{formatNumber(h.quantity)} × price</dt>
                      <dd className="text-right tabular-nums">
                        {priceText(h.currentPrice, h.currency)}
                      </dd>
                      <dt className="text-zinc-500">Allocation</dt>
                      <dd className="text-right tabular-nums">{h.allocationPercent.toFixed(1)}%</dd>
                    </dl>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        className="h-9 flex-1"
                        onClick={() => setEditing(editing === h.id ? null : h.id)}
                      >
                        Edit
                      </Button>
                      <Button variant="outline" className="h-9 flex-1" onClick={() => onDelete(h)}>
                        Remove
                      </Button>
                    </div>
                    {editing === h.id && (
                      <HoldingEdit holding={h} onDone={() => setEditing(null)} />
                    )}
                  </li>
                ))}
              </ul>

              {pages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-4 flex items-center justify-between gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setParams({ ...params, page: page - 1 })}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-zinc-500">
                    Page {page} of {pages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= pages}
                    onClick={() => setParams({ ...params, page: page + 1 })}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
