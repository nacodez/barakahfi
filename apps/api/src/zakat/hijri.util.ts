import { HAWL_DAYS } from '@barakahfi/shared';

const HIJRI = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  year: 'numeric',
  timeZone: 'UTC',
});

/** The Hijri (Umm al-Qura) year containing this date, e.g. 1448. */
export function hijriYear(date: Date): number {
  const part = HIJRI.formatToParts(date).find((p) => p.type === 'year');
  return Number.parseInt(part?.value ?? '', 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the zakat year completes (start plus ~354 days) and how many days remain from `today`. */
export function hawl(start: Date | null, today: Date): { end: Date; daysRemaining: number } | null {
  if (!start) return null;
  const end = new Date(start.getTime() + HAWL_DAYS * DAY_MS);
  return { end, daysRemaining: Math.round((end.getTime() - today.getTime()) / DAY_MS) };
}
