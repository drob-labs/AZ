import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { blockUser, fetchBlocked, fetchDirectory, fetchOverview, type ChatMessage, type Person, type RoomOverview } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { useSession } from './session';

type Listener = (m: ChatMessage) => void;

interface ChatCtx {
  overview: RoomOverview[];
  people: Map<string, Person>;
  /** Përdoruesit që i kam bllokuar: mesazhet dhe bisedat e tyre fshihen. */
  blocked: Set<string>;
  block: (id: string) => Promise<void>;
  unreadTotal: number;
  refresh: () => Promise<void>;
  /** Merr çdo mesazh të ri që mbërrin në kohë reale; kthen funksionin për ta ndalur. */
  subscribe: (fn: Listener) => () => void;
}

const Ctx = createContext<ChatCtx>({
  overview: [],
  people: new Map(),
  blocked: new Set(),
  block: async () => {},
  unreadTotal: 0,
  refresh: async () => {},
  subscribe: () => () => {},
});

const REFRESH_DEBOUNCE_MS = 300;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { employee, demo } = useSession();
  const employeeId = demo ? null : (employee?.id ?? null);
  const [overview, setOverview] = useState<RoomOverview[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const listeners = useRef(new Set<Listener>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOverview(await fetchOverview());
    } catch {
      // pa internet ose pa SQL-in e chat-it: lista mbetet siç ishte
    }
  }, []);

  const loadPeople = useCallback(async () => {
    try {
      setPeople(new Map((await fetchDirectory()).map((p) => [p.id, p])));
      setBlocked(new Set(await fetchBlocked()));
    } catch {
      // njëlloj si më sipër
    }
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setOverview([]);
      setPeople(new Map());
      setBlocked(new Set());
      return;
    }
    refresh();
    loadPeople();

    // Mesazhet e reja mbërrijnë direkt; RLS bën që çdo përdorues të marrë vetëm mesazhet e dhomave të veta.
    const channel = supabase
      .channel(`chat-${employeeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        listeners.current.forEach((fn) => fn(payload.new as ChatMessage));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
      })
      .subscribe();

    // Kur aplikacioni kthehet nga prapaskena, rifresko (lidhja mund të ketë rënë).
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh();
        loadPeople();
      }
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [employeeId, refresh, loadPeople]);

  const block = useCallback(
    async (id: string) => {
      if (!employeeId) return;
      await blockUser(employeeId, id);
      setBlocked((cur) => new Set(cur).add(id));
    },
    [employeeId],
  );

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo<ChatCtx>(
    () => ({ overview, people, blocked, block, unreadTotal: overview.reduce((s, r) => s + r.unread, 0), refresh, subscribe }),
    [overview, people, blocked, block, refresh, subscribe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useChat = () => useContext(Ctx);
