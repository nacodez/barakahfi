/** Every API response uses this envelope: { data, meta, error }. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface OffsetMeta {
  page: number;
  limit: number;
  total: number;
}

export interface CursorMeta {
  nextCursor: string | null;
  limit: number;
}

export interface ApiResponse<T, M = Record<string, unknown> | null> {
  data: T | null;
  meta: M | null;
  error: ApiError | null;
}

/** Money is serialized as a string to avoid IEEE-754 rounding (e.g. "1250.50"). */
export type Money = string;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  currency: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
}

export interface AccountDto {
  id: string;
  name: string;
  type: import('./enums').AccountType;
  currency: string;
  balance: Money;
  isZakatable: boolean;
  archivedAt: string | null;
  createdAt: string;
}
