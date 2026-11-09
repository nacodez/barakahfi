/**
 * Regular trading hours, evaluated in each exchange's own time zone so daylight saving is
 * handled correctly. Public holidays are not modelled: on a holiday the feed simply returns
 * an unchanged price.
 */
const SESSIONS: Record<string, { zone: string; open: number; close: number }> = {
  NASDAQ: { zone: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
  NYSE: { zone: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
  DFM: { zone: 'Asia/Dubai', open: 10 * 60, close: 14 * 60 + 45 },
};

export function isMarketOpen(exchange: string | null, now: Date = new Date()): boolean {
  const session = exchange ? SESSIONS[exchange] : undefined;
  if (!session) return false;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: session.zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return minutes >= session.open && minutes < session.close;
}
