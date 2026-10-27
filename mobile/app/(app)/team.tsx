import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { formatDuration, formatTime } from '../../src/lib/format';
import { sitePhotoUrl } from '../../src/lib/sitePhoto';
import { supabase } from '../../src/lib/supabase';
import { Avatar } from '../../src/ui/Avatar';
import { Icon } from '../../src/ui/Icon';
import { colors } from '../../src/ui/theme';

const REFRESH_MS = 30_000;
const FORGOTTEN_AFTER_MIN = 13 * 60;
const NO_SITE = '__none__';


interface OpenShift {
  client_id: string;
  site_id: string | null;
  started_at: string;
  employees: { first_name: string; last_name: string; personnel_no: string; avatar_path: string | null } | null;
  breaks: { ended_at: string | null }[];
}

interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  photo_path: string | null;
}

interface Card {
  id: string;
  name: string;
  address: string | null;
  photo_path: string | null;
  workers: OpenShift[];
}

const SPACER: Card = { id: '__spacer__', name: '', address: null, photo_path: null, workers: [] };

export default function Home() {
  const { t } = useI18n();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [s, sh] = await Promise.all([
      supabase.from('sites').select('id, name, address, photo_path').eq('active', true).order('name'),
      supabase
        .from('shifts')
        .select('client_id, site_id, started_at, employees(first_name, last_name, personnel_no, avatar_path), breaks(ended_at)')
        .is('ended_at', null)
        .order('started_at', { ascending: true }),
    ]);
    setSites((s.data ?? []) as SiteRow[]);
    setShifts((sh.data ?? []) as unknown as OpenShift[]);
    setNowMs(Date.now());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Tab-et mbeten të hapura, prandaj rifreskojmë sa herë që kthehesh në ekran.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cards = useMemo<Card[]>(() => {
    const bySite = new Map<string, OpenShift[]>();
    for (const sh of shifts) {
      const key = sh.site_id ?? NO_SITE;
      bySite.set(key, [...(bySite.get(key) ?? []), sh]);
    }
    const list: Card[] = sites.map((s) => ({ ...s, workers: bySite.get(s.id) ?? [] }));
    // Baustelle me njerëz në punë dalin të parat.
    list.sort((a, b) => b.workers.length - a.workers.length || a.name.localeCompare(b.name, 'de'));
    // Turnet pa Baustelle (ose me Baustelle të përfunduar) mblidhen në një kartë të vetme.
    const known = new Set(sites.map((s) => s.id));
    const other = shifts.filter((sh) => !sh.site_id || !known.has(sh.site_id));
    if (other.length) list.push({ id: NO_SITE, name: t('noSiteGroup'), address: null, photo_path: null, workers: other });
    return list;
  }, [sites, shifts, t]);

  const open = cards.find((c) => c.id === openId) ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <FlatList
        data={cards.length % 2 ? [...cards, SPACER] : cards}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: colors.primary }]}>
              <Text style={[styles.statNum, { color: '#fff' }]}>{shifts.length}</Text>
              <Text style={[styles.statLabel, { color: '#DCEFE5' }]}>{t('homeWorking')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{sites.length}</Text>
              <Text style={styles.statLabel}>{t('homeSitesLabel')}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('noActiveSites')}</Text>}
        renderItem={({ item }) => {
          if (item.id === SPACER.id) return <View style={{ flex: 1 }} />;
          const url = sitePhotoUrl(item.photo_path);
          const busy = item.workers.length > 0;
          return (
            <Pressable style={[styles.card, { flex: 1 }]} onPress={() => setOpenId(item.id)} accessibilityRole="button">
              {url ? (
                <Image source={{ uri: url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Icon name="buildings" color={colors.primary} size={32} />
                </View>
              )}
              <View style={[styles.pill, { backgroundColor: busy ? colors.start : 'rgba(22,32,28,0.65)' }]}>
                <View style={[styles.dot, { backgroundColor: busy ? '#fff' : '#9AA5A0' }]} />
                <Text style={styles.pillText}>{t('onSiteNow', { n: item.workers.length })}</Text>
              </View>
              <View style={styles.caption}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {item.address ? <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      {open && (
        <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={() => setOpenId(null)}>
          <Pressable style={styles.backdrop} onPress={() => setOpenId(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>{open.name}</Text>
              {open.address ? <Text style={styles.sheetSub}>{open.address}</Text> : null}
              <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 14 }}>
                {open.workers.length === 0 && <Text style={styles.empty}>{t('noWorkersOnSite')}</Text>}
                {open.workers.map((w) => {
                  const paused = w.breaks.some((b) => b.ended_at === null);
                  const openMin = Math.round((nowMs - Date.parse(w.started_at)) / 60000);
                  const forgotten = openMin > FORGOTTEN_AFTER_MIN;
                  return (
                    <View key={w.client_id} style={[styles.worker, forgotten && { borderColor: colors.warn }]}>
                      {w.employees && (
                        <Avatar path={w.employees.avatar_path} first={w.employees.first_name} last={w.employees.last_name} size={48} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerName}>{w.employees ? `${w.employees.first_name} ${w.employees.last_name}` : '—'}</Text>
                        <Text style={styles.workerSub}>
                          {t('since')} {formatTime(w.started_at)} · {formatDuration(openMin)}
                        </Text>
                        {forgotten && <Text style={styles.warn}>{t('forgotStop')}</Text>}
                      </View>
                      <View style={[styles.badge, { backgroundColor: paused ? colors.pause : colors.start }]}>
                        <Text style={styles.badgeText}>{paused ? t('onBreak') : t('statusWorking')}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 2 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 34, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 14, fontWeight: '600', color: colors.muted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30, fontSize: 16, paddingHorizontal: 24 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  photo: { width: '100%', aspectRatio: 1.35, backgroundColor: colors.primarySoft },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 9 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  caption: { padding: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardAddr: { fontSize: 12, color: colors.muted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, padding: 20, paddingTop: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  sheetSub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  worker: { backgroundColor: colors.card, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  workerName: { fontSize: 17, fontWeight: '700', color: colors.text },
  workerSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  warn: { fontSize: 13, color: colors.warn, marginTop: 3 },
  badge: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
