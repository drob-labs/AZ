import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configured, workerEmail } from '../lib/config';
import { supabase } from '../lib/supabase';
import { clearTrackerState } from '../lib/storage';
import { DEMO_EMPLOYEE } from '../lib/demo';

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
  /** Modaliteti Demo: punëtor shembull lokal, pa llogari dhe pa server. */
  demo: boolean;
  startDemo: () => void;
  signIn: (personnelNo: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  loading: true,
  session: null,
  employee: null,
  demo: false,
  startDemo: () => {},
  signIn: async () => false,
  signOut: async () => {},
  refreshEmployee: async () => {},
});

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
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) setEmployee(await fetchEmployee(data.session.user.id));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setEmployee(null);
    });
    return () => sub.subscription.unsubscribe();
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
    return true;
  }, []);

  const startDemo = useCallback(() => {
    setDemo(true);
    setEmployee(DEMO_EMPLOYEE);
  }, []);

  const signOut = useCallback(async () => {
    if (demo) {
      setDemo(false);
      setEmployee(null);
      return;
    }
    await supabase.auth.signOut();
    await clearTrackerState();
    setEmployee(null);
  }, [demo]);

  const refreshEmployee = useCallback(async () => {
    if (!session) return;
    const emp = await fetchEmployee(session.user.id);
    if (emp) setEmployee(emp);
  }, [session]);

  const value = useMemo(
    () => ({ loading, session, employee, demo, startDemo, signIn, signOut, refreshEmployee }),
    [loading, session, employee, demo, startDemo, signIn, signOut, refreshEmployee],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
