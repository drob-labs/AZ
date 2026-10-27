import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LOCALES, useI18n, type Locale } from '../../../src/i18n';
import { pickAndUploadAvatar, removeAvatar } from '../../../src/lib/avatar';
import { PRIVACY_URL, SUPPORT_EMAIL } from '../../../src/lib/config';
import { useSession } from '../../../src/state/session';
import { useTracker } from '../../../src/state/tracker';
import { Avatar } from '../../../src/ui/Avatar';
import { Icon } from '../../../src/ui/Icon';
import { NameModal, PinModal } from '../../../src/ui/ProfileEditors';
import { Group, Row } from '../../../src/ui/Settings';
import { colors } from '../../../src/ui/theme';

const LANGUAGE_NAMES: Record<Locale, string> = { sq: 'Shqip', de: 'Deutsch', en: 'English' };

export default function Profile() {
  const { t, locale, setLocale } = useI18n();
  const { employee, signOut, refreshEmployee } = useSession();
  const tr = useTracker();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [editing, setEditing] = useState<'name' | 'pin' | null>(null);

  const isAdmin = employee?.role === 'admin';
  const fullName = employee ? `${employee.first_name} ${employee.last_name}` : '';

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
    const body = encodeURIComponent(`${fullName} (${employee?.personnel_no ?? ''})`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Pressable onPress={changePhoto} disabled={photoBusy} accessibilityRole="button" accessibilityLabel={t('photoChange')}>
            {employee && <Avatar path={employee.avatar_path} first={employee.first_name} last={employee.last_name} size={104} />}
            <View style={styles.badge}>
              {photoBusy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="camera" color="#fff" size={16} filled />}
            </View>
          </Pressable>
          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.meta}>
            <View style={styles.role}>
              <Text style={styles.roleText}>{isAdmin ? t('roleAdmin') : t('roleWorker')}</Text>
            </View>
            <Text style={styles.username}>@{employee?.personnel_no}</Text>
          </View>
          {employee?.avatar_path ? (
            <Pressable onPress={deletePhoto} disabled={photoBusy} hitSlop={8}>
              <Text style={styles.removePhoto}>{t('photoRemove')}</Text>
            </Pressable>
          ) : null}
          {photoMsg ? <Text style={styles.warn}>{photoMsg}</Text> : null}
        </View>

        <Group title={t('profileAccount')}>
          <Row icon="user" label={t('changeName')} value={fullName} onPress={() => setEditing('name')} />
          <Row icon="lock" label={t('changePin')} onPress={() => setEditing('pin')} />
        </Group>

        {!isAdmin && (
          <Group title={t('profileWork')}>
            <Row icon="calendarCheck" label={t('routineTitle')} onPress={() => router.push('/profile/routine')} />
          </Group>
        )}

        <Group title={t('profilePrefs')}>
          <Row icon="globe" label={t('language')} value={LANGUAGE_NAMES[locale]} onPress={() => setPickingLanguage(true)} />
        </Group>

        {isAdmin && (
          <Group title={t('profileManage')}>
            <Row icon="buildings" label={t('sitesTitle')} onPress={() => router.push('/profile/sites')} />
          </Group>
        )}

        <Group title={t('profileHelpSection')}>
          <Row icon="lifebuoy" label={t('helpCenter')} onPress={() => router.push('/profile/help')} />
        </Group>

        <Group title={t('profileLegal')}>
          <Row icon="shieldCheck" label={t('privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row icon="trash" label={t('deleteAccount')} onPress={requestDeletion} />
        </Group>

        {blocked && <Text style={styles.warn}>{t('logoutPending')}</Text>}
        <Group>
          <Row icon="signOut" label={t('logout')} onPress={logout} danger plain />
        </Group>

        <Text style={styles.version}>
          {t('appVersion', { v: Constants.expoConfig?.version ?? '1.0.0' })} · AZ Trockenbau & Innenausbau
        </Text>
      </ScrollView>

      {editing === 'name' && <NameModal onClose={() => setEditing(null)} />}
      {editing === 'pin' && <PinModal onClose={() => setEditing(null)} />}

      <Modal visible={pickingLanguage} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setPickingLanguage(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickingLanguage(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{t('chooseLanguage')}</Text>
            <View style={styles.options}>
              {LOCALES.map((l) => (
                <Pressable
                  key={l}
                  style={[styles.option, locale === l && styles.optionOn]}
                  onPress={() => {
                    setLocale(l);
                    setPickingLanguage(false);
                  }}
                >
                  <Text style={[styles.optionText, locale === l && { color: colors.primary }]}>{LANGUAGE_NAMES[l]}</Text>
                  {locale === l && <Icon name="check" color={colors.primary} size={20} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 18, paddingBottom: 28 },
  identity: { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4 },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  role: { backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  roleText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  username: { fontSize: 15, color: colors.muted },
  removePhoto: { fontSize: 14, color: colors.muted, fontWeight: '600', textDecorationLine: 'underline' },
  warn: { color: colors.warn, fontSize: 14, textAlign: 'center' },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, padding: 20, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { fontSize: 17, fontWeight: '600', color: colors.text },
});
