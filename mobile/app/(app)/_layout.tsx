import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { useSession } from '../../src/state/session';
import { Icon } from '../../src/ui/Icon';
import type { IconName } from '../../src/ui/iconPaths';
import { AppHeader } from '../../src/ui/AppHeader';
import { colors } from '../../src/ui/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Icon name={name} color={String(color)} size={24} filled={focused} />;
  };

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
        tabBarIconStyle: { marginTop: 2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, marginBottom: 4 },
        tabBarItemStyle: { paddingVertical: 4, minWidth: 0 },
        tabBarStyle: {
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabToday'), tabBarIcon: tabIcon('timer'), ...workerOnly }} />
      <Tabs.Screen name="hours" options={{ title: t('tabHours'), tabBarIcon: tabIcon('clock'), ...workerOnly }} />
      <Tabs.Screen name="team" options={{ title: t('adminTabNow'), tabBarIcon: tabIcon('hardHat'), ...adminOnly }} />
      <Tabs.Screen name="admin-hours" options={{ title: t('adminTabHours'), tabBarIcon: tabIcon('clock'), ...adminOnly }} />
      <Tabs.Screen name="report" options={{ title: t('tabMonth'), tabBarIcon: tabIcon('calendarBlank'), ...adminOnly }} />
      <Tabs.Screen name="sites" options={{ title: t('sitesTitle'), tabBarIcon: tabIcon('buildings'), href: null }} />
      <Tabs.Screen name="staff" options={{ title: t('tabStaff'), tabBarIcon: tabIcon('usersThree'), ...adminOnly }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: tabIcon('userCircle') }} />
    </Tabs>
  );
}
