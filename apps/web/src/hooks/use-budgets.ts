'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetDto, CreateBudgetInput, MonthlyTotalDto } from '@barakahfi/shared';
import { api } from '@/lib/api';

export const budgetsKey = ['budgets'] as const;

export function useBudgets() {
  return useQuery({ queryKey: budgetsKey, queryFn: () => api<BudgetDto[]>('/budgets') });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) =>
      api<BudgetDto>('/budgets', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) =>
      api<BudgetDto>(`/budgets/${id}`, { method: 'PATCH', body: { amount } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<null>(`/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetsKey }),
  });
}

export function useMonthlyTotals(months = 6) {
  return useQuery({
    queryKey: ['reports', 'monthly', months],
    queryFn: () => api<MonthlyTotalDto[]>(`/reports/monthly?months=${months}`),
  });
}
