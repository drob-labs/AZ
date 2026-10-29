import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
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
  const { loading, session, employee, demo } = useSession();
  const router = useRouter();
  // Brenda chat-it rrëshqitja majtas nuk hap chat-in përsëri (aty rrëshqitja djathtas kthen mbrapa).
  const inChat = useRef(false);
  inChat.current = usePathname().startsWith('/chat');

  // Rrëshqitja me gisht nga e djathta në të majtë (kryesisht horizontale) hap mesazhet.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dx < -16 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
        onPanResponderRelease: (_e, g) => {
          if (!inChat.current && g.dx < -90 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5) router.push('/chat');
        },
      }),
    [router],
  );

  if (!loading && ((!session && !demo) || !employee)) return <Redirect href="/login" />;

  // Pronari sheh ekranet e zyrës, punëtori ekranet e veta. Siguria e vërtetë është te RLS në databazë.
  const isAdmin = employee?.role === 'admin';
  const workerOnly = isAdmin ? { href: null } : {};
  const adminOnly = isAdmin ? {} : { href: null };

  return (
    <View style={{ flex: 1 }} {...swipe.panHandlers}>
      <Tabs
        // Kthimi mbrapa të çon te tab-i ku ishe (p.sh. nga chat-i te Kryefaqja), jo gjithmonë te i pari.
      backBehavior="history"
      screenOptions={{
          header: () => <AppHeader />,
          animation: 'fade',
          transitionSpec: { animation: 'timing', config: { duration: 180 } },
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
        <Tabs.Screen name="team" options={{ title: t('tabHome'), tabBarIcon: tabIcon('hardHat'), ...adminOnly }} />
        <Tabs.Screen name="admin-hours" options={{ title: t('adminTabHours'), tabBarIcon: tabIcon('clock'), ...adminOnly }} />
        <Tabs.Screen name="report" options={{ title: t('tabMonth'), tabBarIcon: tabIcon('calendarBlank'), ...adminOnly }} />
        <Tabs.Screen name="staff" options={{ title: t('tabStaff'), tabBarIcon: tabIcon('usersThree'), ...adminOnly }} />
        <Tabs.Screen name="appointments" options={{ title: t('appointmentsTitle'), tabBarIcon: tabIcon('calendarCheck'), ...adminOnly }} />
        {/* Chat-i: tab i fshehur (pa buton në footer) që footer-i të mbetet i dukshëm. display: none heq edhe vendin e butonit. */}
        <Tabs.Screen
          name="chat"
          options={{
            title: t('chatsTitle'),
            headerShown: false,
            tabBarHideOnKeyboard: true,
            popToTopOnBlur: true,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: tabIcon('userCircle'), popToTopOnBlur: true }} />
      </Tabs>
    </View>
  );
}
