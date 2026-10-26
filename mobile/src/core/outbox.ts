import type { LocalShift } from './tracker';

/** Gjendja që ruhet në telefon: turni aktual dhe radha për sinkronizim. */
export interface TrackerState {
  current: LocalShift | null;
  /** Fotoja e fundit e çdo turni që pret të dërgohet (një për clientId). */
  outbox: LocalShift[];
}

export const emptyState: TrackerState = { current: null, outbox: [] };

/** Vendos turnin aktual dhe fotografinë e tij në radhë. Foto e re zëvendëson të vjetrën. */
export function applyShift(state: TrackerState, shift: LocalShift): TrackerState {
  const outbox = [...state.outbox.filter((s) => s.clientId !== shift.clientId), shift];
  return { current: shift.endedAt ? null : shift, outbox };
}

/** Pas dërgimit me sukses, e heq nga radha vetëm nëse nuk ka ndryshuar ndërkohë. */
export function ackSynced(state: TrackerState, sent: LocalShift): TrackerState {
  return {
    ...state,
    outbox: state.outbox.filter(
      (s) => !(s.clientId === sent.clientId && JSON.stringify(s) === JSON.stringify(sent)),
    ),
  };
}

export type PushResult = { ok: true } | { ok: false; error: string };

/**
 * Dërgon radhën me radhë. Ndalon te gabimi i parë dhe e lë të paprekur
 * atë që mbetet. `load`/`save` lexojnë dhe shkruajnë gjendjen e freskët,
 * sepse përdoruesi mund të shtypë butonin gjatë sinkronizimit.
 */
export async function flushOutbox(
  load: () => Promise<TrackerState>,
  save: (s: TrackerState) => Promise<void>,
  push: (shift: LocalShift) => Promise<PushResult>,
): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  const queue = [...(await load()).outbox];
  for (const item of queue) {
    const res = await push(item);
    if (!res.ok) return { sent, error: res.error };
    await save(ackSynced(await load(), item));
    sent++;
  }
  return { sent };
}
