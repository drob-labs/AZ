import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, berlinHhmm, berlinLocalToIso, berlinParts, isValidHhmm } from '../../src/core/berlin';
import { calculateDay, restPeriodWarnings } from '../../src/core/hours';
import type { Shift, Warning } from '../../src/core/types';
import { useI18n } from '../../src/i18n';
import type { Dict } from '../../src/i18n/sq';
import { formatDay, formatDuration, formatTime } from '../../src/lib/format';
import { nowIso } from '../../src/lib/id';
import { supabase } from '../../src/lib/supabase';
import { WARNING_KEY } from '../../src/lib/warnings';
import { Avatar } from '../../src/ui/Avatar';
import { Icon } from '../../src/ui/Icon';
import { KeyboardBackdrop } from '../../src/ui/KeyboardBackdrop';
import { colors } from '../../src/ui/theme';

interface Emp {
  id: string;
  first_name: string;
  last_name: string;
  personnel_no: string;
  avatar_path: string | null;
}
interface ServerShift {
  id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  declared_break_min: number | null;
  source: 'app' | 'admin' | 'auto';
  month_closed: boolean;
  sites: { name: string } | null;
  breaks: { started_at: string; ended_at: string | null }[];
}
interface AuditRow {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  reason: string | null;
  changed_at: string;
}
interface Row {
  server: ServerShift;
  shift: Shift;
  warnings: Warning[];
  workedMin: number;
}

