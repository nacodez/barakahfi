'use client';

import type { TransactionDto } from '@barakahfi/shared';
import { useEffect, useRef } from 'react';
import { HalalBadge } from '@/components/halal-badge';
import { Button } from '@/components/ui/button';
import { useDeleteTransaction, useTransactions } from '@/hooks/use-transactions';
import { cn } from '@/lib/cn';
import { formatCents, toCents } from '@/lib/money';
import type { TransactionFilters } from '@/lib/transaction-utils';

function AmountCell({ t }: { t: TransactionDto }) {
  const text = t.currency ? formatCents(toCents(t.amount), t.currency) : t.amount;
  const sign = t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : '';
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        t.type === 'INCOME' && 'text-emerald-700 dark:text-emerald-400',
        t.type === 'EXPENSE' && 'text-red-600 dark:text-red-400',
      )}
    >
      {sign}
      {text}
    </span>
  );
}

function Row({
  t,
  onEdit,
  onDelete,
}: {
  t: TransactionDto;
  onEdit: (t: TransactionDto) => void;
  onDelete: (t: TransactionDto) => void;
}) {
  const pending = t.id.startsWith('optimistic-');
  const title =
    t.type === 'TRANSFER'
      ? `Transfer to ${t.transferAccountName ?? 'account'}`
      : t.description || t.categoryName || 'Transaction';

  return (
    <li className={cn('flex items-center gap-3 py-3', pending && 'opacity-60')}>
      <span className="w-9 shrink-0 text-center text-xl" aria-hidden>
        {t.type === 'TRANSFER' ? '⇄' : (t.categoryIcon ?? '•')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
          <time dateTime={t.date}>{t.date}</time>
          <span>·</span>
          <span>{t.accountName}</span>
          {t.categoryName && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                {t.categoryName}
                <HalalBadge status={t.categoryHalalStatus} />
              </span>
            </>
          )}
        </p>
      </div>
      <AmountCell t={t} />
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          className="h-8 px-2 text-zinc-500"
          disabled={pending}
          aria-label={`Edit ${title}`}
          onClick={() => onEdit(t)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          className="h-8 px-2 text-zinc-500"
          disabled={pending}
          aria-label={`Delete ${title}`}
          onClick={() => onDelete(t)}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function TransactionList({
  filters,
  onEdit,
}: {
  filters: TransactionFilters;
  onEdit: (t: TransactionDto) => void;
}) {
  const query = useTransactions(filters);
  const remove = useDeleteTransaction();
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending) return <p className="py-6 text-zinc-500">Loading…</p>;
  if (query.isError) {
    return (
      <div className="flex items-center gap-3 py-6">
        <p className="text-red-600">Could not load transactions.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const rows = query.data.pages.flatMap((p) => p.data);
  if (rows.length === 0) {
    return <p className="py-6 text-zinc-500">No transactions match. Add your first one above.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((t) => (
          <Row
            key={t.id}
            t={t}
            onEdit={onEdit}
            onDelete={(x) => {
              if (
                window.confirm(
                  `Delete "${x.description || x.categoryName || 'this transaction'}"? The account balance will be restored.`,
                )
              ) {
                remove.mutate(x.id);
              }
            }}
          />
        ))}
      </ul>
      <div
        ref={sentinel}
        className="flex justify-center py-4 text-sm text-zinc-500"
        aria-live="polite"
      >
        {hasNextPage ? (
          // Scrolling loads more automatically; the button is the keyboard-accessible fallback.
          <Button
            variant="outline"
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            Load more
          </Button>
        ) : (
          'You have reached the end.'
        )}
      </div>
    </>
  );
}
