import { useFocusEffect } from 'expo-router';
import { getRandomValues } from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
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
import { berlinParts } from '../../src/core/berlin';
import { rateOn } from '../../src/core/hours';
import { generatePin, isValidPersonnelNo, isWeakPin } from '../../src/core/pin';
import { useI18n } from '../../src/i18n';
import type { Dict } from '../../src/i18n/sq';
import { workerEmail } from '../../src/lib/config';
import { nowIso } from '../../src/lib/id';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/ui/theme';

interface Emp {
  id: string;
  personnel_no: string;
  first_name: string;
  last_name: string;
  active: boolean;
  weekly_hours: number;
  employee_rates: { valid_from: string; hourly_rate_cents: number }[];
}

const today = () => berlinParts(nowIso()).date;
const newPin = () => generatePin(() => getRandomValues(new Uint32Array(1))[0]);
const euro = (cents: number | null) => (cents === null ? '–' : `${(cents / 100).toFixed(2)} €`);
const parseRateCents = (s: string): number => Math.round(parseFloat(s.replace(',', '.')) * 100);

/** Kthen çelësin e përkthimit për gabimin që ktheu funksioni në server. */
async function failKey(error: unknown): Promise<keyof Dict> {
  try {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? ((await ctx.json()) as { error?: string }) : {};
    if (body.error === 'duplicate') return 'dupNo';
    if (body.error === 'weak_pin') return 'weakPin';
    if (body.error === 'personnel_no') return 'badPersonnelNo';
    if (body.error === 'rate') return 'rateInvalid';
  } catch {
    // injoro: përdor gabimin e përgjithshëm
  }
  return 'genericFail';
}

