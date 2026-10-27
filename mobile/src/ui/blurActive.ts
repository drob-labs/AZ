import { Platform } from 'react-native';

/**
 * Në web, kur një ekran mbulohet nga tjetri, shfletuesi e shënon me aria-hidden. Nëse një buton brenda tij mban ende fokusin
 * (p.sh. ai që sapo e shtype), Chrome shfaq paralajmërimin "Blocked aria-hidden ... retained focus". Heqim fokusin para kalimit.
 */
export function blurActiveElement(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  (document.activeElement as HTMLElement | null)?.blur?.();
}
