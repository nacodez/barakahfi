import { isMarketOpen } from './market-hours';

const at = (iso: string) => new Date(iso);

describe('isMarketOpen', () => {
  describe('NASDAQ / NYSE (09:30-16:00 New York)', () => {
    it('is open mid-session on a weekday (winter, UTC-5)', () => {
      expect(isMarketOpen('NASDAQ', at('2026-11-10T15:00:00Z'))).toBe(true); // Tue 10:00 ET
      expect(isMarketOpen('NYSE', at('2026-11-10T20:59:00Z'))).toBe(true); // 15:59 ET
    });

    it('opens at 09:30 and closes at 16:00 exactly', () => {
      expect(isMarketOpen('NYSE', at('2026-11-10T14:29:00Z'))).toBe(false); // 09:29
      expect(isMarketOpen('NYSE', at('2026-11-10T14:30:00Z'))).toBe(true); // 09:30
      expect(isMarketOpen('NYSE', at('2026-11-10T21:00:00Z'))).toBe(false); // 16:00
    });

    it('follows daylight saving: the same UTC time is open in summer and closed in winter', () => {
      expect(isMarketOpen('NASDAQ', at('2026-07-14T13:45:00Z'))).toBe(true); // 09:45 EDT
      expect(isMarketOpen('NASDAQ', at('2026-11-10T13:45:00Z'))).toBe(false); // 08:45 EST
    });

    it('is closed at weekends', () => {
      expect(isMarketOpen('NASDAQ', at('2026-11-14T16:00:00Z'))).toBe(false); // Saturday
      expect(isMarketOpen('NASDAQ', at('2026-11-15T16:00:00Z'))).toBe(false); // Sunday
    });
  });

  describe('DFM (10:00-14:45 Dubai, UTC+4)', () => {
    it('is open during the session on weekdays', () => {
      expect(isMarketOpen('DFM', at('2026-11-10T07:00:00Z'))).toBe(true); // 11:00
      expect(isMarketOpen('DFM', at('2026-11-10T10:44:00Z'))).toBe(true); // 14:44
    });

    it('is closed outside the session and at weekends', () => {
      expect(isMarketOpen('DFM', at('2026-11-10T05:59:00Z'))).toBe(false); // 09:59
      expect(isMarketOpen('DFM', at('2026-11-10T10:45:00Z'))).toBe(false); // 14:45
      expect(isMarketOpen('DFM', at('2026-11-14T07:00:00Z'))).toBe(false); // Saturday
    });
  });

  it('treats an unknown or missing exchange as closed', () => {
    expect(isMarketOpen('LSE', at('2026-11-10T10:00:00Z'))).toBe(false);
    expect(isMarketOpen(null, at('2026-11-10T10:00:00Z'))).toBe(false);
  });
});
