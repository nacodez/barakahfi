'use client';

import { useQuery } from '@tanstack/react-query';
import type { CategoryDto } from '@barakahfi/shared';
import { api } from '@/lib/api';

export function useCategories() {
  // Categories rarely change, so keep them for a while.
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryDto[]>('/categories'),
    staleTime: 10 * 60_000,
  });
}
