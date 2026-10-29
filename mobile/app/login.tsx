import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LOCALES, useI18n } from '../src/i18n';
import { configured } from '../src/lib/config';
import { useSession } from '../src/state/session';
import { Logo } from '../src/ui/Logo';
import { colors } from '../src/ui/theme';

export default function Login() {
  const { t, locale, setLocale } = useI18n();
  const { signIn, startDemo } = useSession();
  const router = useRouter();
  const [personnelNo, setPersonnelNo] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = personnelNo.trim().length > 0 && /^\d{6}$/.test(pin) && !busy && configured;

  async function submit() {
    setBusy(true);
    setError(null);
    const ok = await signIn(personnelNo, pin);
    setBusy(false);
    if (ok) router.replace('/');
    else {
      setError(t('loginFailed'));
      setPin('');
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <Logo height={130} />
        <Text style={styles.brand}>{t('appName')}</Text>
        <Text style={styles.title}>{t('loginTitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('personnelNo')}
          placeholderTextColor={colors.muted}
          value={personnelNo}
          onChangeText={setPersonnelNo}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel={t('personnelNo')}
        />
        <TextInput
          style={styles.input}
          placeholder={t('pin')}
          placeholderTextColor={colors.muted}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && submit()}
          accessibilityLabel={t('pin')}
        />

        {!configured && <Text style={styles.error}>{t('notConfigured')}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={submit}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('loginButton')}</Text>}
        </Pressable>

        <Pressable
          style={styles.demoButton}
          onPress={() => {
            startDemo();
            router.replace('/');
          }}
          accessibilityRole="button"
        >
          <Text style={styles.demoText}>{t('demoButton')}</Text>
        </Pressable>
        <Pressable style={styles.infoButton} onPress={() => router.push('/info')} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.infoText}>{t('infoButton')}</Text>
        </Pressable>

        <View style={styles.langRow}>
          {LOCALES.map((l) => (
            <Pressable key={l} onPress={() => setLocale(l)} style={[styles.lang, locale === l && styles.langActive]}>
              <Text style={[styles.langText, locale === l && styles.langTextActive]}>{l === 'sq' ? 'AL' : l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 24, justifyContent: 'center', gap: 14 },
  brand: { fontSize: 15, color: colors.muted, fontWeight: '600', textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 12 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    color: colors.text,
  },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  demoButton: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  demoText: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  infoButton: { alignItems: 'center', padding: 4 },
  infoText: { color: colors.muted, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  error: { color: colors.stop, fontSize: 16, textAlign: 'center' },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  lang: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  langActive: { backgroundColor: colors.text, borderColor: colors.text },
  langText: { color: colors.text, fontWeight: '600' },
  langTextActive: { color: '#fff' },
});
