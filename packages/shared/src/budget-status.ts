import type { BudgetStatus } from './enums';

/** Under 75% is on track, 75-90% a warning, above 90% over budget (per the product spec). */
export const WARNING_FROM_PERCENT = 75;
export const OVER_ABOVE_PERCENT = 90;

export function budgetStatus(percent: number): BudgetStatus {
  if (percent > OVER_ABOVE_PERCENT) return 'OVER';
  if (percent >= WARNING_FROM_PERCENT) return 'WARNING';
  return 'ON_TRACK';
}
