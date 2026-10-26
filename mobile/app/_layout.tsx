import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../src/i18n';
import { SessionProvider } from '../src/state/session';
import { TrackerProvider } from '../src/state/tracker';

export default function RootLayout() {
  return (
    <I18nProvider>
      <SessionProvider>
        <TrackerProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </TrackerProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
