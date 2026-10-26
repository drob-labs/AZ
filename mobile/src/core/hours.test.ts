import { describe, expect, it } from 'vitest';
import { isoWeekKey } from './berlin';
import { holidaysBW } from './holidays';
import { calculateDay, calculateMonth, rateOn, requiredBreakMin, restPeriodWarnings } from './hours';
import type { Settings, Shift } from './types';

const settings: Settings = {
  overtimeDailyAfterH: 8,
  overtimeWeeklyAfterH: null,
  overtimeSurchargePct: 25,
  minWageCentsByYear: { 2026: 1390 },
};

// Gjatë dimrit Berlini është UTC+1, gjatë verës UTC+2.
function shift(id: string, start: string, end: string | null, extra: Partial<Shift> = {}): Shift {
  return { id, employeeId: 'e1', startedAt: start, endedAt: end, breaks: [], ...extra };
}

describe('requiredBreakMin', () => {
  it('ndjek ArbZG §4', () => {
    expect(requiredBreakMin(6 * 60)).toBe(0);
    expect(requiredBreakMin(6 * 60 + 1)).toBe(30);
    expect(requiredBreakMin(9 * 60)).toBe(30);
    expect(requiredBreakMin(9 * 60 + 1)).toBe(45);
  });
});

describe('calculateDay', () => {
  it('heq pauzën nga koha e punës', () => {
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T15:00:00Z', {
      breaks: [{ startedAt: '2026-03-10T10:00:00Z', endedAt: '2026-03-10T10:30:00Z' }],
    });
    const r = calculateDay(s);
    expect(r.grossMin).toBe(540);
    expect(r.breakMin).toBe(30);
    expect(r.workedMin).toBe(510);
    expect(r.warnings).toEqual([]);
  });

  it('shton pauzën e deklaruar te STOP', () => {
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:30:00Z', { declaredBreakMin: 30 });
    expect(calculateDay(s).workedMin).toBe(480);
  });

  it('paralajmëron për pauzë të shkurtër', () => {
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:00:00Z');
    expect(calculateDay(s).warnings.map((w) => w.code)).toContain('BREAK_TOO_SHORT');
  });

  it('paralajmëron mbi 10 orë', () => {
    const s = shift('a', '2026-03-10T05:00:00Z', '2026-03-10T17:00:00Z', { declaredBreakMin: 45 });
    expect(calculateDay(s).warnings.map((w) => w.code)).toContain('DAILY_OVER_10H');
  });

  it('turn i hapur jep paralajmërim dhe 0 orë', () => {
    const r = calculateDay(shift('a', '2026-03-10T06:00:00Z', null));
    expect(r.workedMin).toBe(0);
    expect(r.warnings[0].code).toBe('OPEN_SHIFT');
  });

  it('dita caktohet sipas orës së Berlinit, jo UTC', () => {
    // 23:30 UTC në dimër = 00:30 e ditës tjetër në Berlin
    const r = calculateDay(shift('a', '2026-01-12T23:30:00Z', '2026-01-13T03:30:00Z'));
    expect(r.date).toBe('2026-01-13');
  });

  it('paralajmëron punën të dielën dhe në festë', () => {
    const sunday = calculateDay(shift('a', '2026-03-08T07:00:00Z', '2026-03-08T11:00:00Z'));
    expect(sunday.warnings.map((w) => w.code)).toContain('SUNDAY_WORK');
    const holiday = calculateDay(shift('b', '2026-05-01T07:00:00Z', '2026-05-01T11:00:00Z'));
    expect(holiday.warnings.map((w) => w.code)).toContain('HOLIDAY_WORK');
  });
});

describe('restPeriodWarnings', () => {
  it('paralajmëron kur pushimi mes turneve është nën 11 orë', () => {
    const a = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T18:00:00Z');
    const b = shift('b', '2026-03-11T02:00:00Z', '2026-03-11T08:00:00Z');
    expect(restPeriodWarnings([a, b]).map((w) => w.shiftId)).toEqual(['b']);
  });
  it('nuk paralajmëron me 11 orë ose më shumë', () => {
    const a = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:00:00Z');
    const b = shift('b', '2026-03-11T01:00:00Z', '2026-03-11T08:00:00Z');
    expect(restPeriodWarnings([a, b])).toEqual([]);
  });
});

describe('rateOn', () => {
  const rates = [
    { validFrom: '2025-01-01', hourlyRateCents: 1500 },
    { validFrom: '2026-03-01', hourlyRateCents: 1600 },
  ];
  it('merr tarifën e vlefshme në datë', () => {
    expect(rateOn(rates, '2026-02-28')).toBe(1500);
    expect(rateOn(rates, '2026-03-01')).toBe(1600);
    expect(rateOn(rates, '2024-12-31')).toBeNull();
  });
});

