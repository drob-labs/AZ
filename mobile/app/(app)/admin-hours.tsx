import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { berlinParts } from '../../src/core/berlin';
import { calculateDay, restPeriodWarnings } from '../../src/core/hours';
import type { Shift, Warning } from '../../src/core/types';
import { useI18n } from '../../src/i18n';
import type { Dict } from '../../src/i18n/sq';
import { formatDurationLong, formatTime, isoDayShort } from '../../src/lib/format';
import { nowIso } from '../../src/lib/id';
import { supabase } from '../../src/lib/supabase';
import { WARNING_KEY } from '../../src/lib/warnings';
import { Avatar } from '../../src/ui/Avatar';
import { EditShiftPage } from '../../src/ui/EditShiftPage';
import { colors } from '../../src/ui/theme';

const PAGE = 1000;

interface Emp {
  id: string;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
}
interface ServerShift {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  declared_break_min: number | null;
  source: 'app' | 'admin' | 'auto';
  month_closed: boolean;
  sites: { name: string } | null;
  breaks: { started_at: string; ended_at: string | null }[];
}
interface Row {
  server: ServerShift;
  day: string;
  warnings: Warning[];
  workedMin: number;
  breakMin: number;
}

const toShift = (s: ServerShift): Shift => ({
  id: s.id,
  employeeId: s.employee_id,
  startedAt: s.started_at,
  endedAt: s.ended_at,
  declaredBreakMin: s.declared_break_min ?? undefined,
  siteName: s.sites?.name ?? null,
  breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at })),
});

