'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  AccountDto,
  CategoryDto,
  CreateTransactionInput,
  CursorMeta,
  TransactionDto,
  TransactionSummaryDto,
} from '@barakahfi/shared';
import { api, apiPage } from '@/lib/api';
import {
  buildQuery,
  insertSorted,
  matchesFilters,
  type TransactionFilters,
} from '@/lib/transaction-utils';
import { accountsKey } from './use-accounts';

interface Page {
  data: TransactionDto[];
  meta: CursorMeta;
}
type Infinite = InfiniteData<Page, string | null>;
type Snapshot = Array<[readonly unknown[], Infinite | undefined]>;

export function useTransactions(filters: TransactionFilters, limit = 20) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters, limit],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiPage<TransactionDto[], CursorMeta>(
        `/transactions${buildQuery({ ...filters, limit, cursor: pageParam })}`,
      ),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
}

export function useTransactionSummary(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['transaction-summary', range],
    queryFn: () => api<TransactionSummaryDto[]>(`/transactions/summary${buildQuery(range)}`),
  });
}

/** A transaction changes balances, budgets and reports too, so refresh everything derived from it. */
function invalidateLedger(qc: QueryClient) {
  return Promise.all(
    [['transactions'], ['transaction-summary'], accountsKey, ['budgets'], ['reports']].map(
      (queryKey) => qc.invalidateQueries({ queryKey }),
    ),
  );
}

function transactionLists(qc: QueryClient): Snapshot {
  return qc.getQueriesData<Infinite>({ queryKey: ['transactions'] });
}

function restore(qc: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
}

/** Build the row the user will see immediately, from data we already have cached. */
function provisionalRow(qc: QueryClient, input: CreateTransactionInput): TransactionDto {
  const accounts = qc.getQueryData<AccountDto[]>(accountsKey) ?? [];
  const categories = qc.getQueryData<CategoryDto[]>(['categories']) ?? [];
  const account = accounts.find((a) => a.id === input.accountId);
  const target = accounts.find((a) => a.id === input.transferAccountId);
  const category = categories.find((c) => c.id === input.categoryId);
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    type: input.type,
    amount: input.amount,
    description: input.description ?? '',
    date: input.date,
    accountId: input.accountId,
    accountName: account?.name ?? '…',
    currency: account?.currency ?? '',
    transferAccountId: input.transferAccountId ?? null,
    transferAccountName: target?.name ?? null,
    categoryId: input.categoryId ?? null,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    categoryHalalStatus: category?.halalStatus ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      api<TransactionDto>('/transactions', { method: 'POST', body: input }),
    // Optimistic: show the row at once, roll back if the server says no.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['transactions'] });
      const snapshot = transactionLists(qc);
      const row = provisionalRow(qc, input);
      for (const [key, data] of snapshot) {
        const filters = key[1] as TransactionFilters;
        const first = data?.pages[0];
        if (!data || !first || !matchesFilters(row, filters)) continue;
        qc.setQueryData<Infinite>(key, {
          ...data,
          pages: [{ ...first, data: insertSorted(first.data, row) }, ...data.pages.slice(1)],
        });
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshot),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTransactionInput }) =>
      api<TransactionDto>(`/transactions/${id}`, { method: 'PATCH', body: input }),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<null>(`/transactions/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['transactions'] });
      const snapshot = transactionLists(qc);
      for (const [key, data] of snapshot) {
        if (!data) continue;
        qc.setQueryData<Infinite>(key, {
          ...data,
          pages: data.pages.map((p) => ({ ...p, data: p.data.filter((t) => t.id !== id) })),
        });
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshot),
    onSettled: () => invalidateLedger(qc),
  });
}
