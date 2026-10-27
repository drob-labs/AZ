import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useChat } from '../state/chat';
import { Icon } from './Icon';
import { colors, serif } from './theme';

const mark = require('../../assets/logo-mark.png');
const MARK_RATIO = 410 / 270;

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { unreadTotal } = useChat();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Image source={mark} style={styles.mark} resizeMode="contain" accessibilityLabel="AZ" />
      <View style={styles.rule} />
      <Text style={styles.name} numberOfLines={1}>
        Trockenbau & Innenausbau
      </Text>
      <Pressable
        onPress={() => router.push('/chat')}
        style={styles.chat}
        accessibilityRole="button"
        accessibilityLabel={t('chatsTitle')}
        hitSlop={8}
      >
        <Icon name="paperPlaneTilt" color={colors.text} size={28} />
        {unreadTotal > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mark: { height: 40, width: 40 * MARK_RATIO },
  rule: { width: 1, height: 26, backgroundColor: colors.border },
  name: { flex: 1, fontFamily: serif, fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: 0.2 },
  chat: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.stop,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
