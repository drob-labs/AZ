import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { berlinParts } from '../../../src/core/berlin';
import {
  BREAK_CHOICES,
  DEFAULT_ROUTINE,
  describeDays,
  validateRoutine,
  type RoutineError,
  type RoutineValues,
} from '../../../src/core/routine';
import { useI18n } from '../../../src/i18n';
import { formatDay, isoDayShort } from '../../../src/lib/format';
import { nowIso } from '../../../src/lib/id';
import { fetchRoutine, saveRoutine, skipRoutineToday, type ServerRoutine } from '../../../src/lib/routine';
import { useSession } from '../../../src/state/session';
import { useTracker } from '../../../src/state/tracker';
import { TimePicker } from '../../../src/ui/TimePicker';
import { colors } from '../../../src/ui/theme';

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function Routine() {
  const { t, locale } = useI18n();
  const { employee } = useSession();
  const { sites } = useTracker();
  const [values, setValues] = useState<RoutineValues>(DEFAULT_ROUTINE);
  const [saved, setSaved] = useState<ServerRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!employee) return;
      let alive = true;
      fetchRoutine(employee.id).then((r) => {
        if (!alive) return;
        setSaved(r);
        if (r) setValues(r);
        setLoading(false);
      });
      return () => {
        alive = false;
      };
    }, [employee]),
  );

  const set = (patch: Partial<RoutineValues>) => {
    setValues((cur) => ({ ...cur, ...patch }));
    setMessage(null);
  };
  const toggleDay = (d: number) =>
    set({ days: values.days.includes(d) ? values.days.filter((x) => x !== d) : [...values.days, d].sort((a, b) => a - b) });

  const dayName = (d: number) => isoDayShort(d, locale);
  const summary = useMemo(() => {
    let s = t('routineSummary', { days: describeDays(values.days, dayName), from: values.startTime, to: values.endTime });
    if (values.breakMin > 0 && values.breakStart) s += t('routineSummaryBreak', { from: values.breakStart, min: values.breakMin });
    const site = sites.find((x) => x.id === values.siteId);
    return site ? `${s} · ${site.name}` : s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, sites, locale, t]);

  const errorText = (e: RoutineError) =>
    e === 'noDays' ? t('routineErrNoDays') : e === 'timeOrder' ? t('routineErrTime') : t('routineErrBreak');

  async function save() {
    if (!employee) return;
    const invalid = validateRoutine(values);
    if (invalid) return setMessage({ text: errorText(invalid), ok: false });
    // Baushtella është e detyrueshme kur ka të regjistruara (njësoj si te START).
    if (values.enabled && sites.length > 0 && !values.siteId) return setMessage({ text: t('routineErrSite'), ok: false });

    setBusy(true);
    const from = await saveRoutine(employee.id, values, nowIso());
    setBusy(false);
    if (!from) return setMessage({ text: t('genericFail'), ok: false });
    setSaved(await fetchRoutine(employee.id));
    const today = berlinParts(nowIso()).date;
    const startsText = values.enabled && from > today ? ` ${t('routineStartsFrom', { date: formatDay(`${from}T12:00:00Z`, locale) })}` : '';
    setMessage({ text: `${t('routineSaved')}${startsText}`, ok: true });
  }

  async function skipToday() {
    setBusy(true);
    const ok = await skipRoutineToday();
    setBusy(false);
    if (employee && ok) setSaved(await fetchRoutine(employee.id));
    setMessage(ok ? { text: t('routineSkipped'), ok: true } : { text: t('genericFail'), ok: false });
  }

  const skippedToday = saved?.skipDate === berlinParts(nowIso()).date;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('routineIntro')}</Text>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('routineEnable')}</Text>
              <Text style={styles.hint}>{t('routineEnableHint')}</Text>
            </View>
            <Switch value={values.enabled} onValueChange={(v) => set({ enabled: v })} />
          </View>
        </View>

        <View style={[styles.card, !values.enabled && styles.dim]} pointerEvents={values.enabled ? 'auto' : 'none'}>
          <Text style={styles.label}>{t('routineDays')}</Text>
          <View style={styles.days}>
            {ISO_DAYS.map((d) => {
              const on = values.days.includes(d);
              return (
                <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.dayText, on && { color: '#fff' }]}>{dayName(d)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>{t('routineHours')}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TimePicker value={values.startTime} onChange={(startTime) => set({ startTime })} label={t('routineFrom')} doneLabel={t('ok')} />
            </View>
            <View style={{ flex: 1 }}>
              <TimePicker value={values.endTime} onChange={(endTime) => set({ endTime })} label={t('routineTo')} doneLabel={t('ok')} />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>{t('routineBreak')}</Text>
          <View style={styles.chips}>
            {BREAK_CHOICES.map((m) => (
              <Pressable
                key={m}
                onPress={() => set({ breakMin: m, breakStart: m > 0 ? (values.breakStart ?? '12:00') : values.breakStart })}
                style={[styles.chip, values.breakMin === m && styles.chipOn]}
              >
                <Text style={[styles.chipText, values.breakMin === m && { color: '#fff' }]}>
                  {m === 0 ? t('routineBreakNone') : `${m} ${t('minutes')}`}
                </Text>
              </Pressable>
            ))}
          </View>
          {values.breakMin > 0 && (
            <View style={{ marginTop: 10 }}>
              <TimePicker
                value={values.breakStart ?? '12:00'}
                onChange={(breakStart) => set({ breakStart })}
                label={t('routineBreakFrom')}
                doneLabel={t('ok')}
              />
            </View>
          )}

          {sites.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 14 }]}>{t('routineSite')}</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {sites.map((s) => {
                  const on = values.siteId === s.id;
                  return (
                    <Pressable key={s.id} onPress={() => set({ siteId: s.id })} style={[styles.site, on && styles.siteOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.siteName}>{s.name}</Text>
                        {s.address ? <Text style={styles.siteAddr}>{s.address}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>

        {message ? <Text style={[styles.msg, { color: message.ok ? colors.start : colors.stop }]}>{message.text}</Text> : null}

        <Pressable style={[styles.save, busy && { opacity: 0.5 }]} onPress={save} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('save')}</Text>}
        </Pressable>

        {saved?.enabled && !skippedToday ? (
          <Pressable style={[styles.skip, busy && { opacity: 0.5 }]} onPress={skipToday} disabled={busy} accessibilityRole="button">
            <Text style={styles.skipText}>{t('routineSkipToday')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.note}>{t('routineNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 14, paddingBottom: 32 },
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  dim: { opacity: 0.45 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  site: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.bg },
  siteOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  siteName: { fontSize: 16, fontWeight: '700', color: colors.text },
  siteAddr: { fontSize: 13, color: colors.muted, marginTop: 1 },
  summary: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12 },
  summaryText: { fontSize: 14, fontWeight: '600', color: colors.primary, textAlign: 'center' },
  msg: { fontSize: 14, textAlign: 'center' },
  save: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skip: { borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  skipText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18, textAlign: 'center' },
});
