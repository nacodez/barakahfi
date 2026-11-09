'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  ComplianceStatus,
  OffsetMeta,
  ScreenerDetailDto,
  ScreenerFiltersDto,
  ScreenerRowDto,
} from '@barakahfi/shared';
import { api, apiPage } from '@/lib/api';
import { buildQuery } from '@/lib/transaction-utils';

export interface ScreenerParams {
  q?: string;
  status?: ComplianceStatus | '';
  exchange?: string;
  sector?: string;
  minCapBn?: number | '';
  maxCapBn?: number | '';
  sort?: 'name' | 'symbol' | 'marketCap' | 'debt' | 'status';
  dir?: 'asc' | 'desc';
  page?: number;
}

export const SCREENER_PAGE_SIZE = 15;

export function useScreener(params: ScreenerParams) {
  return useQuery({
    queryKey: ['screener', 'search', params],
    queryFn: () =>
      apiPage<ScreenerRowDto[], OffsetMeta>(
        `/screener${buildQuery({ ...params, limit: SCREENER_PAGE_SIZE })}`,
      ),
    // Keep showing the previous results while the next page or filter loads: no flicker.
    placeholderData: keepPreviousData,
  });
}

export function useScreenerFilters() {
  return useQuery({
    queryKey: ['screener', 'filters'],
    queryFn: () => api<ScreenerFiltersDto>('/screener/filters'),
    staleTime: 60 * 60_000,
  });
}

export function useScreenerDetail(symbol: string | null) {
  return useQuery({
    queryKey: ['screener', 'detail', symbol],
    queryFn: () => api<ScreenerDetailDto>(`/screener/${encodeURIComponent(symbol!)}`),
    enabled: symbol !== null,
    staleTime: 5 * 60_000,
  });
}
