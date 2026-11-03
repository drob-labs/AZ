import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, berlinHhmm, berlinLocalToIso, berlinParts, isValidHhmm } from '../core/berlin';
import { useI18n } from '../i18n';
import type { Dict } from '../i18n/sq';
import { formatTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { colors } from './theme';
import { TimePicker } from './TimePicker';

interface ServerShift {
  id: string;
  started_at: string;
  ended_at: string | null;
  declared_break_min: number | null;
  month_closed: boolean;
  employees: { first_name: string; last_name: string } | null;
  breaks: { started_at: string; ended_at: string | null }[];
}
interface AuditRow {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  reason: string | null;
  changed_at: string;
}

const germanDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const when = (iso: string) => `${germanDate(berlinParts(iso).date)} · ${formatTime(iso)}`;

/** Kthen një fjali të kuptueshme për çdo rresht të historisë, sipas veprimit dhe arsyes që ruan databaza. */
function describe(h: AuditRow, t: (k: keyof Dict, vars?: Record<string, string | number>) => string): string {
  if (h.action === 'DELETE') return h.reason === 'month_deleted' ? t('histMonthDeleted') : t('histDeleted');
  switch (h.reason) {
    case 'routine':
      return h.action === 'INSERT' ? t('histCreatedRoutine') : t('histRoutine');
    case 'routine_stopped_by_worker':
      return t('histRoutineStopped');
    case 'month_closed':
      return t('histMonthClosed');
    case 'late_after_month_closing':
      return t('histLate');
    case 'device_clock_ahead':
      return t('histClock');
    case null:
    case '':
      return h.action === 'INSERT' ? t('histCreated') : t('histEnded');
    default:
      return t('histCorrected', { reason: h.reason ?? '' });
  }
}

/** Faqja e plotë e ndryshimit të një turni; shfaqet në vend të kalendarit, jo si rrugë e veçantë. */
export function EditShiftPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useI18n();
  const [s, setS] = useState<ServerShift | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase
      .from('shifts')
      .select('id, started_at, ended_at, declared_break_min, month_closed, employees(first_name, last_name), breaks(started_at, ended_at)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setS(data as unknown as ServerShift);
        else setMissing(true);
      });
  }, [id]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <Pressable style={styles.back} onPress={onBack} accessibilityRole="button">
        <Text style={styles.backText}>‹ {t('adminTabHours')}</Text>
      </Pressable>
      {s ? <Form shift={s} onDone={onBack} /> : missing ? <Text style={styles.muted}>{t('noHoursDay')}</Text> : <ActivityIndicator />}
    </SafeAreaView>
  );
}

function Form({ shift: s, onDone }: { shift: ServerShift; onDone: () => void }) {
  const { t } = useI18n();
  const startDate = berlinParts(s.started_at).date;
  const [start, setStart] = useState(berlinHhmm(s.started_at));
  const [end, setEnd] = useState(s.ended_at ? berlinHhmm(s.ended_at) : '');
  const [nextDay, setNextDay] = useState(s.ended_at ? berlinParts(s.ended_at).date !== startDate : false);
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
    onDone();
  }

  const locked = s.month_closed;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {s.employees ? `${s.employees.first_name} ${s.employees.last_name}` : ''}
      </Text>
      <Text style={styles.muted}>{germanDate(startDate)}</Text>

      <View style={[styles.timeRow, locked && { opacity: 0.5 }]} pointerEvents={locked ? 'none' : 'auto'}>
        <View style={{ flex: 1 }}>
          <TimePicker value={start} onChange={(v) => { setStart(v); setError(null); }} label={t('detailStart')} doneLabel={t('save')} minuteStep={5} />
        </View>
        <View style={{ flex: 1 }}>
          <TimePicker value={end || '16:00'} onChange={(v) => { setEnd(v); setError(null); }} label={t('detailEnd')} doneLabel={t('save')} minuteStep={5} />
        </View>
      </View>

      <Pressable style={styles.checkRow} onPress={() => setNextDay((v) => !v)}>
        <Text style={styles.check}>{nextDay ? '☑' : '☐'}</Text>
        <Text style={styles.checkText}>{t('endNextDay')}</Text>
      </Pressable>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {t('buttonBreaks')}: {buttonBreakMin} {t('minutes')}
        </Text>
        <Text style={styles.hint}>{t('buttonBreakHint')}</Text>
      </View>
      <Text style={styles.label}>{t('declaredBreak')}</Text>
      <TextInput style={styles.input} value={brk} onChangeText={setBrk} keyboardType="number-pad" maxLength={3} editable={!locked} />
      <Text style={styles.hint}>{t('declaredBreakHint')}</Text>
      <Text style={styles.infoTitle}>
        {t('breakTotal')}: {buttonBreakMin + (Math.max(0, Math.min(240, parseInt(brk, 10) || 0)))} {t('minutes')}
      </Text>

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
        <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onDone}>
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
          <View key={h.id} style={styles.histRow}>
            <Text style={styles.histWhen}>{when(h.changed_at)}</Text>
            <Text style={styles.hist}>{describe(h, t)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  backText: { fontSize: 17, fontWeight: '600', color: colors.primary },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 15, padding: 4 },
  label: { fontSize: 14, color: colors.muted, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, color: colors.text, backgroundColor: colors.card },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { fontSize: 22, color: colors.text },
  checkText: { fontSize: 16, color: colors.text },
  error: { color: colors.stop, fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hist: { fontSize: 15, color: colors.text },
  histRow: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 2 },
  histWhen: { fontSize: 13, color: colors.muted },
  timeRow: { flexDirection: 'row', gap: 10 },
  infoBox: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
});
