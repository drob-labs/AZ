import { minutesBetween } from './berlin';
import { requiredBreakMin } from './hours';

export interface LocalBreak {
  clientId: string;
  startedAt: string;
  endedAt: string | null;
}

/** Turni siç ruhet në telefon, përpara se të sinkronizohet. */
export interface LocalShift {
  clientId: string;
  siteId: string | null;
  startedAt: string;
  endedAt: string | null;
  breaks: LocalBreak[];
  declaredBreakMin: number | null;
}

export type TrackerStatus = 'idle' | 'working' | 'paused';

export function statusOf(shift: LocalShift | null): TrackerStatus {
  if (!shift || shift.endedAt) return 'idle';
  return shift.breaks.some((b) => b.endedAt === null) ? 'paused' : 'working';
}

export function startShift(now: string, clientId: string, siteId: string | null = null): LocalShift {
  return { clientId, siteId, startedAt: now, endedAt: null, breaks: [], declaredBreakMin: null };
}

export function pauseShift(shift: LocalShift, now: string, breakClientId: string): LocalShift {
  if (statusOf(shift) !== 'working') throw new Error('invalid: pause');
  return { ...shift, breaks: [...shift.breaks, { clientId: breakClientId, startedAt: now, endedAt: null }] };
}

export function resumeShift(shift: LocalShift, now: string): LocalShift {
  if (statusOf(shift) !== 'paused') throw new Error('invalid: resume');
  return {
    ...shift,
    breaks: shift.breaks.map((b) => (b.endedAt === null ? { ...b, endedAt: now } : b)),
  };
}

/** STOP mbyll edhe pauzën e hapur, nëse ka. */
export function stopShift(shift: LocalShift, now: string, declaredBreakMin: number | null = null): LocalShift {
  if (statusOf(shift) === 'idle') throw new Error('invalid: stop');
  return {
    ...shift,
    endedAt: now,
    declaredBreakMin,
    breaks: shift.breaks.map((b) => (b.endedAt === null ? { ...b, endedAt: now } : b)),
  };
}

export function breakMinutes(shift: LocalShift, now: string): number {
  const fromButtons = shift.breaks.reduce(
    (sum, b) => sum + minutesBetween(b.startedAt, b.endedAt ?? now),
    0,
  );
  return fromButtons + (shift.declaredBreakMin ?? 0);
}

/** Minutat e punës deri tani (pa pauza). */
export function elapsedWorkedMin(shift: LocalShift, now: string): number {
  const end = shift.endedAt ?? now;
  return Math.max(0, minutesBetween(shift.startedAt, end) - breakMinutes(shift, now));
}

/** Milisekondat e punës deri tani (pa pauza me buton), për kohëmatësin. */
export function workedMs(shift: LocalShift, nowMs: number): number {
  const end = shift.endedAt ? Date.parse(shift.endedAt) : nowMs;
  const breaks = shift.breaks.reduce(
    (sum, b) => sum + Math.max(0, (b.endedAt ? Date.parse(b.endedAt) : nowMs) - Date.parse(b.startedAt)),
    0,
  );
  return Math.max(0, end - Date.parse(shift.startedAt) - breaks);
}

/** Sa minuta pauzë i mungojnë turnit sipas ArbZG §4 (0 nëse është në rregull). */
export function breakShortfallMin(shift: LocalShift, now: string): number {
  const gross = minutesBetween(shift.startedAt, shift.endedAt ?? now);
  const taken = breakMinutes(shift, now);
  const required = requiredBreakMin(Math.max(0, gross - taken));
  return Math.max(0, required - taken);
}
