import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { berlinParts } from '../../../src/core/berlin';
import { buildChatItems, type ChatItem } from '../../../src/core/chatList';
import { useI18n } from '../../../src/i18n';
import { fetchMessages, markRead, MAX_LENGTH, PAGE_SIZE, reportMessage, sendMessage, type ChatMessage } from '../../../src/lib/chat';
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

const dayLabel = (date: string, today: string, todayText: string) =>
  date === today ? todayText : `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const swipeBack = useSwipeBack();
  const { employee } = useSession();
  const { overview, people, refresh, subscribe, blocked, block } = useChat();
  const [actionMsg, setActionMsg] = useState<{ id: string; sender_id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  const meId = employee?.id ?? '';
  const room = overview.find((r) => r.room_id === id);
  const isGroup = room?.kind === 'site';
  const other = room?.other_id ? people.get(room.other_id) : undefined;
  const title = isGroup ? (room?.site_name ?? '') : other ? `${other.first_name} ${other.last_name}` : '';
  const photo = sitePhotoUrl(room?.site_photo);

  const read = useCallback(() => {
    if (id) markRead(id).then(refresh);
  }, [id, refresh]);

  // Mesazhet e fundit, pastaj shënoje dhomën si të lexuar.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchMessages(id)
      .then((rows) => {
        if (!alive) return;
        setMessages(rows);
        setHasMore(rows.length === PAGE_SIZE);
        read();
      })
      .catch(() => alive && setError(t('genericFail')));
    return () => {
      alive = false;
    };
  }, [id, read, t]);

  // Mesazhet e reja në kohë reale.
  useEffect(
    () =>
      subscribe((m) => {
        if (m.room_id !== id) return;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [m, ...cur]));
        if (m.sender_id !== meId) read();
      }),
    [subscribe, id, meId, read],
  );

  async function loadOlder() {
    if (!id || !hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const rows = await fetchMessages(id, messages[messages.length - 1].created_at);
      setMessages((cur) => [...cur, ...rows.filter((r) => !cur.some((x) => x.id === r.id))]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      // provo përsëri kur të shkruhet përsëri te fundi i listës
    }
    setLoadingMore(false);
  }

  async function send() {
    const body = text.trim();
    if (!id || !body || sending || !meId) return;
    setSending(true);
    setError(null);
    setText('');
    try {
      const sent = await sendMessage(id, meId, body);
      setMessages((cur) => (cur.some((x) => x.id === sent.id) ? cur : [sent, ...cur]));
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      read();
    } catch {
      setText(body);
      setError(t('chatSendFailed'));
    }
    setSending(false);
  }

  const items = useMemo(
    () => buildChatItems(messages.filter((m) => !blocked.has(m.sender_id)), meId, !!isGroup),
    [messages, blocked, meId, isGroup],
  );

  async function act(kind: 'report' | 'block') {
    const m = actionMsg;
    setActionMsg(null);
    if (!m) return;
    try {
      if (kind === 'report') await reportMessage(m.id);
      else await block(m.sender_id);
      setNotice(t(kind === 'report' ? 'msgReported' : 'msgBlocked'));
    } catch {
      setNotice(t('msgFailed'));
    }
  }
  const today = berlinParts(nowIso()).date;

  const leading = isGroup ? (
    photo ? (
      <Image source={{ uri: photo }} style={styles.headPhoto} />
    ) : (
      <View style={[styles.headPhoto, styles.headPhotoEmpty]}>
        <Icon name="buildings" color={colors.primary} size={20} />
      </View>
    )
  ) : other ? (
    <Avatar path={other.avatar_path} first={other.first_name} last={other.last_name} size={36} />
  ) : null;

  return (
    <View style={styles.screen} {...swipeBack}>
      <ChatHeader title={title || '…'} subtitle={isGroup ? t('chatSiteGroup') : undefined} leading={leading} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={items}
          inverted
          keyExtractor={(i) => i.msg.id}
          contentContainerStyle={styles.list}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>{t('chatEmpty')}</Text>}
          renderItem={({ item }) => {
            const sender = people.get(item.msg.sender_id);
            return (
              <View>
                {item.dayHeader ? (
                  <View style={styles.dayWrap}>
                    <Text style={styles.day}>{dayLabel(item.dayHeader, today, t('chatToday'))}</Text>
                  </View>
                ) : null}
                {item.showName ? (
                  <Text style={styles.sender}>{sender ? `${sender.first_name} ${sender.last_name}` : '—'}</Text>
                ) : null}
                <View style={[styles.line, item.mine ? styles.lineMine : styles.lineOther, item.continued && { marginTop: 2 }]}>
                  <Pressable
                    onLongPress={() => !item.mine && setActionMsg({ id: item.msg.id, sender_id: item.msg.sender_id })}
                    delayLongPress={350}
                    style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}
                  >
                    <Text style={[styles.body, item.mine && { color: '#fff' }]}>{item.msg.body}</Text>
                    <Text style={[styles.time, item.mine && { color: '#CFE8DA' }]}>{formatTime(item.msg.created_at)}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <View style={[styles.inputBar, { paddingBottom: 8 }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('chatPlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={MAX_LENGTH}
            onKeyPress={(e) => {
              // Në web: Enter dërgon, Shift+Enter bën rresht të ri.
              const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                send();
              }
            }}
          />
          <Pressable
            style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={t('chatNew')}
          >
            <Icon name="paperPlaneTilt" color="#fff" size={22} filled />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!actionMsg} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.backdrop} onPress={() => setActionMsg(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Pressable style={styles.sheetRow} onPress={() => act('report')} accessibilityRole="button">
              <Text style={styles.sheetText}>{t('msgReport')}</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => act('block')} accessibilityRole="button">
              <Text style={[styles.sheetText, { color: colors.stop }]}>{t('msgBlock')}</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => setActionMsg(null)} accessibilityRole="button">
              <Text style={styles.sheetText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headPhoto: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primarySoft },
  headPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 15 },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  day: { fontSize: 12, fontWeight: '600', color: colors.muted, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, overflow: 'hidden' },
  sender: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 6, marginTop: 6, marginBottom: 2 },
  line: { flexDirection: 'row' },
  lineMine: { justifyContent: 'flex-end' },
  lineOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  body: { fontSize: 16, color: colors.text, lineHeight: 21 },
  time: { fontSize: 10, color: colors.muted, alignSelf: 'flex-end', marginTop: 2 },
  notice: { color: colors.primary, fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, padding: 12, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 },
  sheetRow: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  sheetText: { fontSize: 17, fontWeight: '600', color: colors.text },
  error: { color: colors.stop, fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
