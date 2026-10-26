import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/state/session';
import { colors } from '../../src/ui/theme';

const icon = (glyph: string) => () => <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export default function AppLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { loading, session, employee } = useSession();
  if (!loading && (!session || !employee)) return <Redirect href="/login" />;

  // Pronari sheh ekranet e zyrës, punëtori ekranet e veta. Siguria e vërtetë është te RLS në databazë.
  const isAdmin = employee?.role === 'admin';
  const workerOnly = isAdmin ? { href: null } : {};
  const adminOnly = isAdmin ? {} : { href: null };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        tabBarIconStyle: { marginTop: 4 },
        tabBarItemStyle: { paddingVertical: 4, minWidth: 0 },
        tabBarStyle: { height: 68 + insets.bottom, paddingBottom: insets.bottom },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabToday'), tabBarIcon: icon('⏱'), ...workerOnly }} />
      <Tabs.Screen name="hours" options={{ title: t('tabHours'), tabBarIcon: icon('📋'), ...workerOnly }} />
      <Tabs.Screen name="team" options={{ title: t('adminTabNow'), tabBarIcon: icon('👷'), ...adminOnly }} />
      <Tabs.Screen
        name="admin-hours"
        options={{ title: t('adminTabHours'), tabBarIcon: icon('📋'), ...adminOnly }}
      />
      <Tabs.Screen name="report" options={{ title: t('tabMonth'), tabBarIcon: icon('🗓'), ...adminOnly }} />
      <Tabs.Screen name="sites" options={{ title: t('sitesTitle'), tabBarIcon: icon('📍'), ...adminOnly }} />
      <Tabs.Screen name="staff" options={{ title: t('tabStaff'), tabBarIcon: icon('👥'), ...adminOnly }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
