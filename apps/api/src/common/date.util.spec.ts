import { BadRequestException } from '@nestjs/common';
import { formatDateOnly, parseDateOnly } from './date.util';

describe('date util', () => {
  it('round-trips a valid date', () => {
    expect(formatDateOnly(parseDateOnly('2026-11-09'))).toBe('2026-11-09');
  });

  it('accepts a leap day only in leap years', () => {
    expect(formatDateOnly(parseDateOnly('2028-02-29'))).toBe('2028-02-29');
    expect(() => parseDateOnly('2026-02-29')).toThrow(BadRequestException);
  });

  it.each(['2026-02-31', '2026-13-01', '9/11/2026', '2026-1-1', ''])('rejects %j', (v) => {
    expect(() => parseDateOnly(v)).toThrow(BadRequestException);
  });
});
