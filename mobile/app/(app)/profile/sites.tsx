import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { formatAddress, isValidPostalCode, parseAddress } from '../../../src/core/address';
import { useI18n } from '../../../src/i18n';
import { pickSiteImage, removeSiteImage, sitePhotoUrl, uploadSiteImage } from '../../../src/lib/sitePhoto';
import { supabase } from '../../../src/lib/supabase';
import { KeyboardBackdrop } from '../../../src/ui/KeyboardBackdrop';
import { colors } from '../../../src/ui/theme';

interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  active: boolean;
  photo_path: string | null;
}

export default function Sites() {
  const { t } = useI18n();
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<SiteRow | 'new' | null>(null);
  const [filter, setFilter] = useState<'active' | 'done'>('active');

  const load = useCallback(async () => {
    setRefreshing(true);
    const sites = await supabase
      .from('sites')
      .select('id, name, address, street, postal_code, city, active, photo_path')
      .order('active', { ascending: false })
      .order('name');
    setRows((sites.data ?? []) as SiteRow[]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('sitesTitle')}</Text>
        <Pressable style={styles.addBtn} onPress={() => setEditing('new')} accessibilityRole="button">
          <Text style={styles.addText}>＋ {t('addSite')}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['active', 'done'] as const).map((f) => {
          const count = rows.filter((r) => r.active === (f === 'active')).length;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.tab, filter === f && styles.tabOn]}>
              <Text style={[styles.tabText, filter === f && { color: '#fff' }]}>
                {f === 'active' ? t('siteActive') : t('siteFinished')} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows.filter((r) => r.active === (filter === 'active'))}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('noSites')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setEditing(item)}>
            {item.photo_path ? <Image source={{ uri: sitePhotoUrl(item.photo_path)! }} style={styles.thumb} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.address ? <Text style={styles.sub}>{item.address}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: item.active ? colors.start : colors.muted }]}>
              <Text style={styles.badgeText}>{item.active ? t('siteActive') : t('siteFinished')}</Text>
            </View>
          </Pressable>
        )}
      />

      {editing && (
        <SiteModal
          site={editing === 'new' ? null : editing}
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

function SiteModal({ site, onClose, onSaved }: { site: SiteRow | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(site?.name ?? '');
  // Baustelle të vjetra pa pjesë të ruajtura: ndaje adresën e shkruar lirisht që fushat të dalin të plotësuara.
  const initial = site?.street || site?.postal_code || site?.city
    ? { street: site.street ?? '', postalCode: site.postal_code ?? '', city: site.city ?? '' }
    : parseAddress(site?.address);
  const [street, setStreet] = useState(initial.street);
  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [city, setCity] = useState(initial.city);
  const [active, setActive] = useState(site?.active ?? true);
  // Foto e re mbahet vetëm në telefon deri te "Ruaj", që anulimi të mos lërë skedarë të panevojshëm në storage.
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUri = newPhotoUri ?? (photoRemoved ? null : sitePhotoUrl(site?.photo_path));

  async function choosePhoto() {
    setError(null);
    const res = await pickSiteImage();
    if (res.status === 'ok') {
      setNewPhotoUri(res.uri);
      setPhotoRemoved(false);
    } else if (res.status === 'denied') setError(t('photoDenied'));
    else if (res.status === 'error') setError(t('photoError'));
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError(t('fillAll'));
    if (!isValidPostalCode(postalCode)) return setError(t('sitePostalInvalid'));
    setBusy(true);
    let photoPath = site?.photo_path ?? null;
    if (newPhotoUri) {
      const uploaded = await uploadSiteImage(newPhotoUri);
      if (!uploaded) {
        setBusy(false);
        return setError(t('photoError'));
      }
      photoPath = uploaded;
    } else if (photoRemoved) {
      photoPath = null;
    }
    const values = {
      name: name.trim(),
      address: formatAddress({ street, postalCode, city }) || null,
      street: street.trim() || null,
      postal_code: postalCode || null,
      city: city.trim() || null,
      active,
      photo_path: photoPath,
    };
    const { error: err } = site
      ? await supabase.from('sites').update(values).eq('id', site.id)
      : await supabase.from('sites').insert(values);
    if (err) {
      if (newPhotoUri) await removeSiteImage(photoPath);
      setBusy(false);
      return setError(t('genericFail'));
    }
    // Fshij foton e vjetër që storage të mos mbushet.
    if (site?.photo_path && site.photo_path !== photoPath) await removeSiteImage(site.photo_path);
    setBusy(false);
    onSaved();
  }

  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardBackdrop style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{site ? site.name : t('addSite')}</Text>

            <Text style={styles.label}>{t('sitePhoto')}</Text>
            {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}
            <View style={styles.btnRow}>
              <Pressable style={styles.photoBtn} onPress={choosePhoto} accessibilityRole="button">
                <Text style={styles.photoBtnText}>{previewUri ? t('sitePhotoChange') : t('sitePhotoChoose')}</Text>
              </Pressable>
              {previewUri ? (
                <Pressable
                  style={styles.photoBtn}
                  onPress={() => {
                    setNewPhotoUri(null);
                    setPhotoRemoved(true);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.photoBtnText, { color: colors.muted }]}>{t('sitePhotoRemove')}</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.label}>{t('siteName')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.label}>{t('siteStreet')}</Text>
            <TextInput style={styles.input} value={street} onChangeText={setStreet} autoCapitalize="words" />

            <View style={styles.cityRow}>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={styles.label}>{t('sitePostal')}</Text>
                <TextInput
                  style={styles.input}
                  value={postalCode}
                  onChangeText={(v) => setPostalCode(v.replace(/D/g, '').slice(0, 5))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 2, gap: 10 }}>
                <Text style={styles.label}>{t('siteCity')}</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} autoCapitalize="words" />
              </View>
            </View>

            <Text style={styles.label}>{t('siteStatus')}</Text>
            <View style={styles.seg}>
              {([true, false] as const).map((v) => (
                <Pressable key={String(v)} onPress={() => setActive(v)} style={[styles.segBtn, active === v && (v ? styles.segOn : styles.segDone)]}>
                  <Text style={[styles.segText, active === v && { color: '#fff' }]}>{v ? t('siteActive') : t('siteFinished')}</Text>
                </Pressable>
              ))}
            </View>
            {!active && <Text style={styles.hint}>{t('siteFinishedHint')}</Text>}

            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
                <Text style={styles.btnText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('save')}</Text>}
              </Pressable>
            </View>
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
  badge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.bg },
  segOn: { backgroundColor: colors.start, borderColor: colors.start },
  segDone: { backgroundColor: colors.muted, borderColor: colors.muted },
  segText: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16, paddingHorizontal: 24 },
  row: { backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cityRow: { flexDirection: 'row', gap: 10 },
  thumb: { width: 64, height: 40, borderRadius: 8, marginRight: 12, backgroundColor: colors.primarySoft },
  preview: { width: '100%', aspectRatio: 1.6, borderRadius: 12, backgroundColor: colors.primarySoft },
  photoBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
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
});