const toShift = (s: ServerShift): Shift => ({
  id: s.id,
  employeeId: '',
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
  const [emps, setEmps] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => berlinParts(nowIso()).date.slice(0, 7));
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, first_name, last_name, personnel_no, avatar_path')
      .eq('active', true)
      .eq('role', 'worker')
      .order('last_name')
      .then(({ data }) => {
        const list = (data ?? []) as Emp[];
        setEmps(list);
        setEmpId((cur) => cur ?? list[0]?.id ?? null);
      });
  }, []);

  const load = useCallback(async () => {
    if (!empId) return;
    setRefreshing(true);
    const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - 86400000).toISOString();
    const to = new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) + 86400000).toISOString();
    const { data } = await supabase
      .from('shifts')
      .select('id, client_id, started_at, ended_at, declared_break_min, source, month_closed, sites(name), breaks(started_at, ended_at)')
      .eq('employee_id', empId)
      .gte('started_at', from)
      .lt('started_at', to)
      .order('started_at', { ascending: false });
    const inMonth = ((data ?? []) as unknown as ServerShift[]).filter((s) =>
      berlinParts(s.started_at).date.startsWith(month),
    );
    const shifts = inMonth.map(toShift);
    const rest = restPeriodWarnings(shifts);
    setRows(
      inMonth.map((server, i) => {
        const day = calculateDay(shifts[i]);
        return {
          server,
          shift: shifts[i],
          workedMin: day.workedMin,
          warnings: [...day.warnings, ...rest.filter((w) => w.shiftId === server.id)],
        };
      }),
    );
    setRefreshing(false);
  }, [empId, month]);

  // Tab-et mbeten të hapura, prandaj rifreskojmë sa herë që kthehesh në ekran.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const current = emps.find((e) => e.id === empId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? emps.filter((e) => `${e.first_name} ${e.last_name} ${e.personnel_no}`.toLowerCase().includes(q)) : emps;
  }, [emps, query]);
  const totalMin = useMemo(() => rows.reduce((s, r) => s + r.workedMin, 0), [rows]);
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('adminTabHours')}</Text>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} style={styles.arrow} accessibilityLabel="‹">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{month}</Text>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} style={styles.arrow} accessibilityLabel="›">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
          <Text style={styles.total}>
            {t('total')}: {formatDuration(totalMin)}
          </Text>
        </View>
        <Pressable style={styles.picker} onPress={() => setPicking(true)} accessibilityRole="button">
          {current ? (
            <>
              <Avatar path={current.avatar_path} first={current.first_name} last={current.last_name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerName}>
                  {current.first_name} {current.last_name}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.pickerName, { flex: 1 }]}>{emps.length === 0 ? t('noEmployees') : t('pickEmployee')}</Text>
          )}
          <View style={styles.pickerChevron}>
            <Icon name="caretRight" color={colors.muted} size={18} />
          </View>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.server.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('noHours')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setEditing(item)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{formatDay(item.server.started_at, locale)}</Text>
              <Text style={styles.times}>
                {formatTime(item.server.started_at)} –{' '}
                {item.server.ended_at ? formatTime(item.server.ended_at) : t('openShift')}
                {item.server.source === 'admin' ? `  ✎ ${t('correctedByOffice')}` : ''}
                {item.server.source === 'auto' ? `  ⟳ ${t('autoLabel')}` : ''}
              </Text>
              {item.server.sites ? <Text style={styles.site}>{item.server.sites.name}</Text> : null}
              {item.warnings
                .filter((w) => WARNING_KEY[w.code])
                .map((w) => (
                  <Text key={w.code} style={styles.warn}>
                    {t(WARNING_KEY[w.code] as keyof Dict)}
                  </Text>
                ))}
            </View>
            <Text style={styles.dur}>{item.server.ended_at ? formatDuration(item.workedMin) : '…'}</Text>
          </Pressable>
        )}
      />

      {picking && (
        <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={() => setPicking(false)}>
          <Pressable style={styles.pickBackdrop} onPress={() => setPicking(false)}>
            <Pressable style={styles.pickSheet} onPress={() => {}}>
              <View style={styles.grabber} />
              <Text style={styles.pickTitle}>{t('pickEmployee')}</Text>
              {emps.length > 6 && (
                <TextInput
                  style={styles.search}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('searchEmployee')}
                  placeholderTextColor={colors.muted}
                />
              )}
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 8, paddingTop: 8 }}
                ListEmptyComponent={<Text style={styles.empty}>{t('noEmployees')}</Text>}
                renderItem={({ item }) => {
                  const on = item.id === empId;
                  return (
                    <Pressable
                      style={[styles.pickRow, on && styles.pickRowOn]}
                      onPress={() => {
                        setEmpId(item.id);
                        setPicking(false);
                        setQuery('');
                      }}
                    >
                      <Avatar path={item.avatar_path} first={item.first_name} last={item.last_name} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerName}>
                          {item.first_name} {item.last_name}
                        </Text>
                      </View>
                      {on && <Text style={styles.pickCheck}>✓</Text>}
                    </Pressable>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const s = row.server;
  const startDate = berlinParts(s.started_at).date;
  const [start, setStart] = useState(berlinHhmm(s.started_at));
  const [end, setEnd] = useState(s.ended_at ? berlinHhmm(s.ended_at) : '');
  const [nextDay, setNextDay] = useState(
    s.ended_at ? berlinParts(s.ended_at).date !== startDate : false,
  );
  const [brk, setBrk] = useState(String(s.declared_break_min ?? 0));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, action, reason, changed_at')
      .eq('table_name', 'shifts')
      .eq('row_id', s.id)
      .order('changed_at', { ascending: false })
      .then(({ data }) => setHistory((data ?? []) as AuditRow[]));
  }, [s.id]);

  const buttonBreakMin = Math.round(
    s.breaks.reduce(
      (sum, b) => (b.ended_at ? sum + (Date.parse(b.ended_at) - Date.parse(b.started_at)) / 60000 : sum),
      0,
    ),
  );

  async function save() {
    setError(null);
    if (!isValidHhmm(start) || !isValidHhmm(end)) return setError(t('invalidTime'));
    if (reason.trim().length < 3) return setError(t('reasonRequired'));
    const startedAt = berlinLocalToIso(startDate, start);
    const endedAt = berlinLocalToIso(nextDay ? addDays(startDate, 1) : startDate, end);
    if (Date.parse(endedAt) <= Date.parse(startedAt)) return setError(t('endBeforeStart'));
    const declared = Math.max(0, Math.min(240, parseInt(brk, 10) || 0));

    setBusy(true);
    const { error: err } = await supabase.rpc('correct_shift', {
      p_shift_id: s.id,
      p_started_at: startedAt,
      p_ended_at: endedAt,
      p_declared_break_min: declared,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) return setError(`${t('saveFailed')} ${err.message}`);
    onSaved();
  }

  const locked = s.month_closed;

  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardBackdrop style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>
              {t('correct')} · {startDate}
            </Text>

            <Text style={styles.label}>{t('startTime')}</Text>
            <TextInput style={styles.input} value={start} onChangeText={(v) => { setStart(v); setError(null); }} placeholder="07:00" maxLength={5} editable={!locked} />

            <Text style={styles.label}>{t('endTime')}</Text>
            <TextInput style={styles.input} value={end} onChangeText={(v) => { setEnd(v); setError(null); }} placeholder="16:00" maxLength={5} editable={!locked} />

            <Pressable style={styles.checkRow} onPress={() => setNextDay((v) => !v)}>
              <Text style={styles.check}>{nextDay ? '☑' : '☐'}</Text>
              <Text style={styles.checkText}>{t('endNextDay')}</Text>
            </Pressable>

            <Text style={styles.muted}>
              {t('buttonBreaks')}: {buttonBreakMin} {t('minutes')}
            </Text>
            <Text style={styles.label}>{t('declaredBreak')}</Text>
            <TextInput style={styles.input} value={brk} onChangeText={setBrk} keyboardType="number-pad" maxLength={3} editable={!locked} />

            <Text style={styles.label}>{t('reason')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={reason}
              onChangeText={(v) => { setReason(v); setError(null); }}
              multiline
              editable={!locked}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
                <Text style={styles.btnText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, (busy || locked) && { opacity: 0.5 }]} onPress={save} disabled={busy || locked}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
              </Pressable>
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>{t('history')}</Text>
            {history === null ? (
              <ActivityIndicator />
            ) : history.length === 0 ? (
              <Text style={styles.muted}>{t('noHistory')}</Text>
            ) : (
              history.map((h) => (
                <Text key={h.id} style={styles.hist}>
                  {formatTime(h.changed_at)} · {t(`action${h.action}` as keyof Dict)}
                  {h.reason ? ` — ${h.reason}` : ''}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  arrowText: { fontSize: 22, color: colors.text },
  month: { fontSize: 18, fontWeight: '700', color: colors.text },
  total: { marginLeft: 'auto', fontSize: 17, color: colors.muted },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10 },
  pickerName: { fontSize: 17, fontWeight: '700', color: colors.text },
  pickerSub: { fontSize: 13, color: colors.muted, marginTop: 1 },
  pickerChevron: { marginRight: 4, transform: [{ rotate: '90deg' }] },
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickSheet: { backgroundColor: colors.bg, padding: 20, paddingTop: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  pickTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  search: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border },
  pickRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pickCheck: { fontSize: 22, fontWeight: '700', color: colors.primary, marginRight: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16 },
  muted: { color: colors.muted, fontSize: 15 },
  row: { backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  date: { fontSize: 17, fontWeight: '700', color: colors.text },
  times: { fontSize: 15, color: colors.muted, marginTop: 2 },
  dur: { fontSize: 24, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  site: { fontSize: 14, color: colors.text, marginTop: 3 },
  warn: { fontSize: 13, color: colors.warn, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, color: colors.muted, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { fontSize: 22, color: colors.text },
  checkText: { fontSize: 16, color: colors.text },
  error: { color: colors.stop, fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hist: { fontSize: 14, color: colors.text },
});
