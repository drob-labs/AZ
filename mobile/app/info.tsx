import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';
import { HELP } from '../src/i18n/help';
import { PRIVACY_URL, SUPPORT_EMAIL } from '../src/lib/config';
import { useSession } from '../src/state/session';
import { Logo } from '../src/ui/Logo';
import { colors } from '../src/ui/theme';

/** Faqe publike (pa kyçje): çfarë është aplikacioni, kush e përdor dhe si përdoret. */
export default function Info() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { startDemo } = useSession();
  const faq = HELP[locale].worker;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.close}>‹ {t('loginTitle')}</Text>
        </Pressable>
        <Text style={styles.barTitle}>{t('infoTitle')}</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Logo height={90} />
        <Text style={styles.brand}>{t('appName')}</Text>

        <Block title={t('infoWhatTitle')} text={t('infoWhat')} />
        <Block title={t('infoAccountTitle')} text={t('infoAccount')} />
        <Block title={t('infoHowTitle')} text={t('infoSteps')} />

        {faq.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <View key={item.q} style={{ gap: 2 }}>
                <Text style={styles.q}>{item.q}</Text>
                <Text style={styles.text}>{item.a}</Text>
              </View>
            ))}
          </View>
        ))}

        <Pressable
          style={styles.demo}
          onPress={() => {
            startDemo();
            router.replace('/');
          }}
          accessibilityRole="button"
        >
          <Text style={styles.demoText}>{t('demoButton')}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('infoContact')}</Text>
          <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} accessibilityRole="link">
            <Text style={styles.link}>{SUPPORT_EMAIL}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
            <Text style={styles.link}>{t('privacy')}</Text>
          </Pressable>
          <Text style={styles.text}>AZ Trockenbau & Innenausbau · Ludwigsburg</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  close: { fontSize: 17, color: colors.primary, fontWeight: '600', width: 90 },
  barTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  brand: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  q: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 4 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  demo: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  demoText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
