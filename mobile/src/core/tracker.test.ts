import { describe, expect, it } from 'vitest';
import { ackSynced, applyShift, emptyState, flushOutbox, type TrackerState } from './outbox';
import {
  breakShortfallMin,
  elapsedWorkedMin,
  pauseShift,
  resumeShift,
  startShift,
  statusOf,
  stopShift,
  workedMs,
} from './tracker';

const t = (hhmm: string) => `2026-03-10T${hhmm}:00Z`;

describe('tracker', () => {
  it('START → PAUZË → VAZHDO → STOP', () => {
    let s = startShift(t('06:00'), 's1');
    expect(statusOf(s)).toBe('working');
    s = pauseShift(s, t('10:00'), 'b1');
    expect(statusOf(s)).toBe('paused');
    s = resumeShift(s, t('10:30'));
    expect(statusOf(s)).toBe('working');
    s = stopShift(s, t('14:30'));
    expect(statusOf(s)).toBe('idle');
    expect(elapsedWorkedMin(s, t('15:00'))).toBe(480);
  });

  it('STOP gjatë pauzës e mbyll pauzën', () => {
    let s = startShift(t('06:00'), 's1');
    s = pauseShift(s, t('10:00'), 'b1');
    s = stopShift(s, t('10:30'));
    expect(s.breaks[0].endedAt).toBe(t('10:30'));
  });

  it('ndalon kalimet e pavlefshme', () => {
    const s = startShift(t('06:00'), 's1');
    expect(() => resumeShift(s, t('07:00'))).toThrow();
    expect(() => stopShift(stopShift(s, t('07:00')), t('08:00'))).toThrow();
    expect(() => pauseShift(pauseShift(s, t('07:00'), 'b'), t('07:10'), 'c')).toThrow();
  });

  it('llogarit sa pauzë i mungon turnit', () => {
    let s = startShift(t('06:00'), 's1');
    s = stopShift(s, t('14:00'));
    expect(breakShortfallMin(s, t('14:00'))).toBe(30);
    s = { ...s, declaredBreakMin: 30 };
    expect(breakShortfallMin(s, t('14:00'))).toBe(0);
  });

  it('kohëmatësi ndalon gjatë pauzës', () => {
    let s = startShift(t('06:00'), 's1');
    s = pauseShift(s, t('08:00'), 'b1');
    // në 09:00 jemi ende në pauzë: kanë kaluar vetëm 2 orë pune
    expect(workedMs(s, Date.parse(t('09:00')))).toBe(2 * 3600_000);
    s = resumeShift(s, t('09:00'));
    expect(workedMs(s, Date.parse(t('10:00')))).toBe(3 * 3600_000);
  });

  it('koha vazhdon të rritet kur turni është i hapur', () => {
    const s = startShift(t('06:00'), 's1');
    expect(elapsedWorkedMin(s, t('07:15'))).toBe(75);
  });
});

describe('outbox', () => {
  it('foto e re e turnit zëvendëson të vjetrën', () => {
    let st: TrackerState = emptyState;
    const a = startShift(t('06:00'), 's1');
    st = applyShift(st, a);
    st = applyShift(st, pauseShift(a, t('10:00'), 'b1'));
    expect(st.outbox).toHaveLength(1);
    expect(st.current?.breaks).toHaveLength(1);
  });

  it('STOP e heq turnin aktual por e lë në radhë', () => {
    const st = applyShift(applyShift(emptyState, startShift(t('06:00'), 's1')), stopShift(startShift(t('06:00'), 's1'), t('14:00')));
    expect(st.current).toBeNull();
    expect(st.outbox).toHaveLength(1);
  });

  it('ack nuk e heq nëse turni ka ndryshuar ndërkohë', () => {
    const a = startShift(t('06:00'), 's1');
    let st = applyShift(emptyState, a);
    const sent = st.outbox[0];
    st = applyShift(st, pauseShift(a, t('10:00'), 'b1'));
    expect(ackSynced(st, sent).outbox).toHaveLength(1);
  });

  it('flush dërgon në radhë dhe ndalon te gabimi', async () => {
    let st: TrackerState = emptyState;
    st = applyShift(st, stopShift(startShift(t('06:00'), 's1'), t('14:00')));
    st = applyShift(st, stopShift(startShift('2026-03-11T06:00:00Z', 's2'), '2026-03-11T14:00:00Z'));
    const load = async () => st;
    const save = async (s: TrackerState) => {
      st = s;
    };

    let calls = 0;
    const flaky = async () => (++calls === 2 ? ({ ok: false, error: 'offline' } as const) : ({ ok: true } as const));
    const r1 = await flushOutbox(load, save, flaky);
    expect(r1).toEqual({ sent: 1, error: 'offline' });
    expect(st.outbox).toHaveLength(1);

    const r2 = await flushOutbox(load, save, async () => ({ ok: true }));
    expect(r2.sent).toBe(1);
    expect(st.outbox).toHaveLength(0);
  });
});
