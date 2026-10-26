import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { formatDuration, formatTime } from '../../src/lib/format';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/ui/theme';

const REFRESH_MS = 30_000;
const FORGOTTEN_AFTER_MIN = 13 * 60;

interface OpenShift {
  client_id: string;
  started_at: string;
  employees: { first_name: string; last_name: string; personnel_no: string } | null;
  sites: { name: string; address: string | null } | null;
  breaks: { ended_at: string | null }[];
}

export default function Team() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OpenShift[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('shifts')
      .select('client_id, started_at, employees(first_name, last_name, personnel_no), sites(name, address), breaks(ended_at)')
      .is('ended_at', null)
      .order('started_at', { ascending: true });
    setRows((data ?? []) as unknown as OpenShift[]);
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('workingNow')}</Text>
        <Text style={styles.count}>{rows.length}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.client_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('nobodyWorking')}</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => {
          const paused = item.breaks.some((b) => b.ended_at === null);
          const openMin = Math.round((nowMs - Date.parse(item.started_at)) / 60000);
          const forgotten = openMin > FORGOTTEN_AFTER_MIN;
          return (
            <View style={[styles.row, forgotten && styles.rowWarn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.employees ? `${item.employees.first_name} ${item.employees.last_name}` : '—'}
                </Text>
                <Text style={styles.sub}>
                  {t('since')} {formatTime(item.started_at)} · {formatDuration(openMin)}
                </Text>
                {item.sites ? (
                  <Text style={styles.site}>
                    📍 {item.sites.name}
                    {item.sites.address ? ` · ${item.sites.address}` : ''}
                  </Text>
                ) : null}
                {forgotten && <Text style={styles.warn}>⚠ {t('forgotStop')}</Text>}
              </View>
              <View style={[styles.badge, { backgroundColor: paused ? colors.pause : colors.start }]}>
                <Text style={styles.badgeText}>{paused ? t('onBreak') : t('statusWorking')}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  count: { fontSize: 26, fontWeight: '700', color: colors.start },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowWarn: { borderColor: colors.warn },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  site: { fontSize: 14, color: colors.text, marginTop: 4 },
  warn: { fontSize: 13, color: colors.warn, marginTop: 4 },
  badge: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
