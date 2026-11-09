import { describe, expect, it } from 'vitest';
import { backoffDelay } from './use-websocket';

describe('backoffDelay', () => {
  const noJitter = () => 0.5; // 0.75 + 0.5 * 0.5 = 1.0

  it('doubles each attempt', () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffDelay(n, noJitter))).toEqual([
      1000, 2000, 4000, 8000, 16000,
    ]);
  });

  it('never exceeds 30 seconds (plus jitter)', () => {
    expect(backoffDelay(10, noJitter)).toBe(30_000);
    expect(backoffDelay(50, noJitter)).toBe(30_000);
  });

  it('stays within ±25% of the base delay', () => {
    expect(backoffDelay(2, () => 0)).toBe(3000);
    expect(backoffDelay(2, () => 1)).toBe(5000);
  });
});
