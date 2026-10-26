export interface Break {
  startedAt: string;
  endedAt: string | null;
}

export interface Shift {
  id: string;
  employeeId: string;
  startedAt: string;
  endedAt: string | null;
  breaks: Break[];
  /** Pauza e deklaruar te STOP (në minuta), shtohet te pauzat me buton. */
  declaredBreakMin?: number;
  /** Emri i Baustelle-s (për raportet). */
  siteName?: string | null;
}

export interface Settings {
  /** Orët shtesë ditore: mbi sa orë në ditë. null = nuk përdoret. */
  overtimeDailyAfterH: number | null;
  /** Orët shtesë javore: mbi sa orë në javë. Përdoret vetëm nëse ditorja është null. */
  overtimeWeeklyAfterH: number | null;
  overtimeSurchargePct: number;
  /** Paga minimale në cent/orë, sipas vitit. */
  minWageCentsByYear: Record<number, number>;
}

export interface Rate {
  validFrom: string;
  hourlyRateCents: number;
}

export type WarningCode =
  | 'OPEN_SHIFT'
  | 'DAILY_OVER_10H'
  | 'BREAK_TOO_SHORT'
  | 'SUNDAY_WORK'
  | 'HOLIDAY_WORK'
  | 'REST_UNDER_11H'
  | 'BELOW_MIN_WAGE'
  | 'NO_RATE';

export interface Warning {
  code: WarningCode;
  shiftId?: string;
  date?: string;
}

export interface DayResult {
  shiftId: string;
  date: string;
  grossMin: number;
  breakMin: number;
  workedMin: number;
  warnings: Warning[];
}

export interface MonthResult {
  workedMin: number;
  regularMin: number;
  overtimeMin: number;
  grossCents: number;
  days: DayResult[];
  warnings: Warning[];
}
