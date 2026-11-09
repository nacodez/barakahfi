'use client';

import type { ScreenerRowDto } from '@barakahfi/shared';
import { Search, X } from 'lucide-react';
import { useId, useState } from 'react';
import { ComplianceBadge } from '@/components/compliance-badge';
import { controlClass } from '@/components/ui/field';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useScreener, useScreenerDetail } from '@/hooks/use-screener';
import { cn } from '@/lib/cn';

interface Props {
  /** The chosen ticker, or ''. */
  value: string;
  onChange: (symbol: string) => void;
  error?: string;
}

/** Search-as-you-type stock picker: type a name or ticker, pick a result. */
export function AssetPicker({ value, onChange, error }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebouncedValue(text.trim(), 250);
  const results = useScreener({ q, sort: 'name', page: 1 });
  const chosen = useScreenerDetail(value || null);

  if (value) {
    const asset = chosen.data?.asset;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Stock</span>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{asset?.name ?? value}</p>
            <p className="text-xs text-zinc-500">{value}</p>
          </div>
          <div className="flex items-center gap-2">
            {chosen.data && <ComplianceBadge status={chosen.data.screening.status} />}
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Choose a different stock"
              className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        {chosen.data?.screening.status === 'NON_COMPLIANT' && (
          <p role="note" className="text-sm text-amber-700 dark:text-amber-400">
            This stock did not pass the sample screen. You can still track it, but it will show as
            non-compliant.
          </p>
        )}
      </div>
    );
  }

  const rows: ScreenerRowDto[] = results.data?.data ?? [];
  const listId = `${id}-list`;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Stock
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={text}
          placeholder="Search by name or ticker"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className={cn(controlClass, 'pl-9')}
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching stocks"
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-background shadow-lg dark:border-zinc-800"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">
              {results.isPending ? 'Searching…' : 'No matches'}
            </li>
          ) : (
            rows.map((r) => (
              <li key={r.asset.symbol} role="option" aria-selected={false}>
                <button
                  type="button"
                  // mousedown fires before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(r.asset.symbol);
                    setText('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.asset.name}</span>
                    <span className="text-xs text-zinc-500">
                      {r.asset.symbol} · {r.asset.exchange}
                    </span>
                  </span>
                  <ComplianceBadge status={r.status} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
