import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { applyShift, emptyState, flushOutbox, type PushResult, type TrackerState } from '../core/outbox';
import {
  breakMinutes,
  breakShortfallMin,
  pauseShift,
  resumeShift,
  startShift,
  statusOf,
  stopShift,
  type LocalShift,
  type TrackerStatus,
} from '../core/tracker';
import { newId, nowIso } from '../lib/id';
import { loadTrackerState, saveTrackerState } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useSession } from './session';

const SYNC_INTERVAL_MS = 30_000;

export interface Site {
  id: string;
  name: string;
  address: string | null;
  photo_path?: string | null;
}

interface Settings {
  breakMode: 'button' | 'ask_at_stop' | 'fixed';
  fixedBreakMin: number;
}
const defaultSettings: Settings = { breakMode: 'ask_at_stop', fixedBreakMin: 30 };

const SITES_KEY = 'az.sites.v1';
const LAST_SITE_KEY = 'az.lastSite';

interface TrackerCtx {
  ready: boolean;
  state: TrackerState;
  current: LocalShift | null;
  status: TrackerStatus;
  pendingCount: number;
  syncError: string | null;
  settings: Settings;
  /** Baustelle-t aktive (ruhen edhe në telefon për punë offline), e para = e fundit e përdorur. */
  sites: Site[];
  start: (siteId?: string | null) => void;
  pause: () => void;
  resume: () => void;
  /** Sa pauzë i mungon turnit para STOP (për pyetjen te ekrani). */
  shortfallBeforeStop: () => number;
  buttonBreakMin: () => number;
  /** STOP. `totalBreakMin` = pauza totale e deklaruar nga punëtori (nëse u pyet). */
  stop: (totalBreakMin?: number | null) => LocalShift | null;
  syncNow: () => Promise<void>;
  /** Lexon gjendjen e freskët: ka turn të hapur ose orë të padërguara? */
  hasUnsynced: () => boolean;
}

const Ctx = createContext<TrackerCtx | null>(null);

function toPayload(s: LocalShift) {
  return {
    clientId: s.clientId,
    siteId: s.siteId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    declaredBreakMin: s.declaredBreakMin,
    breaks: s.breaks,
  };
}

async function push(shift: LocalShift): Promise<PushResult> {
  const { error } = await supabase.rpc('sync_shift', { p: toPayload(shift) });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const stateRef = useRef<TrackerState>(emptyState);
  const [state, setState] = useState<TrackerState>(emptyState);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sites, setSites] = useState<Site[]>([]);
  const syncing = useRef(false);
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: TrackerState) => {
    stateRef.current = next;
    setState(next);
    // Shkrimet në disk bëhen me radhë, që të mos ngatërrohen.
    writeChain.current = writeChain.current.then(() => saveTrackerState(next)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SITES_KEY)
      .then((raw) => {
        if (!raw) return;
        setSites((JSON.parse(raw) as { sites: Site[] }).sites);
      })
      .catch(() => {});
    loadTrackerState().then((s) => {
      stateRef.current = s;
      setState(s);
      setReady(true);
    });
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current || !session) return;
    if (stateRef.current.outbox.length === 0) {
      setSyncError(null);
      return;
    }
    syncing.current = true;
    try {
      const res = await flushOutbox(async () => stateRef.current, async (s) => commit(s), push);
      setSyncError(res.error ?? null);
    } finally {
      syncing.current = false;
    }
  }, [session, commit]);

  // Sinkronizo kur hapet aplikacioni, kur kthehet në ballinë dhe çdo 30 sekonda.
  useEffect(() => {
    if (!ready || !session) return;
    syncNow();
    const timer = setInterval(syncNow, SYNC_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, session, syncNow]);

  useEffect(() => {
    if (!ready || !session) return;
    (async () => {
      const [st, si, last] = await Promise.all([
        supabase.from('settings').select('break_mode, fixed_break_min').maybeSingle(),
        supabase.from('sites').select('id, name, address, photo_path').eq('active', true).order('name'),
        AsyncStorage.getItem(LAST_SITE_KEY).catch(() => null),
      ]);
      if (st.data) {
        setSettings({
          breakMode: st.data.break_mode,
          fixedBreakMin: st.data.fixed_break_min,
        });
      }
      if (si.data) {
        const list = (si.data as Site[]).sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0));
        setSites(list);
        AsyncStorage.setItem(SITES_KEY, JSON.stringify({ sites: list })).catch(() => {});
      }
    })();
  }, [ready, session]);

  const update = useCallback(
    (shift: LocalShift) => {
      commit(applyShift(stateRef.current, shift));
      syncNow();
    },
    [commit, syncNow],
  );

  const start = useCallback(
    (siteId: string | null = null) => {
      if (statusOf(stateRef.current.current) !== 'idle') return;
      if (siteId) AsyncStorage.setItem(LAST_SITE_KEY, siteId).catch(() => {});
      update(startShift(nowIso(), newId(), siteId));
    },
    [update],
  );

  const pause = useCallback(() => {
    const cur = stateRef.current.current;
    if (cur && statusOf(cur) === 'working') update(pauseShift(cur, nowIso(), newId()));
  }, [update]);

  const resume = useCallback(() => {
    const cur = stateRef.current.current;
    if (cur && statusOf(cur) === 'paused') update(resumeShift(cur, nowIso()));
  }, [update]);

  const shortfallBeforeStop = useCallback(() => {
    const cur = stateRef.current.current;
    return cur ? breakShortfallMin(cur, nowIso()) : 0;
  }, []);

  const buttonBreakMin = useCallback(() => {
    const cur = stateRef.current.current;
    return cur ? breakMinutes({ ...cur, declaredBreakMin: null }, nowIso()) : 0;
  }, []);

  const stop = useCallback(
    (totalBreakMin: number | null = null) => {
      const cur = stateRef.current.current;
      if (!cur || statusOf(cur) === 'idle') return null;
      const now = nowIso();
      let declared: number | null = null;
      if (totalBreakMin !== null) {
        // Pauza e deklaruar është ajo që tejkalon pauzat me buton.
        const closed = stopShift(cur, now, null);
        declared = Math.max(0, totalBreakMin - breakMinutes(closed, now));
      } else if (settings.breakMode === 'fixed') {
        const closed = stopShift(cur, now, null);
        declared = Math.max(0, settings.fixedBreakMin - breakMinutes(closed, now));
      }
      const done = stopShift(cur, now, declared);
      update(done);
      return done;
    },
    [update, settings],
  );

  const hasUnsynced = useCallback(
    () => stateRef.current.outbox.length > 0 || stateRef.current.current !== null,
    [],
  );

  const value = useMemo<TrackerCtx>(
    () => ({
      ready,
      state,
      current: state.current,
      status: statusOf(state.current),
      pendingCount: state.outbox.length,
      syncError,
      settings,
      sites,
      start,
      pause,
      resume,
      shortfallBeforeStop,
      buttonBreakMin,
      stop,
      syncNow,
      hasUnsynced,
    }),
    [
      ready,
      state,
      syncError,
      settings,
      sites,
      start,
      pause,
      resume,
      shortfallBeforeStop,
      buttonBreakMin,
      stop,
      syncNow,
      hasUnsynced,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): TrackerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker jashtë TrackerProvider');
  return v;
}
