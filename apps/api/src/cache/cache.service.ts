import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env';

export type RedisStatus = 'up' | 'down' | 'disabled';

/** How long a price is kept as a last-known fallback, even after it stops counting as fresh. */
export const LAST_KNOWN_TTL_SECONDS = 24 * 60 * 60;

/**
 * JSON key/value cache: Redis when REDIS_URL is set, in-memory otherwise.
 * Redis errors never reach the caller. Writes also go to memory, so an outage falls back
 * to a per-instance cache instead of failing.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly redis: Redis | null;

  constructor(config?: ConfigService<Env, true>) {
    const url = config?.get('REDIS_URL', { infer: true });
    if (!url) {
      this.redis = null;
      if (config) this.logger.log('REDIS_URL not set, using in-memory cache only');
      return;
    }
    this.redis = new Redis(url, {
      // Fail fast instead of queueing commands while Redis is down.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      // Keep trying to reconnect in the background, at most every 5s.
      retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
    });
    let reported = false;
    this.redis.on('error', (e: Error) => {
      if (!reported) this.logger.warn(`Redis unavailable, using memory fallback: ${e.message}`);
      reported = true;
    });
    this.redis.on('ready', () => {
      reported = false;
      this.logger.log('Connected to Redis');
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch {
        // fall through to memory
      }
    }
    const hit = this.memory.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return undefined;
    }
    return JSON.parse(hit.value) as T;
  }

  /** `ttlSeconds` is how long the entry may exist at all (not how long it counts as fresh). */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
    if (!this.redis) return;
    try {
      await this.redis.set(key, raw, 'EX', ttlSeconds);
    } catch {
      // memory copy is already written
    }
  }

  /** Used by /health. Redis being down is "degraded", not "failed". */
  async status(): Promise<RedisStatus> {
    if (!this.redis) return 'disabled';
    try {
      return (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}
