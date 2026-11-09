'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountDto, CreateAccountInput } from '@barakahfi/shared';
import { api } from '@/lib/api';

export const accountsKey = ['accounts'] as const;

export function useAccounts() {
  return useQuery({ queryKey: accountsKey, queryFn: () => api<AccountDto[]>('/accounts') });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      api<AccountDto>('/accounts', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKey }),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<AccountDto>(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKey }),
  });
}
