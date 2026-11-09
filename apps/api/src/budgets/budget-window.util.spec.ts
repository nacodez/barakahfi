import { budgetWindow, hasStarted } from './budget-window.util';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const early = d('2020-01-01');

describe('budgetWindow', () => {
  it('monthly: the calendar month containing the reference date', () => {
    const w = budgetWindow('MONTHLY', early, d('2026-11-09'));
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('monthly: December rolls into the next year', () => {
    const w = budgetWindow('MONTHLY', early, d('2026-12-31'));
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-12-01', '2027-01-01']);
  });

  it.each([
    ['2026-01-15', '2026-01-01', '2026-04-01'],
    ['2026-03-31', '2026-01-01', '2026-04-01'],
    ['2026-04-01', '2026-04-01', '2026-07-01'],
    ['2026-11-09', '2026-10-01', '2027-01-01'],
  ])('quarterly: %s -> %s to %s', (ref, start, end) => {
    const w = budgetWindow('QUARTERLY', early, d(ref));
    expect([iso(w.start), iso(w.end)]).toEqual([start, end]);
  });

  it('yearly: the calendar year', () => {
    const w = budgetWindow('YEARLY', early, d('2026-11-09'));
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-01-01', '2027-01-01']);
  });

  it('starts counting from the budget start date when it begins mid-window', () => {
    const w = budgetWindow('MONTHLY', d('2026-11-15'), d('2026-11-20'));
    expect(iso(w.start)).toBe('2026-11-15');
  });

  it('flags a budget that starts after the window as not started', () => {
    const w = budgetWindow('MONTHLY', d('2027-02-01'), d('2026-11-09'));
    expect(hasStarted(d('2027-02-01'), w)).toBe(false);
    expect(hasStarted(d('2026-11-30'), w)).toBe(true);
  });
});
