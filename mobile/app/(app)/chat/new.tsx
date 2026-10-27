import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../../../src/i18n';
import { openDm } from '../../../src/lib/chat';
import { useChat } from '../../../src/state/chat';
import { useSession } from '../../../src/state/session';
import { Avatar } from '../../../src/ui/Avatar';
import { ChatHeader } from '../../../src/ui/ChatHeader';
import { useSwipeBack } from '../../../src/ui/useSwipeBack';
import { colors } from '../../../src/ui/theme';

export default function NewChat() {
  const { t } = useI18n();
  const swipeBack = useSwipeBack();
  const router = useRouter();
  const { employee } = useSession();
  const { people, refresh } = useChat();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...people.values()]
      .filter((p) => p.active && p.id !== employee?.id)
      // Pronari i pari, pastaj sipas mbiemrit.
      .sort((a, b) => (a.role === b.role ? a.last_name.localeCompare(b.last_name, 'de') : a.role === 'admin' ? -1 : 1))
      .filter((p) => !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q));
  }, [people, employee?.id, query]);

  async function pick(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const roomId = await openDm(id);
      await refresh();
      router.replace(`/chat/${roomId}`);
    } catch {
      setError(t('genericFail'));
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen} {...swipeBack}>
      <ChatHeader title={t('chatPickPerson')} />
      <View style={styles.searchBox}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchEmployee')}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('chatNoPeople')}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => pick(item.id)} accessibilityRole="button">
            <Avatar path={item.avatar_path} first={item.first_name} last={item.last_name} size={46} />
            <Text style={styles.name}>
              {item.first_name} {item.last_name}
            </Text>
            {item.role === 'admin' ? (
              <View style={styles.role}>
                <Text style={styles.roleText}>{t('roleAdmin')}</Text>
              </View>
            ) : null}
            {busyId === item.id ? <ActivityIndicator /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchBox: { padding: 12 },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  role: { backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 15 },
  error: { color: colors.stop, textAlign: 'center', paddingBottom: 8 },
});
