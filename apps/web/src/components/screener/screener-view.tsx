'use client';

import type { ComplianceStatus, ScreenerRowDto } from '@barakahfi/shared';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ComplianceBadge } from '@/components/compliance-badge';
import { SampleDataNotice } from '@/components/sample-data-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { controlClass } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  SCREENER_PAGE_SIZE,
  useScreener,
  useScreenerFilters,
  type ScreenerParams,
} from '@/hooks/use-screener';
import { cn } from '@/lib/cn';
import { formatMarketCap, formatPercent } from '@/lib/format';
import { formatCents, toCents } from '@/lib/money';
import { ScreenerDetail } from './screener-detail';

const select = cn(controlClass, 'bg-background');

const CAP_PRESETS = [
  { label: 'Any size', min: '', max: '' },
  { label: 'Mega (over $200B)', min: 200, max: '' },
  { label: 'Large ($10B to $200B)', min: 10, max: 200 },
  { label: 'Mid and small (under $10B)', min: '', max: 10 },
] as const;

type Sort = NonNullable<ScreenerParams['sort']>;

function SortHeader({
  label,
  field,
  sort,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: Sort;
  sort: Sort;
  dir: 'asc' | 'desc';
  onSort: (f: Sort) => void;
  className?: string;
}) {
  const active = sort === field;
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2 font-medium', className)}
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

const price = (r: ScreenerRowDto) =>
  formatCents(toCents(Number(r.asset.price).toFixed(2)), r.asset.currency);

export function ScreenerView() {
  const router = useRouter();
  const filtersQuery = useScreenerFilters();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ComplianceStatus | ''>('');
  const [exchange, setExchange] = useState('');
  const [sector, setSector] = useState('');
  const [capIndex, setCapIndex] = useState(0);
  const [sort, setSort] = useState<Sort>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const q = useDebouncedValue(text.trim(), 300);
  const cap = CAP_PRESETS[capIndex]!;
  const params: ScreenerParams = {
    q,
    status,
    exchange,
    sector,
    minCapBn: cap.min,
    maxCapBn: cap.max,
    sort,
    dir,
    page,
  };
  const query = useScreener(params);

  // Any change to what is being searched goes back to the first page.
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const onSort = (field: Sort) => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir('asc');
    }
    setPage(1);
  };

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / SCREENER_PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halal stock screener</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Check a company against the AAOIFI business and financial-ratio screens.
        </p>
      </div>

      <SampleDataNotice />

      <Card title="Find a stock">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              value={text}
              onChange={(e) => reset(setText)(e.target.value)}
              placeholder="Search by name or ticker, e.g. Apple or EMAAR"
              aria-label="Search stocks"
              className={cn(controlClass, 'pl-9')}
            />
          </div>
          <div role="group" aria-label="Filters" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              Status
              <select
                className={select}
                value={status}
                onChange={(e) => reset(setStatus)(e.target.value as ComplianceStatus | '')}
              >
                <option value="">All</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="DOUBTFUL">Doubtful</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Exchange
              <select
                className={select}
                value={exchange}
                onChange={(e) => reset(setExchange)(e.target.value)}
              >
                <option value="">All</option>
                {filtersQuery.data?.exchanges.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sector
              <select
                className={select}
                value={sector}
                onChange={(e) => reset(setSector)(e.target.value)}
              >
                <option value="">All</option>
                {filtersQuery.data?.sectors.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Market cap
              <select
                className={select}
                value={capIndex}
                onChange={(e) => reset(setCapIndex)(Number(e.target.value))}
              >
                {CAP_PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card title={query.isPending ? 'Results' : `${total} ${total === 1 ? 'result' : 'results'}`}>
        {query.isPending ? (
          <p className="text-zinc-500">Loading…</p>
        ) : query.isError ? (
          <div className="flex items-center gap-3">
            <p className="text-red-600">Could not load stocks.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-zinc-500">No stocks match. Try clearing a filter.</p>
        ) : (
          <div className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}>
            {/* Wide screens: a table. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <SortHeader
                      label="Company"
                      field="name"
                      sort={sort}
                      dir={dir}
                      onSort={onSort}
                    />
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Price
                    </th>
                    <SortHeader
                      label="Market cap"
                      field="marketCap"
                      sort={sort}
                      dir={dir}
                      onSort={onSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Status"
                      field="status"
                      sort={sort}
                      dir={dir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Debt ratio"
                      field="debt"
                      sort={sort}
                      dir={dir}
                      onSort={onSort}
                      className="text-right"
                    />
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Non-compliant revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {rows.map((r) => (
                    <tr key={r.asset.symbol} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelected(r.asset.symbol)}
                          className="text-left hover:underline"
                        >
                          <span className="font-medium">{r.asset.name}</span>
                          <span className="block text-xs text-zinc-500">
                            {r.asset.symbol} · {r.asset.exchange}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{price(r)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMarketCap(r.asset.marketCapUsd)}
                      </td>
                      <td className="px-3 py-2">
                        <ComplianceBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPercent(r.debtRatio)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPercent(r.haramRevenueRatio)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones: one card per stock instead of a table you would have to scroll sideways. */}
            <ul className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
              {rows.map((r) => (
                <li key={r.asset.symbol}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.asset.symbol)}
                    className="flex w-full flex-col gap-1.5 py-3 text-left"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-medium">{r.asset.name}</span>
                      <ComplianceBadge status={r.status} />
                    </span>
                    <span className="text-sm text-zinc-500">
                      {r.asset.symbol} · {price(r)} · {formatMarketCap(r.asset.marketCapUsd)}
                    </span>
                    <span className="text-sm text-zinc-500">
                      Debt {formatPercent(r.debtRatio)} · non-compliant revenue{' '}
                      {formatPercent(r.haramRevenueRatio)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-zinc-500">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </div>
        )}
      </Card>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title="Stock details">
        {selected && (
          <ScreenerDetail
            symbol={selected}
            onAdd={(s) => {
              setSelected(null);
              router.push(`/portfolio?add=${encodeURIComponent(s)}`);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
