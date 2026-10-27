import { effectiveFrom, type RoutineValues } from '../core/routine';
import { supabase } from './supabase';

export interface ServerRoutine extends RoutineValues {
  effectiveFrom: string;
  skipDate: string | null;
}

interface Row {
  enabled: boolean;
  days: number[];
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_min: number;
  site_id: string | null;
  effective_from: string;
  skip_date: string | null;
}

// Postgres kthen kohën si "07:00:00"; aplikacioni punon me "07:00".
const hhmm = (t: string) => t.slice(0, 5);

export async function fetchRoutine(employeeId: string): Promise<ServerRoutine | null> {
  const { data, error } = await supabase
    .from('routines')
    .select('enabled, days, start_time, end_time, break_start, break_min, site_id, effective_from, skip_date')
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Row;
  return {
    enabled: r.enabled,
    days: r.days,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    breakStart: r.break_start ? hhmm(r.break_start) : null,
    breakMin: r.break_min,
    siteId: r.site_id,
    effectiveFrom: r.effective_from,
    skipDate: r.skip_date,
  };
}

/** Ruan rutinën dhe kthen datën nga e cila vlen. */
export async function saveRoutine(employeeId: string, v: RoutineValues, nowIso: string): Promise<string | null> {
  const from = effectiveFrom(nowIso, v.startTime);
  const { error } = await supabase.from('routines').upsert({
    employee_id: employeeId,
    enabled: v.enabled,
    days: v.days,
    start_time: v.startTime,
    end_time: v.endTime,
    break_start: v.breakMin > 0 ? v.breakStart : null,
    break_min: v.breakMin,
    site_id: v.siteId,
    effective_from: from,
    skip_date: null,
    updated_at: new Date().toISOString(),
  });
  return error ? null : from;
}

export async function skipRoutineToday(): Promise<boolean> {
  const { error } = await supabase.rpc('routine_skip_today');
  return !error;
}

export async function stopRoutineNow(): Promise<boolean> {
  const { error } = await supabase.rpc('routine_stop_now');
  return !error;
}

/** Turni automatik që është ende i hapur (rutina e ka nisur, por nuk ka mbaruar). */
export async function fetchOpenAutoShift(employeeId: string): Promise<{ id: string; started_at: string } | null> {
  const { data } = await supabase
    .from('shifts')
    .select('id, started_at')
    .eq('employee_id', employeeId)
    .eq('source', 'auto')
    .is('ended_at', null)
    .maybeSingle();
  return (data as { id: string; started_at: string } | null) ?? null;
}
