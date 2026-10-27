import { Stack } from 'expo-router/js-stack';
import { blurActiveElement } from '../../../src/ui/blurActive';

// Chat-i është një tab i fshehur: footer-i mbetet i dukshëm. Rrëshqitja për t'u kthyer mbrapa është te çdo ekran (useSwipeBack),
// gjesti i vetë stack-ut është fikur që të mos kthehet dy herë.
export default function ChatLayout() {
  return (
    <Stack
      screenListeners={{ blur: blurActiveElement, transitionStart: blurActiveElement }} 
      screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }}
    />
  );
}
