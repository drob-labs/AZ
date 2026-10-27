import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { berlinHhmm, berlinLocalToIso, berlinParts } from '../../src/core/berlin';
import { useI18n } from '../../src/i18n';
import { formatDay, formatTime } from '../../src/lib/format';
import { supabase } from '../../src/lib/supabase';
import { DateTimeField } from '../../src/ui/DateTimeField';
import { KeyboardBackdrop } from '../../src/ui/KeyboardBackdrop';
import { colors } from '../../src/ui/theme';

interface ApptRow {
  id: string;
  title: string;
  starts_at: string;
  address: string | null;
  notes: string | null;
  done: boolean;
}

export default function Appointments() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<ApptRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<ApptRow | 'new' | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('appointments')
      .select('id, title, starts_at, address, notes, done')
      .order('starts_at');
    setRows((data ?? []) as ApptRow[]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Të ardhshme = ende të pakryera; të kaluara = të kryera ose me datë të kaluar (para fillimit të ditës së sotme).
  const today = berlinParts(new Date().toISOString()).date;
  const isPast = (r: ApptRow) => r.done || berlinParts(r.starts_at).date < today;
  const upcoming = rows.filter((r) => !isPast(r));
  const past = rows.filter(isPast).reverse();
  const shown = filter === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('appointmentsTitle')}</Text>
        <Pressable style={styles.addBtn} onPress={() => setEditing('new')} accessibilityRole="button">
          <Text style={styles.addText}>＋ {t('addAppointment')}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.tab, filter === f && styles.tabOn]}>
            <Text style={[styles.tabText, filter === f && { color: '#fff' }]}>
              {f === 'upcoming' ? t('apptUpcoming') : t('apptPast')} ({f === 'upcoming' ? upcoming.length : past.length})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('noAppointments')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setEditing(item)}>
            <View style={styles.when}>
              <Text style={styles.whenDay}>{formatDay(item.starts_at, locale)}</Text>
              <Text style={styles.whenTime}>{formatTime(item.starts_at)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, item.done && styles.nameDone]}>{item.title}</Text>
              {item.address ? <Text style={styles.sub}>{item.address}</Text> : null}
              {item.notes ? <Text style={styles.sub} numberOfLines={2}>{item.notes}</Text> : null}
            </View>
          </Pressable>
        )}
      />

      {editing && (
        <ApptModal
          appt={editing === 'new' ? null : editing}
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

function ApptModal({ appt, onClose, onSaved }: { appt: ApptRow | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(appt?.title ?? '');
  const [date, setDate] = useState(berlinParts(appt?.starts_at ?? new Date().toISOString()).date);
  const [time, setTime] = useState(appt ? berlinHhmm(appt.starts_at) : '09:00');
  const [address, setAddress] = useState(appt?.address ?? '');
  const [notes, setNotes] = useState(appt?.notes ?? '');
  const [done, setDone] = useState(appt?.done ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) return setError(t('fillAll'));
    setBusy(true);
    const values = {
      title: title.trim(),
      starts_at: berlinLocalToIso(date, time),
      address: address.trim() || null,
      notes: notes.trim() || null,
      done,
    };
    const { error: err } = appt
      ? await supabase.from('appointments').update(values).eq('id', appt.id)
      : await supabase.from('appointments').insert(values);
    setBusy(false);
    if (err) return setError(t('genericFail'));
    onSaved();
  }

  async function remove() {
    if (!appt) return;
    setBusy(true);
    const { error: err } = await supabase.from('appointments').delete().eq('id', appt.id);
    setBusy(false);
    if (err) return setError(t('genericFail'));
    onSaved();
  }

  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardBackdrop style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{appt ? appt.title : t('addAppointment')}</Text>

            <Text style={styles.label}>{t('apptTitle')}</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />

            <DateTimeField date={date} time={time} dateLabel={t('apptDate')} timeLabel={t('apptTime')} doneLabel={t('ok')} onChange={(d, tm) => { setDate(d); setTime(tm); }} />

            <Text style={styles.label}>{t('apptAddress')}</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} />

            <Text style={styles.label}>{t('apptNotes')}</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline />

            {appt && (
              <Pressable onPress={() => setDone(!done)} style={[styles.segBtn, done && styles.segOn]}>
                <Text style={[styles.segText, done && { color: '#fff' }]}>{t('apptDone')}</Text>
              </Pressable>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
                <Text style={styles.btnText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
              </Pressable>
            </View>
            {appt && (
              <Pressable onPress={remove} disabled={busy} style={styles.delete}>
                <Text style={styles.deleteText}>{t('apptDelete')}</Text>
              </Pressable>
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
  addBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.bg },
  segOn: { backgroundColor: colors.start, borderColor: colors.start },
  segText: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16, paddingHorizontal: 24 },
  row: { backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: colors.border },
  when: { alignItems: 'center', minWidth: 72 },
  whenDay: { fontSize: 15, fontWeight: '700', color: colors.primary },
  whenTime: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 2 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  nameDone: { textDecorationLine: 'line-through', color: colors.muted },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
  error: { color: colors.stop, fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  delete: { padding: 12, alignItems: 'center' },
  deleteText: { color: colors.stop, fontSize: 16, fontWeight: '700' },
});
