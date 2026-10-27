import { useNavigation, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Element i vogël para titullit (foto ose avatar). */
  leading?: ReactNode;
  /** Veprim djathtas (p.sh. mesazh i ri). */
  right?: ReactNode;
}

/** Koka e faqeve të chat-it: buton mbrapa, titull dhe veprim opsional. */
export function ChatHeader({ title, subtitle, leading, right }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/'))}
        style={styles.back}
        accessibilityRole="button"
        hitSlop={10}
      >
        <Icon name="caretLeft" color={colors.primary} size={24} />
      </Pressable>
      {leading}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
