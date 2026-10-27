import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE, describeDays, effectiveFrom, validateRoutine } from './routine';

describe('validateRoutine', () => {
  it('rutina standarde është e vlefshme', () => {
    expect(validateRoutine(DEFAULT_ROUTINE)).toBeNull();
  });
  it('kërkon të paktën një ditë', () => {
    expect(validateRoutine({ ...DEFAULT_ROUTINE, days: [] })).toBe('noDays');
  });
  it('fillimi duhet të jetë para fundit', () => {
    expect(validateRoutine({ ...DEFAULT_ROUTINE, startTime: '16:00', endTime: '07:00' })).toBe('timeOrder');
    expect(validateRoutine({ ...DEFAULT_ROUTINE, startTime: '08:00', endTime: '08:00' })).toBe('timeOrder');
  });
  it('pauza duhet të jetë brenda orarit', () => {
    expect(validateRoutine({ ...DEFAULT_ROUTINE, breakStart: '06:30' })).toBe('breakOutside');
    expect(validateRoutine({ ...DEFAULT_ROUTINE, breakStart: '15:45', breakMin: 30 })).toBe('breakOutside');
    expect(validateRoutine({ ...DEFAULT_ROUTINE, breakStart: '15:30', breakMin: 30 })).toBeNull();
  });
  it('pa pauzë nuk ka nevojë për orën e pauzës', () => {
    expect(validateRoutine({ ...DEFAULT_ROUTINE, breakStart: null, breakMin: 0 })).toBeNull();
    expect(validateRoutine({ ...DEFAULT_ROUTINE, breakStart: null, breakMin: 30 })).toBe('breakOutside');
  });
});

describe('effectiveFrom', () => {
  // 10:00 UTC = 12:00 në Berlin (verë)
  it('para orës së fillimit: vlen sot', () => {
    expect(effectiveFrom('2026-10-27T04:00:00Z', '07:00')).toBe('2026-10-27'); // 06:00 Berlin
  });
  it('pas orës së fillimit: vlen nga nesër', () => {
    expect(effectiveFrom('2026-10-27T10:00:00Z', '07:00')).toBe('2026-10-28'); // 11:00 Berlin
  });
  it('përdor datën e Berlinit, jo të UTC', () => {
    // 23:30 UTC = 00:30 Berlin e 28-ës; fillimi 07:00 është ende përpara
    expect(effectiveFrom('2026-10-27T22:30:00Z', '07:00')).toBe('2026-10-28');
  });
});

describe('describeDays', () => {
  const names = (d: number) => ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][d];
  it('ditë njëpas njëshi → diapazon', () => {
    expect(describeDays([1, 2, 3, 4, 5], names)).toBe('Mo–Fr');
  });
  it('ditë të shpërndara → listë', () => {
    expect(describeDays([1, 3, 5], names)).toBe('Mo, Mi, Fr');
    expect(describeDays([6, 7], names)).toBe('Sa, So');
  });
  it('rendit dhe heq të përsëritura', () => {
    expect(describeDays([5, 1, 2, 3, 5], names)).toBe('Mo, Di, Mi, Fr');
  });
});
