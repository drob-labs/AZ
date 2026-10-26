import type { WarningCode } from '../core/types';
import type { Dict } from '../i18n/sq';

/** Paralajmërimet që shfaqen te përdoruesi, me çelësin e përkthimit. */
export const WARNING_KEY: Partial<Record<WarningCode, keyof Dict>> = {
  DAILY_OVER_10H: 'warnOver10',
  BREAK_TOO_SHORT: 'warnBreak',
  SUNDAY_WORK: 'warnSunday',
  HOLIDAY_WORK: 'warnHoliday',
  REST_UNDER_11H: 'warnRest',
};
