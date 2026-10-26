import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { PRIVACY_URL, SUPPORT_EMAIL } from '../../src/lib/config';
import { pickAndUploadAvatar, removeAvatar } from '../../src/lib/avatar';
import { useSession } from '../../src/state/session';
import { useTracker } from '../../src/state/tracker';
import { Avatar } from '../../src/ui/Avatar';
import { colors } from '../../src/ui/theme';

export default function Profile() {
  const { t, locale, setLocale } = useI18n();
  const { employee, signOut, refreshEmployee } = useSession();
  const tr = useTracker();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  async function changePhoto() {
    if (!employee || photoBusy) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    const res = await pickAndUploadAvatar(employee.id, employee.avatar_path);
    if (res === 'ok') await refreshEmployee();
    else if (res === 'denied') setPhotoMsg(t('photoDenied'));
    else if (res === 'error') setPhotoMsg(t('photoError'));
    setPhotoBusy(false);
  }

  async function deletePhoto() {
    if (!employee || photoBusy) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    if (await removeAvatar(employee.avatar_path)) await refreshEmployee();
    else setPhotoMsg(t('photoError'));
    setPhotoBusy(false);
  }

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
        <View style={styles.identity}>
          {employee && <Avatar path={employee.avatar_path} first={employee.first_name} last={employee.last_name} size={88} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{employee ? `${employee.first_name} ${employee.last_name}` : ''}</Text>
            <Text style={styles.no}>{employee?.personnel_no}</Text>
          </View>
        </View>
        <View style={styles.photoRow}>
          <Pressable style={[styles.photoBtn, photoBusy && { opacity: 0.5 }]} onPress={changePhoto} disabled={photoBusy} accessibilityRole="button">
            <Text style={styles.photoBtnText}>{employee?.avatar_path ? t('photoChange') : t('photoChoose')}</Text>
          </Pressable>
          {employee?.avatar_path ? (
            <Pressable style={styles.photoBtn} onPress={deletePhoto} disabled={photoBusy} accessibilityRole="button">
              <Text style={[styles.photoBtnText, { color: colors.muted }]}>{t('photoRemove')}</Text>
            </Pressable>
          ) : null}
        </View>
        {photoMsg && <Text style={styles.blocked}>{photoMsg}</Text>}

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
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  no: { fontSize: 16, color: colors.muted, marginTop: 2 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  photoBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
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
