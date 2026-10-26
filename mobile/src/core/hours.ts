import { berlinParts, isoWeekKey, minutesBetween, weekday } from './berlin';
import { isHolidayBW } from './holidays';
import type { DayResult, MonthResult, Rate, Settings, Shift, Warning } from './types';

const MAX_DAILY_MIN = 10 * 60;

/** Pauza minimale sipas ArbZG §4, e bazuar në kohën e punës pa pauza. */
export function requiredBreakMin(workedMin: number): number {
  if (workedMin > 9 * 60) return 45;
  if (workedMin > 6 * 60) return 30;
  return 0;
}

export function calculateDay(shift: Shift): DayResult {
  const warnings: Warning[] = [];
  const date = berlinParts(shift.startedAt).date;

  if (!shift.endedAt) {
    warnings.push({ code: 'OPEN_SHIFT', shiftId: shift.id, date });
    return { shiftId: shift.id, date, grossMin: 0, breakMin: 0, workedMin: 0, warnings };
  }

  const grossMin = minutesBetween(shift.startedAt, shift.endedAt);
  const buttonBreakMin = shift.breaks.reduce(
    (sum, b) => (b.endedAt ? sum + minutesBetween(b.startedAt, b.endedAt) : sum),
    0,
  );
  const breakMin = buttonBreakMin + (shift.declaredBreakMin ?? 0);
  const workedMin = Math.max(0, grossMin - breakMin);

  if (workedMin > MAX_DAILY_MIN) warnings.push({ code: 'DAILY_OVER_10H', shiftId: shift.id, date });
  if (breakMin < requiredBreakMin(workedMin)) {
    warnings.push({ code: 'BREAK_TOO_SHORT', shiftId: shift.id, date });
  }
  if (weekday(date) === 0) warnings.push({ code: 'SUNDAY_WORK', shiftId: shift.id, date });
  if (isHolidayBW(date)) warnings.push({ code: 'HOLIDAY_WORK', shiftId: shift.id, date });

  return { shiftId: shift.id, date, grossMin, breakMin, workedMin, warnings };
}

/** Ndalimi i punës: ArbZG §5 kërkon të paktën 11 orë pushim mes dy turneve. */
export function restPeriodWarnings(shifts: Shift[]): Warning[] {
  const done = shifts
    .filter((s) => s.endedAt)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const out: Warning[] = [];
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1];
    const cur = done[i];
    const restMin = minutesBetween(prev.endedAt as string, cur.startedAt);
    if (restMin < 11 * 60) {
      out.push({ code: 'REST_UNDER_11H', shiftId: cur.id, date: berlinParts(cur.startedAt).date });
    }
  }
  return out;
}

/** Tarifa e vlefshme në një datë: rreshti më i ri me validFrom <= date. */
export function rateOn(rates: Rate[], date: string): number | null {
  let best: Rate | null = null;
  for (const r of rates) {
    if (r.validFrom <= date && (!best || r.validFrom > best.validFrom)) best = r;
  }
  return best ? best.hourlyRateCents : null;
}

function centsFor(minutes: number, hourlyCents: number): number {
  return Math.round((minutes * hourlyCents) / 60);
}

/**
 * Llogarit një muaj për një punëtor.
 * Orët shtesë ditore llogariten mbi gjithë turnet e së njëjtës ditë.
 * Për orët shtesë javore jepni turnet e javëve të plota që prekin muajin
 * dhe `monthPrefix` ("2026-10"): javët përdoren për prag, por numërohen vetëm ditët e muajit.
 */
export function calculateMonth(
  shifts: Shift[],
  rates: Rate[],
  settings: Settings,
  monthPrefix?: string,
): MonthResult {
  const inMonth = (date: string | undefined) => !monthPrefix || (date ?? '').startsWith(monthPrefix);
  const sorted = [...shifts].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const allDays = sorted.map(calculateDay);
  const warnings: Warning[] = [...allDays.flatMap((d) => d.warnings), ...restPeriodWarnings(sorted)].filter((w) =>
    inMonth(w.date),
  );

  const minutesByDate = new Map<string, number>();
  for (const d of allDays) minutesByDate.set(d.date, (minutesByDate.get(d.date) ?? 0) + d.workedMin);

  const weekTotals = new Map<string, number>();
  let workedMin = 0;
  let overtimeMin = 0;
  let grossCents = 0;
  let belowMinWageFlagged = false;
  let noRateFlagged = false;

  for (const date of [...minutesByDate.keys()].sort()) {
    const worked = minutesByDate.get(date) ?? 0;
    if (worked === 0) continue;

    let dayOvertime = 0;
    if (settings.overtimeDailyAfterH !== null) {
      dayOvertime = Math.max(0, worked - settings.overtimeDailyAfterH * 60);
    } else if (settings.overtimeWeeklyAfterH !== null) {
      const week = isoWeekKey(date);
      const before = weekTotals.get(week) ?? 0;
      const limit = settings.overtimeWeeklyAfterH * 60;
      dayOvertime = Math.max(0, before + worked - Math.max(limit, before));
      weekTotals.set(week, before + worked);
    }
    if (!inMonth(date)) continue;

    workedMin += worked;
    overtimeMin += dayOvertime;

    const rate = rateOn(rates, date);
    if (rate === null) {
      if (!noRateFlagged) warnings.push({ code: 'NO_RATE', date });
      noRateFlagged = true;
      continue;
    }
    grossCents += centsFor(worked - dayOvertime, rate);
    grossCents += centsFor(dayOvertime, Math.round(rate * (1 + settings.overtimeSurchargePct / 100)));

    const minWage = settings.minWageCentsByYear[Number(date.slice(0, 4))];
    if (minWage !== undefined && rate < minWage && !belowMinWageFlagged) {
      belowMinWageFlagged = true;
      warnings.push({ code: 'BELOW_MIN_WAGE', date });
    }
  }

  return {
    workedMin,
    regularMin: workedMin - overtimeMin,
    overtimeMin,
    grossCents,
    days: allDays.filter((d) => inMonth(d.date)),
    warnings,
  };
}
