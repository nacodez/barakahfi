'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { CreateHoldingInput, HoldingDto, OffsetMeta, PortfolioDto } from '@barakahfi/shared';
import { api, apiPage } from '@/lib/api';
import { buildQuery } from '@/lib/transaction-utils';

export type PortfolioSort =
  | 'name'
  | 'quantity'
  | 'avgBuyPrice'
  | 'currentPrice'
  | 'value'
  | 'gainLoss'
  | 'gainLossPercent'
  | 'allocation'
  | 'status';

export interface PortfolioParams {
  sort?: PortfolioSort;
  dir?: 'asc' | 'desc';
  page?: number;
}

export const PORTFOLIO_PAGE_SIZE = 10;

export function usePortfolio(params: PortfolioParams) {
  return useQuery({
    queryKey: ['portfolio', params],
    queryFn: () =>
      apiPage<PortfolioDto, OffsetMeta>(
        `/portfolio${buildQuery({ ...params, limit: PORTFOLIO_PAGE_SIZE })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

/** A change to holdings also changes the zakat estimate, so refresh that too. */
const refresh = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['portfolio'] }),
    qc.invalidateQueries({ queryKey: ['zakat'] }),
  ]);

export function useCreateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHoldingInput) =>
      api<HoldingDto>('/holdings', { method: 'POST', body: input }),
    onSuccess: () => refresh(qc),
  });
}

export function useUpdateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & Partial<
      Pick<CreateHoldingInput, 'quantity' | 'avgBuyPrice' | 'purchaseDate' | 'dividendsReceived'>
    >) => api<HoldingDto>(`/holdings/${id}`, { method: 'PATCH', body }),
    onSuccess: () => refresh(qc),
  });
}

export function useDeleteHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<null>(`/holdings/${id}`, { method: 'DELETE' }),
    // Optimistic: drop the row at once, put it back if the server refuses.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['portfolio'] });
      const snapshot = qc.getQueriesData<{ data: PortfolioDto; meta: OffsetMeta }>({
        queryKey: ['portfolio'],
      });
      for (const [key, value] of snapshot) {
        if (!value) continue;
        qc.setQueryData(key, {
          ...value,
          data: { ...value.data, rows: value.data.rows.filter((r) => r.id !== id) },
        });
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([key, value]) => qc.setQueryData(key, value)),
    onSettled: () => refresh(qc),
  });
}
