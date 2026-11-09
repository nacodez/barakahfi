'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CalculateZakatInput,
  SaveZakatInput,
  ZakatCalculationDto,
  ZakatContextDto,
  ZakatRecordDto,
  ZakatSummaryDto,
} from '@barakahfi/shared';
import { api } from '@/lib/api';

export function useZakatContext() {
  return useQuery({
    queryKey: ['zakat', 'context'],
    queryFn: () => api<ZakatContextDto>('/zakat/context'),
  });
}

export function useZakatSummary() {
  return useQuery({
    queryKey: ['zakat', 'summary'],
    queryFn: () => api<ZakatSummaryDto>('/zakat/summary'),
  });
}

export function useZakatRecords() {
  return useQuery({
    queryKey: ['zakat', 'records'],
    queryFn: () => api<ZakatRecordDto[]>('/zakat/records'),
  });
}

/** A preview: nothing is saved. */
export function useCalculateZakat() {
  return useMutation({
    mutationFn: (input: CalculateZakatInput) =>
      api<ZakatCalculationDto>('/zakat/calculate', { method: 'POST', body: input }),
  });
}

export function useSaveZakat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveZakatInput) =>
      api<ZakatRecordDto>('/zakat/records', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zakat'] }),
  });
}

export function useUpdateZakatRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; zakatPaid?: string; notes?: string }) =>
      api<ZakatRecordDto>(`/zakat/records/${id}`, { method: 'PATCH', body }),
    // Optimistic "mark as paid": the figure changes instantly and rolls back on error.
    onMutate: async ({ id, zakatPaid }) => {
      await qc.cancelQueries({ queryKey: ['zakat', 'records'] });
      const previous = qc.getQueryData<ZakatRecordDto[]>(['zakat', 'records']);
      if (previous && zakatPaid !== undefined) {
        qc.setQueryData<ZakatRecordDto[]>(
          ['zakat', 'records'],
          previous.map((r) => (r.id === id ? { ...r, zakatPaid } : r)),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(['zakat', 'records'], ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['zakat'] }),
  });
}
