const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (what the API's DATE columns expect). */
export const toDateString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = (): string => toDateString(new Date());

/** First and last day of the month containing `ref`. */
export function monthRange(ref: Date = new Date()): { from: string; to: string } {
  return {
    from: toDateString(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    to: toDateString(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
  };
}

/** "2026-11" -> "Nov". */
export function monthLabel(yearMonth: string): string {
  return new Date(`${yearMonth}-01T00:00:00Z`).toLocaleString('en', {
    month: 'short',
    timeZone: 'UTC',
  });
}
