import type { TransactionDto, TransactionType } from '@barakahfi/shared';

export interface TransactionFilters {
  type?: TransactionType | '';
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}

/** Same rules the API applies, so an optimistically added row only shows in lists it belongs in. */
export function matchesFilters(t: TransactionDto, f: TransactionFilters): boolean {
  if (f.type && t.type !== f.type) return false;
  if (f.categoryId && t.categoryId !== f.categoryId) return false;
  if (f.accountId && t.accountId !== f.accountId && t.transferAccountId !== f.accountId)
    return false;
  if (f.from && t.date < f.from) return false;
  if (f.to && t.date > f.to) return false;
  return true;
}

export function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Rows are ordered newest date first, then by id, matching the API. */
export function insertSorted(list: TransactionDto[], item: TransactionDto): TransactionDto[] {
  const i = list.findIndex((t) => t.date < item.date);
  if (i === -1) return [...list, item];
  return [...list.slice(0, i), item, ...list.slice(i)];
}
