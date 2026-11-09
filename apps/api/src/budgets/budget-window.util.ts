import type { BudgetPeriod } from '@barakahfi/shared';

export interface BudgetWindow {
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
}

/**
 * The calendar window (month, quarter or year) that contains `reference`,
 * with its start moved forward if the budget only begins part-way through.
 * All dates are UTC midnight, matching Postgres DATE columns.
 */
export function budgetWindow(
  period: BudgetPeriod,
  budgetStart: Date,
  reference: Date,
): BudgetWindow {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();

  let start: Date;
  let end: Date;
  switch (period) {
    case 'MONTHLY':
      start = new Date(Date.UTC(y, m, 1));
      end = new Date(Date.UTC(y, m + 1, 1));
      break;
    case 'QUARTERLY': {
      const q = Math.floor(m / 3) * 3;
      start = new Date(Date.UTC(y, q, 1));
      end = new Date(Date.UTC(y, q + 3, 1));
      break;
    }
    case 'YEARLY':
      start = new Date(Date.UTC(y, 0, 1));
      end = new Date(Date.UTC(y + 1, 0, 1));
      break;
  }
  return { start: budgetStart > start ? budgetStart : start, end };
}

/** A budget whose start date is after the window hasn't begun yet. */
export const hasStarted = (budgetStart: Date, window: BudgetWindow): boolean =>
  budgetStart < window.end;
