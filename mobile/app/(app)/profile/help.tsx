import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../../src/i18n';
import { HELP } from '../../../src/i18n/help';
import { useSession } from '../../../src/state/session';
import { Icon } from '../../../src/ui/Icon';
import { colors } from '../../../src/ui/theme';

export default function Help() {
  const { t, locale } = useI18n();
  const { employee } = useSession();
  const [open, setOpen] = useState<string | null>(null);

  const content = HELP[locale];
  // Pronari sheh udhëzimet e zyrës dhe ato të përbashkëta; punëtori ato të punëtorit dhe të përbashkëtat.
  const sections = [...(employee?.role === 'admin' ? content.admin : content.worker), ...content.common];

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="lifebuoy" color="#fff" size={26} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t('helpCenter')}</Text>
            <Text style={styles.heroSub}>{t('helpCenterSub')}</Text>
          </View>
        </View>

        {sections.map((section, si) => (
          <View key={section.title} style={{ gap: 6 }}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, ii) => {
                const key = `${si}-${ii}`;
                const isOpen = open === key;
                return (
                  <View key={key}>
                    {ii > 0 && <View style={styles.sep} />}
                    <Pressable
                      style={styles.q}
                      onPress={() => setOpen(isOpen ? null : key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <Text style={styles.qText}>{item.q}</Text>
                      <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}>
                        <Icon name="caretRight" color={colors.muted} size={16} />
                      </View>
                    </Pressable>
                    {isOpen && <Text style={styles.a}>{item.a}</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 18, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: 18, padding: 16 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 14, color: '#DCEFE5', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: colors.border },
  q: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  qText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  a: { fontSize: 15, lineHeight: 22, color: colors.muted, paddingHorizontal: 14, paddingBottom: 14 },
});
