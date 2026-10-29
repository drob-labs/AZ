import { Stack } from 'expo-router/js-stack';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../src/i18n';
import { blurActiveElement } from '../src/ui/blurActive';
import { ChatProvider } from '../src/state/chat';
import { SessionProvider } from '../src/state/session';
import { TrackerProvider } from '../src/state/tracker';

export default function RootLayout() {
  return (
    <I18nProvider>
      <SessionProvider>
        <TrackerProvider>
          <ChatProvider>
            <StatusBar style="dark" />
            <Stack
              screenListeners={{ blur: blurActiveElement, transitionStart: blurActiveElement }} 
              screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
            >
              <Stack.Screen name="index" options={{ animation: 'none' }} />
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
              <Stack.Screen name="info" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
            </Stack>
          </ChatProvider>
        </TrackerProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
