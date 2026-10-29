import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { berlinParts } from '../../src/core/berlin';
import { calculateDay, restPeriodWarnings } from '../../src/core/hours';
import type { Shift, Warning } from '../../src/core/types';
import { WARNING_KEY } from '../../src/lib/warnings';
import type { LocalShift } from '../../src/core/tracker';
import { useI18n } from '../../src/i18n';
import type { Dict } from '../../src/i18n/sq';
import { formatDay, formatDuration, formatTime } from '../../src/lib/format';
import { nowIso } from '../../src/lib/id';
import { demoShifts } from '../../src/lib/demo';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/state/session';
import { useTracker } from '../../src/state/tracker';
import { colors } from '../../src/ui/theme';

interface ServerShift {
  client_id: string;
  started_at: string;
  ended_at: string | null;
  declared_break_min: number | null;
  sites: { name: string } | null;
  breaks: { client_id: string; started_at: string; ended_at: string | null }[];
}

const fromServer = (r: ServerShift): Shift => ({
  id: r.client_id,
  employeeId: '',
  startedAt: r.started_at,
  endedAt: r.ended_at,
  declaredBreakMin: r.declared_break_min ?? undefined,
  siteName: r.sites?.name ?? null,
  breaks: r.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at })),
});

const fromLocal = (s: LocalShift, siteName: string | null): Shift => ({
  id: s.clientId,
  employeeId: '',
  startedAt: s.startedAt,
  endedAt: s.endedAt,
  declaredBreakMin: s.declaredBreakMin ?? undefined,
  siteName,
  breaks: s.breaks.map((b) => ({ startedAt: b.startedAt, endedAt: b.endedAt })),
});

export default function Hours() {
  const { t, locale } = useI18n();
  const { employee, demo } = useSession();
  const tr = useTracker();
  const [server, setServer] = useState<Shift[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const monthPrefix = berlinParts(nowIso()).date.slice(0, 7);

  const load = useCallback(async () => {
    if (!employee) return;
    if (demo) {
      setServer(demoShifts(nowIso()));
      return;
    }
    setRefreshing(true);
    const from = new Date(Date.parse(`${monthPrefix}-01T00:00:00Z`) - 86400000).toISOString();
    const { data, error } = await supabase
      .from('shifts')
      .select('client_id, started_at, ended_at, declared_break_min, sites(name), breaks(client_id, started_at, ended_at)')
      .eq('employee_id', employee.id)
      .gte('started_at', from)
      .order('started_at', { ascending: false });
    setServer(error ? null : ((data ?? []) as unknown as ServerShift[]).map(fromServer));
    setRefreshing(false);
  }, [employee, demo, monthPrefix]);

  useEffect(() => {
    load();
  }, [load, tr.pendingCount]);

  // Tab-et mbeten të hapura, prandaj rifreskojmë sa herë që kthehesh në ekran.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { rows, totalMin } = useMemo(() => {
    const byId = new Map<string, Shift>();
    for (const s of server ?? []) byId.set(s.id, s);
    // Të dhënat në telefon janë më të reja se ato në server, prandaj i mbishkruajnë.
    const locals = [...tr.state.outbox, ...(tr.state.current ? [tr.state.current] : [])];
    for (const l of locals) byId.set(l.clientId, fromLocal(l, tr.sites.find((x) => x.id === l.siteId)?.name ?? null));

    const shifts = [...byId.values()]
      .filter((s) => berlinParts(s.startedAt).date.startsWith(monthPrefix))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    const restWarnings = restPeriodWarnings(shifts);
    const rows = shifts.map((s) => {
      const day = calculateDay(s);
      const extra: Warning[] = restWarnings.filter((w) => w.shiftId === s.id);
      return { shift: s, day, warnings: [...day.warnings, ...extra] };
    });
    return { rows, totalMin: rows.reduce((sum, r) => sum + r.day.workedMin, 0) };
  }, [server, tr.state, tr.sites, monthPrefix]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('hoursTitle')}</Text>
        <Text style={styles.sub}>
          {t('thisMonth')} · {t('total')}: {formatDuration(totalMin)}
        </Text>
        {server === null && <Text style={styles.warn}>{t('hoursOffline')}</Text>}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.shift.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('noHours')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => {
          const open = !item.shift.endedAt;
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>{formatDay(item.shift.startedAt, locale)}</Text>
                <Text style={styles.times}>
                  {formatTime(item.shift.startedAt)} –{' '}
                  {item.shift.endedAt ? formatTime(item.shift.endedAt) : t('openShift')}
                </Text>
                {item.shift.siteName ? <Text style={styles.site}>{item.shift.siteName}</Text> : null}
                {item.warnings
                  .filter((w) => WARNING_KEY[w.code])
                  .map((w) => (
                    <Text key={w.code} style={styles.warn}>
                      {t(WARNING_KEY[w.code] as keyof Dict)}
                    </Text>
                  ))}
              </View>
              <Text style={styles.dur}>{open ? '…' : formatDuration(item.day.workedMin)}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 24, paddingTop: 12, gap: 4 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  sub: { fontSize: 17, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { fontSize: 17, fontWeight: '700', color: colors.text },
  times: { fontSize: 15, color: colors.muted, marginTop: 2 },
  dur: { fontSize: 24, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  site: { fontSize: 14, color: colors.text, marginTop: 3 },
  warn: { fontSize: 13, color: colors.warn, marginTop: 4 },
});
