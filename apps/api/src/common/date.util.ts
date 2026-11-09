import { BadRequestException } from '@nestjs/common';

/** Parse a strict `YYYY-MM-DD` into a UTC-midnight Date, rejecting impossible dates like 2026-02-31. */
export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    formatDateOnly(date) !== value
  ) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}

export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/** Today as a UTC calendar date. */
export const todayUtc = (): Date => parseDateOnly(new Date().toISOString().slice(0, 10));
