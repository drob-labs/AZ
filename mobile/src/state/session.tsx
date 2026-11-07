import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configured, workerEmail } from '../lib/config';
import { supabase } from '../lib/supabase';
import { clearTrackerState } from '../lib/storage';

export interface Employee {
  id: string;
  personnel_no: string;
  first_name: string;
  last_name: string;
  role: 'worker' | 'admin';
  locale: 'sq' | 'de' | 'en';
  avatar_path: string | null;
}

interface SessionCtx {
  loading: boolean;
  session: Session | null;
  employee: Employee | null;
  signIn: (personnelNo: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  loading: true,
  session: null,
  employee: null,
  signIn: async () => false,
  signOut: async () => {},
  refreshEmployee: async () => {},
});

const EMP_CACHE_KEY = 'az.employee.v1';

async function loadCachedEmployee(userId: string): Promise<Employee | null> {
  try {
    const raw = await AsyncStorage.getItem(EMP_CACHE_KEY);
    const c = raw ? (JSON.parse(raw) as { userId: string; employee: Employee }) : null;
    return c && c.userId === userId ? c.employee : null;
  } catch {
    return null;
  }
}

function saveCachedEmployee(userId: string, employee: Employee) {
  AsyncStorage.setItem(EMP_CACHE_KEY, JSON.stringify({ userId, employee })).catch(() => {});
}

async function fetchEmployee(userId: string): Promise<Employee | null> {
  const { data } = await supabase
    .from('employees')
    .select('id, personnel_no, first_name, last_name, role, locale, avatar_path')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  return (data as Employee | null) ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) {
        const userId = data.session.user.id;
        // Hap aplikacionin menjëherë me profilin e ruajtur në telefon; rifreskohet në prapaskenë.
        const cached = await loadCachedEmployee(userId);
        if (cached && alive) {
          setEmployee(cached);
          setLoading(false);
          fetchEmployee(userId)
            .then((fresh) => {
              if (!alive || !fresh) return;
              setEmployee(fresh);
              saveCachedEmployee(userId, fresh);
            })
            .catch(() => {});
          return;
        }
        const fresh = await fetchEmployee(userId).catch(() => null);
        if (alive) setEmployee(fresh);
        if (fresh) saveCachedEmployee(userId, fresh);
      }
      if (alive) setLoading(false);
    }).catch(() => alive && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setEmployee(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (personnelNo: string, pin: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: workerEmail(personnelNo),
      password: pin,
    });
    if (error || !data.session) return false;
    const emp = await fetchEmployee(data.session.user.id);
    if (!emp) {
      await supabase.auth.signOut();
      return false;
    }
    setEmployee(emp);
    saveCachedEmployee(data.session.user.id, emp);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearTrackerState();
    AsyncStorage.removeItem(EMP_CACHE_KEY).catch(() => {});
    setEmployee(null);
  }, []);

  const refreshEmployee = useCallback(async () => {
    if (!session) return;
    const emp = await fetchEmployee(session.user.id);
    if (emp) setEmployee(emp);
  }, [session]);

  const value = useMemo(
    () => ({ loading, session, employee, signIn, signOut, refreshEmployee }),
    [loading, session, employee, signIn, signOut, refreshEmployee],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
