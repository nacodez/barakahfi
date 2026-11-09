import { z } from 'zod';
import { AccountType, BudgetPeriod, CategoryType, HalalStatus, TransactionType } from './enums';

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
  name: z.string().trim().min(1, 'Account name is required').max(LIMITS.ACCOUNT_NAME_MAX),
  type: z.enum(AccountType),
  currency: z.string().regex(CURRENCY_REGEX, 'Use a 3-letter code in capitals, e.g. AED'),
  /** Money crosses the wire as a decimal string, never a float. */
  balance: z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/, 'Up to 2 decimal places'),
  isZakatable: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/** Positive money string with up to 2 decimals, e.g. "12.50". */
export const POSITIVE_AMOUNT_REGEX = /^(?!0+(\.0{1,2})?$)\d{1,13}(\.\d{1,2})?$/;
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const amountSchema = z
  .string()
  .regex(POSITIVE_AMOUNT_REGEX, 'Enter an amount greater than 0, with up to 2 decimals');
const dateSchema = z
  .string()
  .regex(DATE_ONLY_REGEX, 'Use the format YYYY-MM-DD')
  .refine(
    (d) =>
      !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) &&
      new Date(`${d}T00:00:00Z`).toISOString().startsWith(d),
    'Not a real date',
  );

export const createTransactionSchema = z
  .object({
    type: z.enum(TransactionType),
    accountId: z.uuid('Choose an account'),
    /** TRANSFER only: the account the money goes to. */
    transferAccountId: z.uuid().nullish(),
    categoryId: z.uuid().nullish(),
    amount: amountSchema,
    description: z.string().trim().max(255).default(''),
    date: dateSchema,
  })
  .superRefine((v, ctx) => {
    if (v.type === 'TRANSFER') {
      if (!v.transferAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['transferAccountId'],
          message: 'Choose the destination account',
        });
      } else if (v.transferAccountId === v.accountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['transferAccountId'],
          message: 'Choose a different account',
        });
      }
      if (v.categoryId) {
        ctx.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'Transfers have no category',
        });
      }
    } else if (v.transferAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['transferAccountId'],
        message: 'Only transfers have a destination',
      });
    }
  });
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  type: z.enum(CategoryType),
  icon: z.string().trim().min(1).max(30).default('🏷️'),
  halalStatus: z.enum(HalalStatus).default('NEUTRAL'),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;

export const createBudgetSchema = z.object({
  categoryId: z.uuid('Choose a category'),
  amount: amountSchema,
  period: z.enum(BudgetPeriod).default('MONTHLY'),
  startDate: dateSchema,
});
export type CreateBudgetInput = z.input<typeof createBudgetSchema>;

/** Positive decimal with at most `dp` decimals and `int` integer digits. */
const positiveDecimal = (int: number, dp: number) =>
  new RegExp(`^(?!0+(\\.0+)?$)\\d{1,${int}}(\\.\\d{1,${dp}})?$`);

export const QUANTITY_REGEX = positiveDecimal(9, 6);
export const PRICE_REGEX = positiveDecimal(11, 4);
export const NON_NEGATIVE_AMOUNT_REGEX = /^\d{1,13}(\.\d{1,2})?$/;

export const createHoldingSchema = z.object({
  symbol: z.string().trim().min(1, 'Choose a stock').max(20),
  quantity: z.string().regex(QUANTITY_REGEX, 'Enter a quantity greater than 0 (up to 6 decimals)'),
  avgBuyPrice: z.string().regex(PRICE_REGEX, 'Enter a price greater than 0 (up to 4 decimals)'),
  purchaseDate: dateSchema,
  accountId: z.uuid().nullish(),
  dividendsReceived: z
    .string()
    .regex(NON_NEGATIVE_AMOUNT_REGEX, 'Enter 0 or more, with up to 2 decimals')
    .default('0'),
});
export type CreateHoldingInput = z.input<typeof createHoldingSchema>;
