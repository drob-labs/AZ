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
  locale: 'sq' | 'de';
}

interface SessionCtx {
  loading: boolean;
  session: Session | null;
  employee: Employee | null;
  signIn: (personnelNo: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  loading: true,
  session: null,
  employee: null,
  signIn: async () => false,
  signOut: async () => {},
});

async function fetchEmployee(userId: string): Promise<Employee | null> {
  const { data } = await supabase
    .from('employees')
    .select('id, personnel_no, first_name, last_name, role, locale')
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearTrackerState();
    setEmployee(null);
  }, []);

  const value = useMemo(
    () => ({ loading, session, employee, signIn, signOut }),
    [loading, session, employee, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