describe('calculateMonth', () => {
  const rates = [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }];

  it('llogarit orët e rregullta pa orë shtesë', () => {
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:30:00Z', { declaredBreakMin: 30 });
    const r = calculateMonth([s], rates, settings);
    expect(r.workedMin).toBe(480);
    expect(r.overtimeMin).toBe(0);
    expect(r.grossCents).toBe(16000);
  });

  it('orët shtesë ditore paguhen me shtesë', () => {
    // 10 orë pune: 8 të rregullta + 2 shtesë me +25%
    const s = shift('a', '2026-03-10T05:00:00Z', '2026-03-10T15:45:00Z', { declaredBreakMin: 45 });
    const r = calculateMonth([s], rates, settings);
    expect(r.workedMin).toBe(600);
    expect(r.overtimeMin).toBe(120);
    expect(r.grossCents).toBe(8 * 2000 + 2 * 2500);
  });

  it('orët shtesë javore numërohen mbi pragun e javës', () => {
    const weekly: Settings = { ...settings, overtimeDailyAfterH: null, overtimeWeeklyAfterH: 40 };
    const days = ['09', '10', '11', '12', '13'].map((d) =>
      shift(d, `2026-03-${d}T06:00:00Z`, `2026-03-${d}T15:30:00Z`, { declaredBreakMin: 30 }),
    );
    const r = calculateMonth(days, rates, weekly);
    // 5 × 9h = 45h, pragu 40h → 5h shtesë
    expect(r.workedMin).toBe(45 * 60);
    expect(r.overtimeMin).toBe(5 * 60);
  });

  it('paralajmëron për tarifë nën pagën minimale', () => {
    const low = [{ validFrom: '2026-01-01', hourlyRateCents: 1200 }];
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:30:00Z', { declaredBreakMin: 30 });
    expect(calculateMonth([s], low, settings).warnings.map((w) => w.code)).toContain('BELOW_MIN_WAGE');
  });
});

describe('festat dhe javët', () => {
  it('Pashkët 2026 (5 prill) japin Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag, Fronleichnam', () => {
    const h = holidaysBW(2026);
    expect(h.has('2026-04-03')).toBe(true);
    expect(h.has('2026-04-06')).toBe(true);
    expect(h.has('2026-05-14')).toBe(true);
    expect(h.has('2026-05-25')).toBe(true);
    expect(h.has('2026-06-04')).toBe(true);
    expect(h.has('2026-11-01')).toBe(true);
  });
  it('çelësi i javës ISO', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2026-12-31')).toBe('2026-W53');
  });
});

describe('calculateMonth: ditë me disa turne dhe kufijtë e muajit', () => {
  const rates = [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }];

  it('orët shtesë ditore llogariten mbi gjithë ditën, jo mbi çdo turn', () => {
    const am = shift('a', '2026-03-10T05:00:00Z', '2026-03-10T09:00:00Z'); // 4h
    const pm = shift('b', '2026-03-10T10:00:00Z', '2026-03-10T16:00:00Z'); // 6h, pauza 0 (paralajmërim)
    const r = calculateMonth([am, pm], rates, settings);
    expect(r.workedMin).toBe(600);
    expect(r.overtimeMin).toBe(120); // 10h - 8h
  });

  it('pa tarifë: paralajmërim NO_RATE dhe pa pagë', () => {
    const s = shift('a', '2026-03-10T06:00:00Z', '2026-03-10T14:30:00Z', { declaredBreakMin: 30 });
    const r = calculateMonth([s], [], settings);
    expect(r.grossCents).toBe(0);
    expect(r.workedMin).toBe(480);
    expect(r.warnings.map((w) => w.code)).toContain('NO_RATE');
  });

  it('java që kalon kufirin e muajit: pragu javor përdor gjithë javën, numërohet vetëm muaji', () => {
    const weekly: Settings = { ...settings, overtimeDailyAfterH: null, overtimeWeeklyAfterH: 40 };
    // 9h/ditë pune neto, e njëjta javë ISO (28.09–04.10)
    const days = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) =>
      shift(d, `${d}T06:00:00Z`, `${d}T15:30:00Z`, { declaredBreakMin: 30 }),
    );
    const oct = calculateMonth(days, rates, weekly, '2026-10');
    // java 28.09–04.10: 27h deri më 30.09; më 2.10 kalon 45h (5h shtesë); më 3.10 të 9h janë shtesë
    expect(oct.workedMin).toBe(3 * 9 * 60);
    expect(oct.overtimeMin).toBe(5 * 60 + 9 * 60);
    const sep = calculateMonth(days, rates, weekly, '2026-09');
    expect(sep.workedMin).toBe(3 * 9 * 60);
    expect(sep.overtimeMin).toBe(0);
  });
});