export default function Staff() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Emp[]>([]);
  const [minWage, setMinWage] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Emp | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [emps, settings] = await Promise.all([
      supabase
        .from('employees')
        .select('id, personnel_no, first_name, last_name, active, weekly_hours, employee_rates(valid_from, hourly_rate_cents)')
        .eq('role', 'worker')
        .order('last_name'),
      supabase.from('settings').select('min_wage_cents_by_year').single(),
    ]);
    setRows((emps.data ?? []) as Emp[]);
    const byYear = (settings.data?.min_wage_cents_by_year ?? {}) as Record<string, number>;
    setMinWage(byYear[today().slice(0, 4)] ?? null);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const currentRate = (e: Emp) =>
    rateOn(
      e.employee_rates.map((r) => ({ validFrom: r.valid_from, hourlyRateCents: r.hourly_rate_cents })),
      today(),
    );

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('tabStaff')}</Text>
        <Pressable style={styles.addBtn} onPress={() => setAdding(true)} accessibilityRole="button">
          <Text style={styles.addText}>＋ {t('addEmployee')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('noEmployees')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, !item.active && { opacity: 0.55 }]} onPress={() => setSelected(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.first_name} {item.last_name}
              </Text>
              <Text style={styles.sub}>
                #{item.personnel_no}
                {item.active ? '' : ` · ${t('inactive')}`}
              </Text>
            </View>
            <Text style={styles.rate}>{euro(currentRate(item))}</Text>
          </Pressable>
        )}
      />

      {adding && (
        <AddModal
          minWage={minWage}
          onClose={() => setAdding(false)}
          onDone={() => {
            load();
          }}
        />
      )}
      {selected && (
        <DetailModal
          emp={selected}
          rate={currentRate(selected)}
          minWage={minWage}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function AddModal({ minWage, onClose, onDone }: { minWage: number | null; onClose: () => void; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [no, setNo] = useState('');
  const [pin, setPin] = useState('');
  const [rate, setRate] = useState('');
  const [hours, setHours] = useState('40');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ no: string; pin: string; name: string } | null>(null);

  useEffect(() => setPin(newPin()), []);

  const rateCents = parseRateCents(rate);
  const lowRate = Number.isFinite(rateCents) && minWage !== null && rateCents < minWage;

  async function submit() {
    setError(null);
    if (!first.trim() || !last.trim() || !no.trim() || !rate.trim()) return setError(t('fillAll'));
    if (!isValidPersonnelNo(no.trim())) return setError(t('badPersonnelNo'));
    if (isWeakPin(pin)) return setError(t('weakPin'));
    if (!Number.isInteger(rateCents) || rateCents < 100 || rateCents > 20000) return setError(t('rateInvalid'));

    setBusy(true);
    const { error: err } = await supabase.functions.invoke('manage-employee', {
      body: {
        action: 'create',
        personnelNo: no.trim(),
        firstName: first.trim(),
        lastName: last.trim(),
        email: workerEmail(no.trim()),
        pin,
        hourlyRateCents: rateCents,
        weeklyHours: parseFloat(hours.replace(',', '.')) || 40,
        locale,
        validFrom: today(),
      },
    });
    setBusy(false);
    if (err) return setError(t(await failKey(err)));
    setCreated({ no: no.trim(), pin, name: `${first.trim()} ${last.trim()}` });
    onDone();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {created ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.sheetTitle}>{t('employeeCreated')}</Text>
              <Text style={styles.name}>{created.name}</Text>
              <View style={styles.cred}>
                <Text style={styles.label}>{t('personnelNo')}</Text>
                <Text style={styles.credValue}>{created.no}</Text>
                <Text style={[styles.label, { marginTop: 8 }]}>PIN</Text>
                <Text style={styles.credValue}>{created.pin}</Text>
              </View>
              <Text style={styles.note}>{t('credentialsText')}</Text>
              <Pressable style={styles.btn} onPress={onClose}>
                <Text style={styles.btnText}>{t('close')}</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>{t('addEmployee')}</Text>
              <Field label={t('firstName')}>
                <TextInput style={styles.input} value={first} onChangeText={setFirst} />
              </Field>
              <Field label={t('lastName')}>
                <TextInput style={styles.input} value={last} onChangeText={setLast} />
              </Field>
              <Field label={t('personnelNoLabel')}>
                <TextInput
                  style={styles.input}
                  value={no}
                  onChangeText={(v) => setNo(v.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))}
                  autoCapitalize="none"
                />
              </Field>
              <Field label={t('pinInitial')}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={pin}
                    onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable style={styles.small} onPress={() => setPin(newPin())}>
                    <Text style={styles.smallText}>{t('generate')}</Text>
                  </Pressable>
                </View>
              </Field>
              <Field label={t('hourlyRate')}>
                <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="18.00" />
              </Field>
              {lowRate && <Text style={styles.warn}>{t('belowMinWage', { min: ((minWage ?? 0) / 100).toFixed(2) })}</Text>}
              <Field label={t('weeklyHours')}>
                <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
              </Field>

              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
                  <Text style={styles.btnText}>{t('cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('create')}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailModal({
  emp,
  rate,
  minWage,
  onClose,
  onChanged,
}: {
  emp: Emp;
  rate: number | null;
  minWage: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [newRate, setNewRate] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const cents = parseRateCents(newRate);
  const lowRate = Number.isFinite(cents) && minWage !== null && cents < minWage;

  async function saveRate() {
    setError(null);
    setInfo(null);
    if (!Number.isInteger(cents) || cents < 100 || cents > 20000) return setError(t('rateInvalid'));
    setBusy(true);
    const { error: err } = await supabase
      .from('employee_rates')
      .upsert({ employee_id: emp.id, valid_from: today(), hourly_rate_cents: cents }, { onConflict: 'employee_id,valid_from' });
    setBusy(false);
    if (err) return setError(t('genericFail'));
    onChanged();
  }

  async function resetPin() {
    setError(null);
    setInfo(null);
    const next = pin || newPin();
    if (isWeakPin(next)) return setError(t('weakPin'));
    setBusy(true);
    const { error: err } = await supabase.functions.invoke('manage-employee', {
      body: { action: 'reset_pin', employeeId: emp.id, pin: next },
    });
    setBusy(false);
    if (err) return setError(t(await failKey(err)));
    setPin(next);
    setInfo(`${t('pinResetDone')}: ${next}`);
  }

  async function toggleActive() {
    setBusy(true);
    const { error: err } = await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id);
    setBusy(false);
    if (err) return setError(t('genericFail'));
    onChanged();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>
              {emp.first_name} {emp.last_name}
            </Text>
            <Text style={styles.sub}>
              #{emp.personnel_no} · {t('currentRate')}: {euro(rate)}
            </Text>

            <Field label={t('newRate')}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={newRate} onChangeText={setNewRate} keyboardType="decimal-pad" />
                <Pressable style={styles.small} onPress={saveRate} disabled={busy}>
                  <Text style={styles.smallText}>{t('save')}</Text>
                </Pressable>
              </View>
            </Field>
            {lowRate && <Text style={styles.warn}>{t('belowMinWage', { min: ((minWage ?? 0) / 100).toFixed(2) })}</Text>}

            <Field label={t('resetPin')}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder={t('generate')}
                />
                <Pressable style={styles.small} onPress={resetPin} disabled={busy}>
                  <Text style={styles.smallText}>{t('save')}</Text>
                </Pressable>
              </View>
            </Field>

            {info && <Text style={styles.ok}>{info}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.btn, { backgroundColor: emp.active ? colors.stop : colors.start }, busy && { opacity: 0.5 }]}
              onPress={toggleActive}
              disabled={busy}
            >
              <Text style={styles.btnText}>{emp.active ? t('deactivate') : t('activate')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
              <Text style={styles.btnText}>{t('close')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16 },
  row: { backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  rate: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
  small: { backgroundColor: colors.text, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  smallText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  error: { color: colors.stop, fontSize: 15 },
  warn: { color: colors.warn, fontSize: 14 },
  ok: { color: colors.start, fontSize: 17, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 14 },
  cred: { backgroundColor: colors.bg, borderRadius: 12, padding: 16 },
  credValue: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 2, fontVariant: ['tabular-nums'] },
});
