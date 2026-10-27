import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/js-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../../src/i18n';
import { blurActiveElement } from '../../../src/ui/blurActive';
import { colors } from '../../../src/ui/theme';

// Baustelle dhe Termine hapen brenda tab-it Profili, kështu tab bar-i mbetet gjithmonë i dukshëm.
function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={styles.chevron}>‹</Text>
        <Text style={styles.backText}>{t('tabProfile')}</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export default function ProfileLayout() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Stack
      screenListeners={{ blur: blurActiveElement, transitionStart: blurActiveElement }} 
      screenOptions={{ animation: 'slide_from_right', headerMode: 'screen', header: ({ options, navigation }) => (
          <BackHeader
            title={String(options.title ?? '')}
            onBack={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/profile'))}
          />
        ) }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sites" options={{ title: t('sitesTitle') }} />
      <Stack.Screen name="help" options={{ title: t('helpCenter') }} />
      <Stack.Screen name="routine" options={{ title: t('routineTitle') }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8 },
  chevron: { fontSize: 32, lineHeight: 34, color: colors.primary, marginTop: -4 },
  backText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
});
