import { addDays, berlinHhmm, berlinParts } from './berlin';

/** Rutina e punëtorit: ditët (ISO: 1 = e hënë ... 7 = e diel) dhe oraret e zakonshme në orën e Berlinit. */
export interface RoutineValues {
  enabled: boolean;
  days: number[];
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakMin: number;
  siteId: string | null;
}

export const DEFAULT_ROUTINE: RoutineValues = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  startTime: '07:00',
  endTime: '16:00',
  breakStart: '12:00',
  breakMin: 30,
  siteId: null,
};

export const BREAK_CHOICES = [0, 15, 30, 45, 60];

export type RoutineError = 'noDays' | 'timeOrder' | 'breakOutside';

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Kontrollon njësoj si databaza: ditë të zgjedhura, fillim para fundit, pauza brenda orarit. */
export function validateRoutine(v: RoutineValues): RoutineError | null {
  if (v.days.length === 0) return 'noDays';
  if (toMinutes(v.startTime) >= toMinutes(v.endTime)) return 'timeOrder';
  if (v.breakMin > 0) {
    if (!v.breakStart) return 'breakOutside';
    const from = toMinutes(v.breakStart);
    if (from < toMinutes(v.startTime) || from + v.breakMin > toMinutes(v.endTime)) return 'breakOutside';
  }
  return null;
}

/**
 * Nga cila datë vlen rutina e sapo ruajtur: sot nëse ora e fillimit nuk ka kaluar ende, përndryshe nga nesër.
 * Kështu rutina e ndezur pasditen nuk regjistron mbrapsht një turn që nuk ka ndodhur.
 */
export function effectiveFrom(nowIso: string, startTime: string): string {
  const { date } = berlinParts(nowIso);
  return toMinutes(berlinHhmm(nowIso)) < toMinutes(startTime) ? date : addDays(date, 1);
}

/** "Hën–Pre" për ditë njëpas njëshi, përndryshe emrat e ndarë me presje. Merr emrat e ditëve sipas ISO (index 1..7). */
export function describeDays(days: number[], names: (isoDay: number) => string): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.length >= 3 && consecutive) return `${names(sorted[0])}–${names(sorted[sorted.length - 1])}`;
  return sorted.map(names).join(', ');
}
