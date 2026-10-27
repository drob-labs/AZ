import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isWeakPin } from '../core/pin';
import { useI18n } from '../i18n';
import { workerEmail } from '../lib/config';
import { supabase } from '../lib/supabase';
import { useSession } from '../state/session';
import { KeyboardBackdrop } from './KeyboardBackdrop';
import { colors } from './theme';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardBackdrop style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </KeyboardBackdrop>
    </Modal>
  );
}

function Actions({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.btnRow}>
      <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onCancel} disabled={busy}>
        <Text style={styles.btnText}>{t('cancel')}</Text>
      </Pressable>
      <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={onSave} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
      </Pressable>
    </View>
  );
}

/** Ndrysho emrin dhe mbiemrin e vet. */
export function NameModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { employee, refreshEmployee } = useSession();
  const [first, setFirst] = useState(employee?.first_name ?? '');
  const [last, setLast] = useState(employee?.last_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!first.trim() || !last.trim()) return setError(t('fillAll'));
    setBusy(true);
    const { error: err } = await supabase.rpc('update_my_name', { p_first: first.trim(), p_last: last.trim() });
    if (err) {
      setBusy(false);
      return setError(t('genericFail'));
    }
    await refreshEmployee();
    setBusy(false);
    onClose();
  }

  return (
    <Sheet title={t('changeName')} onClose={onClose}>
      <Text style={styles.label}>{t('firstName')}</Text>
      <TextInput style={styles.input} value={first} onChangeText={setFirst} autoCapitalize="words" maxLength={40} />
      <Text style={styles.label}>{t('lastName')}</Text>
      <TextInput style={styles.input} value={last} onChangeText={setLast} autoCapitalize="words" maxLength={40} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Actions busy={busy} onCancel={onClose} onSave={save} />
    </Sheet>
  );
}

/** Ndrysho PIN-in e vet (6 shifra). Së pari verifikohet PIN-i aktual. */
export function PinModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { employee } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  async function save() {
    setError(null);
    if (!/^\d{6}$/.test(current) || !/^\d{6}$/.test(next)) return setError(t('fillAll'));
    if (isWeakPin(next)) return setError(t('weakPin'));
    if (next === current) return setError(t('pinSame'));
    if (next !== again) return setError(t('pinMismatch'));
    if (!employee) return;

    setBusy(true);
    // Verifikon PIN-in aktual (njëkohësisht rinis sesionin).
    const check = await supabase.auth.signInWithPassword({ email: workerEmail(employee.personnel_no), password: current });
    if (check.error) {
      setBusy(false);
      return setError(t('pinWrong'));
    }
    const { error: err } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (err) return setError(t('genericFail'));
    setDone(true);
  }

  if (done) {
    return (
      <Sheet title={t('changePin')} onClose={onClose}>
        <Text style={styles.ok}>{t('pinChanged')}</Text>
        <Pressable style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>{t('close')}</Text>
        </Pressable>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('changePin')} onClose={onClose}>
      <Text style={styles.label}>{t('currentPin')}</Text>
      <TextInput style={styles.input} value={current} onChangeText={(v) => setCurrent(digits(v))} secureTextEntry keyboardType="number-pad" maxLength={6} />
      <Text style={styles.label}>{t('newPin')}</Text>
      <TextInput style={styles.input} value={next} onChangeText={(v) => setNext(digits(v))} secureTextEntry keyboardType="number-pad" maxLength={6} />
      <Text style={styles.label}>{t('confirmPin')}</Text>
      <TextInput style={styles.input} value={again} onChangeText={(v) => setAgain(digits(v))} secureTextEntry keyboardType="number-pad" maxLength={6} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Actions busy={busy} onCancel={onClose} onSave={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
  error: { color: colors.stop, fontSize: 15 },
  ok: { color: colors.start, fontSize: 16, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
