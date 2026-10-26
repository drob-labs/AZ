import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { PRIVACY_URL, SUPPORT_EMAIL } from '../../src/lib/config';
import { useSession } from '../../src/state/session';
import { useTracker } from '../../src/state/tracker';
import { colors } from '../../src/ui/theme';

export default function Profile() {
  const { t, locale, setLocale } = useI18n();
  const { employee, signOut } = useSession();
  const tr = useTracker();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  async function logout() {
    // Orët që s'janë dërguar ende ruhen vetëm në këtë telefon, prandaj nuk lejojmë daljen para dërgimit.
    await tr.syncNow();
    if (tr.hasUnsynced()) {
      setBlocked(true);
      return;
    }
    await signOut();
    router.replace('/login');
  }

  function requestDeletion() {
    const subject = encodeURIComponent(t('deleteSubject'));
    const body = encodeURIComponent(`${employee?.first_name ?? ''} ${employee?.last_name ?? ''} (${employee?.personnel_no ?? ''})`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.body}>
        <Text style={styles.name}>{employee ? `${employee.first_name} ${employee.last_name}` : ''}</Text>
        <Text style={styles.no}>{employee?.personnel_no}</Text>

        <Text style={styles.label}>{t('language')}</Text>
        <View style={styles.langRow}>
          {(['sq', 'de'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLocale(l)} style={[styles.lang, locale === l && styles.langActive]}>
              <Text style={[styles.langText, locale === l && { color: '#fff' }]}>
                {l === 'sq' ? 'Shqip' : 'Deutsch'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.linkText}>{t('privacy')}</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={requestDeletion}>
          <Text style={styles.linkText}>{t('deleteAccount')}</Text>
        </Pressable>

        {blocked && <Text style={styles.blocked}>{t('logoutPending')}</Text>}
        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 24, gap: 12 },
  name: { fontSize: 26, fontWeight: '700', color: colors.text },
  no: { fontSize: 16, color: colors.muted, marginBottom: 16 },
  label: { fontSize: 14, color: colors.muted, marginTop: 8 },
  langRow: { flexDirection: 'row', gap: 10 },
  lang: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  langActive: { backgroundColor: colors.text, borderColor: colors.text },
  langText: { fontSize: 16, fontWeight: '600', color: colors.text },
  link: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkText: { fontSize: 17, color: colors.primary },
  logout: { marginTop: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.stop, borderRadius: 12, padding: 16, alignItems: 'center' },
  blocked: { color: colors.warn, fontSize: 15, marginTop: 16 },
  logoutText: { color: colors.stop, fontSize: 18, fontWeight: '700' },
});