function shiftMonth(prefix: string, delta: number): string {
  const [y, m] = prefix.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function AdminHours() {
  const { t, locale } = useI18n();
  const today = berlinParts(nowIso()).date;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - 86400000).toISOString();
    const to = new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) + 86400000).toISOString();
    const all: ServerShift[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data } = await supabase
        .from('shifts')
        .select('id, employee_id, started_at, ended_at, declared_break_min, source, month_closed, sites(name), breaks(started_at, ended_at)')
        .gte('started_at', from)
        .lt('started_at', to)
        .order('started_at', { ascending: false })
        .range(offset, offset + PAGE - 1);
      all.push(...((data ?? []) as unknown as ServerShift[]));
      if (!data || data.length < PAGE) break;
    }
    const empRes = await supabase
      .from('employees')
      .select('id, first_name, last_name, avatar_path')
      .eq('role', 'worker')
      .order('last_name');
    setEmps((empRes.data ?? []) as Emp[]);

    const inMonth = all.filter((s) => berlinParts(s.started_at).date.startsWith(month));
    const result: Row[] = [];
    for (const empId of new Set(inMonth.map((s) => s.employee_id))) {
      const mine = inMonth.filter((s) => s.employee_id === empId);
      const shifts = mine.map(toShift);
      const rest = restPeriodWarnings(shifts);
      mine.forEach((server, i) => {
        const day = calculateDay(shifts[i]);
        result.push({
          server,
          day: berlinParts(server.started_at).date,
          workedMin: day.workedMin,
          breakMin: day.breakMin,
          warnings: [...day.warnings, ...rest.filter((w) => w.shiftId === server.id)],
        });
      });
    }
    setRows(result);
    setRefreshing(false);
  }, [month]);

  // Tab-et mbeten të hapura, prandaj rifreskojmë sa herë që kthehesh në ekran.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const long = (min: number) => formatDurationLong(min, t('hoursUnit'), t('minutes'));
  const names = t('monthNames').split(',');
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7; // e hëna si fillim
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const workedDays = useMemo(() => new Set(rows.map((r) => r.day)), [rows]);
  const dayRows = selectedDay ? rows.filter((r) => r.day === selectedDay) : [];
  const empName = (id: string) => {
    const e = emps.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };
  const empOf = (id: string) => emps.find((x) => x.id === id);

  function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelectedDay(next === today.slice(0, 7) ? today : next < today.slice(0, 7) ? `${next}-01` : null);
  }

  if (editId) {
    return (
      <EditShiftPage
        id={editId}
        onBack={() => {
          setEditId(null);
          load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Text style={styles.title}>{t('adminTabHours')}</Text>
        <View style={styles.monthRow}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.arrow} accessibilityLabel="‹">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.month}>
            {names[mon - 1]} {year}
          </Text>
          <Pressable onPress={() => changeMonth(1)} style={styles.arrow} accessibilityLabel="›">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Text key={d} style={styles.weekday}>
                {isoDayShort(d, locale)}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <View key={`e${i}`} style={styles.cell} />;
              const future = date > today;
              const on = date === selectedDay;
              return (
                <View key={date} style={styles.cell}>
                  <Pressable
                    disabled={future}
                    onPress={() => setSelectedDay(date)}
                    style={[styles.day, on && styles.dayOn, future && styles.dayFuture]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.dayText, on && { color: '#fff' }, future && { color: colors.muted }]}>
                      {Number(date.slice(8, 10))}
                    </Text>
                    {workedDays.has(date) ? <View style={[styles.dot, on && { backgroundColor: '#fff' }]} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {refreshing && rows.length === 0 ? <ActivityIndicator /> : null}

        {selectedDay ? (
          <>
            <Text style={styles.sectionTitle}>
              {selectedDay.slice(8, 10)}.{selectedDay.slice(5, 7)}.{selectedDay.slice(0, 4)}
            </Text>
            {dayRows.length === 0 ? (
              <Text style={styles.empty}>{t('noHoursDay')}</Text>
            ) : (
              dayRows.map((r) => {
                const e = empOf(r.server.employee_id);
                return (
                  <Pressable key={r.server.id} style={styles.card} onPress={() => setDetail(r)} accessibilityRole="button">
                    {e ? <Avatar path={e.avatar_path} first={e.first_name} last={e.last_name} size={40} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{empName(r.server.employee_id)}</Text>
                      <Text style={styles.times}>
                        {formatTime(r.server.started_at)} – {r.server.ended_at ? formatTime(r.server.ended_at) : t('openShift')}
                      </Text>
                    </View>
                    <Text style={styles.dur}>{r.server.ended_at ? long(r.workedMin) : '…'}</Text>
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>

      {detail && (
        <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={() => setDetail(null)}>
          <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>{empName(detail.server.employee_id)}</Text>
              <Text style={styles.times}>
                {detail.day.slice(8, 10)}.{detail.day.slice(5, 7)}.{detail.day.slice(0, 4)}
              </Text>
              <View style={styles.infoBox}>
                <Info label={t('detailStart')} value={formatTime(detail.server.started_at)} />
                <Info label={t('detailEnd')} value={detail.server.ended_at ? formatTime(detail.server.ended_at) : t('openShift')} />
                <Info label={t('detailBreak')} value={`${Math.round(detail.breakMin)} ${t('minutes')}`} />
                <Info label={t('total')} value={detail.server.ended_at ? long(detail.workedMin) : '…'} />
                {detail.server.sites ? <Info label={t('detailSite')} value={detail.server.sites.name} /> : null}
              </View>
              {detail.server.source === 'admin' ? <Text style={styles.note}>✎ {t('correctedByOffice')}</Text> : null}
              {detail.server.source === 'auto' ? <Text style={styles.note}>⟳ {t('autoLabel')}</Text> : null}
              {detail.warnings
                .filter((w) => WARNING_KEY[w.code])
                .map((w) => (
                  <Text key={w.code} style={styles.warn}>
                    {t(WARNING_KEY[w.code] as keyof Dict)}
                  </Text>
                ))}
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => setDetail(null)}>
                  <Text style={styles.btnText}>{t('close')}</Text>
                </Pressable>
                <Pressable
                  style={styles.btn}
                  onPress={() => {
                    setEditId(detail.server.id);
                    setDetail(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('edit')}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  arrowText: { fontSize: 22, color: colors.text },
  month: { fontSize: 18, fontWeight: '700', color: colors.text },
  calendar: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 8 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.muted, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.primary },
  dayFuture: { backgroundColor: colors.bg, opacity: 0.5 },
  dayText: { fontSize: 16, fontWeight: '600', color: colors.text },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 12, fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  times: { fontSize: 15, color: colors.muted, marginTop: 2 },
  dur: { fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 10 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  infoBox: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 15, color: colors.muted },
  infoValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  note: { fontSize: 14, color: colors.muted },
  warn: { fontSize: 13, color: colors.warn },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
