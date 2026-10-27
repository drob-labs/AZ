import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { chatTimeLabel } from '../../../src/core/chatList';
import { useI18n } from '../../../src/i18n';
import type { RoomOverview } from '../../../src/lib/chat';
import { formatTime } from '../../../src/lib/format';
import { nowIso } from '../../../src/lib/id';
import { sitePhotoUrl } from '../../../src/lib/sitePhoto';
import { useChat } from '../../../src/state/chat';
import { useSession } from '../../../src/state/session';
import { Avatar } from '../../../src/ui/Avatar';
import { ChatHeader } from '../../../src/ui/ChatHeader';
import { useSwipeBack } from '../../../src/ui/useSwipeBack';
import { Icon } from '../../../src/ui/Icon';
import { colors } from '../../../src/ui/theme';

type Entry = { type: 'header'; key: string; title: string } | { type: 'room'; key: string; room: RoomOverview };

const byRecent = (a: RoomOverview, b: RoomOverview) => (b.last_at ?? '').localeCompare(a.last_at ?? '');

export default function ChatList() {
  const { t } = useI18n();
  const swipeBack = useSwipeBack();
  const router = useRouter();
  const { employee } = useSession();
  const { overview, people, refresh } = useChat();
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo<Entry[]>(() => {
    const sites = overview.filter((r) => r.kind === 'site').sort((a, b) => byRecent(a, b) || (a.site_name ?? '').localeCompare(b.site_name ?? '', 'de'));
    const dms = overview.filter((r) => r.kind === 'dm').sort(byRecent);
    const list: Entry[] = [];
    if (sites.length) list.push({ type: 'header', key: 'h-sites', title: t('sitesTitle') }, ...sites.map((room): Entry => ({ type: 'room', key: room.room_id, room })));
    if (dms.length) list.push({ type: 'header', key: 'h-dm', title: t('chatDirect') }, ...dms.map((room): Entry => ({ type: 'room', key: room.room_id, room })));
    return list;
  }, [overview, t]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen} {...swipeBack}>
      <ChatHeader
        title={t('chatsTitle')}
        right={
          <Pressable style={styles.plus} onPress={() => router.push('/chat/new')} accessibilityRole="button" accessibilityLabel={t('chatNew')}>
            <Icon name="plus" color="#fff" size={20} />
          </Pressable>
        }
      />
      <FlatList
        data={entries}
        keyExtractor={(e) => e.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="chatCircleDots" color={colors.muted} size={44} />
            <Text style={styles.emptyText}>{t('chatNoRooms')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') return <Text style={styles.section}>{item.title}</Text>;
          const r = item.room;
          const other = r.other_id ? people.get(r.other_id) : undefined;
          const title = r.kind === 'site' ? (r.site_name ?? '') : other ? `${other.first_name} ${other.last_name}` : '…';
          const sender = r.last_sender ? people.get(r.last_sender) : undefined;
          const prefix = r.last_sender === employee?.id ? `${t('chatYou')}: ` : r.kind === 'site' && sender ? `${sender.first_name}: ` : '';
          const photo = sitePhotoUrl(r.site_photo);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/chat/${r.room_id}`)} accessibilityRole="button">
              {r.kind === 'site' ? (
                photo ? (
                  <Image source={{ uri: photo }} style={styles.siteThumb} />
                ) : (
                  <View style={[styles.siteThumb, styles.siteThumbEmpty]}>
                    <Icon name="buildings" color={colors.primary} size={26} />
                  </View>
                )
              ) : other ? (
                <Avatar path={other.avatar_path} first={other.first_name} last={other.last_name} size={52} />
              ) : (
                <View style={[styles.siteThumb, { borderRadius: 26 }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={[styles.preview, r.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {r.last_body ? `${prefix}${r.last_body}` : r.kind === 'site' ? t('chatSiteGroup') : t('chatEmpty')}
                </Text>
              </View>
              <View style={styles.meta}>
                {r.last_at ? <Text style={[styles.time, r.unread > 0 && { color: colors.primary }]}>{chatTimeLabel(r.last_at, nowIso(), formatTime)}</Text> : null}
                {r.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{r.unread > 99 ? '99+' : r.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  plus: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  siteThumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.primarySoft },
  siteThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  preview: { fontSize: 14, color: colors.muted, marginTop: 2 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  meta: { alignItems: 'flex-end', gap: 6, minWidth: 40 },
  time: { fontSize: 12, color: colors.muted },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, padding: 40, marginTop: 40 },
  emptyText: { textAlign: 'center', color: colors.muted, fontSize: 15, lineHeight: 21 },
});
