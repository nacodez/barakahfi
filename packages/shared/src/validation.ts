import { z } from 'zod';
import { AccountType } from './enums';

/** Single source of truth for limits used by Zod (web) and class-validator (api). */
export const LIMITS = {
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  NAME_MAX: 100,
  ACCOUNT_NAME_MAX: 100,
  /** DECIMAL(15,2) → 13 integer digits. */
  AMOUNT_MAX: 9_999_999_999_999.99,
} as const;

/** ≥1 uppercase, ≥1 digit. */
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;
export const CURRENCY_REGEX = /^[A-Z]{3}$/;

export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN, `At least ${LIMITS.PASSWORD_MIN} characters`)
  .max(LIMITS.PASSWORD_MAX)
  .regex(PASSWORD_REGEX, 'Include at least one uppercase letter and one number');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(LIMITS.NAME_MAX),
  email: z.email().toLowerCase(),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.ACCOUNT_NAME_MAX),
  type: z.enum(AccountType),
  currency: z.string().regex(CURRENCY_REGEX, 'ISO 4217 code, e.g. AED'),
  /** Money crosses the wire as a decimal string, never a float. */
  balance: z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/, 'Up to 2 decimal places'),
  isZakatable: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
