import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/state/session';
import { AppHeader } from '../../src/ui/AppHeader';
import { colors } from '../../src/ui/theme';

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
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 0 },
        tabBarItemStyle: { justifyContent: 'center', minWidth: 0 },
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabToday'), ...workerOnly }} />
      <Tabs.Screen name="hours" options={{ title: t('tabHours'), ...workerOnly }} />
      <Tabs.Screen name="team" options={{ title: t('adminTabNow'), ...adminOnly }} />
      <Tabs.Screen name="admin-hours" options={{ title: t('adminTabHours'), ...adminOnly }} />
      <Tabs.Screen name="report" options={{ title: t('tabMonth'), ...adminOnly }} />
      <Tabs.Screen name="sites" options={{ title: t('sitesTitle'), ...adminOnly }} />
      <Tabs.Screen name="staff" options={{ title: t('tabStaff'), ...adminOnly }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile') }} />
    </Tabs>
  );
}
