import { describe, expect, it } from 'vitest';
import { addDays, berlinHhmm, berlinLocalToIso, isValidHhmm } from './berlin';

describe('ora e Berlinit', () => {
  it('dimër = UTC+1, verë = UTC+2', () => {
    expect(berlinLocalToIso('2026-01-15', '07:00')).toBe('2026-01-15T06:00:00.000Z');
    expect(berlinLocalToIso('2026-07-15', '07:00')).toBe('2026-07-15T05:00:00.000Z');
  });

  it('ditët e ndryshimit të orës', () => {
    // 29 mars 2026: 02:00 → 03:00; 25 tetor 2026: 03:00 → 02:00
    expect(berlinLocalToIso('2026-03-29', '08:00')).toBe('2026-03-29T06:00:00.000Z');
    expect(berlinLocalToIso('2026-10-25', '08:00')).toBe('2026-10-25T07:00:00.000Z');
  });

  it('kthimi mbrapsht jep të njëjtën orë', () => {
    for (const [d, t] of [['2026-01-15', '07:30'], ['2026-07-15', '23:59'], ['2026-03-30', '00:05']]) {
      expect(berlinHhmm(berlinLocalToIso(d, t))).toBe(t);
    }
  });

  it('validon HH:MM', () => {
    expect(isValidHhmm('07:05')).toBe(true);
    expect(isValidHhmm('7:05')).toBe(false);
    expect(isValidHhmm('24:00')).toBe(false);
    expect(isValidHhmm('12:60')).toBe(false);
  });

  it('addDays kalon kufijtë e muajit', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
