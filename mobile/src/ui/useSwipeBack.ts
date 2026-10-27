import { useNavigation, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { PanResponder } from 'react-native';

/**
 * Rrëshqitja me gisht nga e majta në të djathtë (kryesisht horizontale) kthen mbrapa.
 * Përdor navigimin e vetë ekranit: kështu fillimisht del nga stack-u ku je (p.sh. nga biseda te lista)
 * dhe vetëm pastaj kthehet te tab-i i mëparshëm.
 */
export function useSwipeBack() {
  const navigation = useNavigation();
  const router = useRouter();
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dx > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 90 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5) {
            if (navigation.canGoBack()) navigation.goBack();
            else router.replace('/');
          }
        },
      }).panHandlers,
    [navigation, router],
  );
}
