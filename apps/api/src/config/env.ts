import { z } from 'zod';

/** Fail fast at boot if the environment is misconfigured. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  /** Neon/pgBouncer: pooled URL for the app, direct URL for migrations. */
  DIRECT_DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().optional(),
  WEB_ORIGIN: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  /** Concurrent refreshes (e.g. two tabs) within this window aren't treated as token theft. */
  /** Seconds between live price refreshes while someone is connected (markets permitting). */
  PRICE_TICK_SECONDS: z.coerce.number().int().min(5).default(30),
  /** Set to "false" to turn the background ticker off (tests do). */
  PRICE_TICKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  REFRESH_REUSE_LEEWAY_SECONDS: z.coerce.number().int().min(0).default(10),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
