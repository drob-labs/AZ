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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/ui/theme';

interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
}

export default function Sites() {
  const { t } = useI18n();
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [requireSite, setRequireSite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<SiteRow | 'new' | null>(null);
  const [filter, setFilter] = useState<'active' | 'done'>('active');

  const load = useCallback(async () => {
    setRefreshing(true);
    const [sites, settings] = await Promise.all([
      supabase.from('sites').select('id, name, address, active').order('active', { ascending: false }).order('name'),
      supabase.from('settings').select('require_site').single(),
    ]);
    setRows((sites.data ?? []) as SiteRow[]);
    setRequireSite(settings.data?.require_site ?? false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggleRequire(value: boolean) {
    setRequireSite(value);
    const { error } = await supabase.from('settings').update({ require_site: value }).eq('id', true);
    if (error) setRequireSite(!value);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('sitesTitle')}</Text>
        <Pressable style={styles.addBtn} onPress={() => setEditing('new')} accessibilityRole="button">
          <Text style={styles.addText}>＋ {t('addSite')}</Text>
        </Pressable>
        <View style={styles.switchRow}>
          <Switch value={requireSite} onValueChange={toggleRequire} />
          <Text style={styles.switchText}>{t('requireSiteLabel')}</Text>
        </View>
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
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>📍 {item.name}</Text>
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
  const [address, setAddress] = useState(site?.address ?? '');
  const [active, setActive] = useState(site?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) return setError(t('fillAll'));
    setBusy(true);
    const values = { name: name.trim(), address: address.trim() || null, active };
    const { error: err } = site
      ? await supabase.from('sites').update(values).eq('id', site.id)
      : await supabase.from('sites').insert(values);
    setBusy(false);
    if (err) return setError(t('genericFail'));
    onSaved();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{site ? site.name : t('addSite')}</Text>

            <Text style={styles.label}>{t('siteName')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.label}>{t('siteAddress')}</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} />

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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchText: { flex: 1, fontSize: 15, color: colors.text },
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
