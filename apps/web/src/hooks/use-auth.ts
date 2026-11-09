'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, UserDto } from '@barakahfi/shared';
import { api } from '@/lib/api';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api<UserDto>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<UserDto>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<UserDto>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>('/auth/logout', { method: 'POST' }),
    // Drop every cached query so the next user never sees the previous one's data.
    onSettled: () => qc.clear(),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      zakatStartDate?: string | null;
      nisabMethod?: 'GOLD' | 'SILVER';
      currency?: string;
      name?: string;
    }) => api<UserDto>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: (user) => {
      qc.setQueryData(meKey, user);
      return qc.invalidateQueries({ queryKey: ['zakat'] });
    },
  });
}
