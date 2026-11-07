/** PIN i pavlefshëm = jo 6 shifra. Çdo PIN 6-shifror lejohet (edhe 111111, 123456), sipas kërkesës së pronarit. */
export function isWeakPin(pin: string): boolean {
  return !/^\d{6}$/.test(pin);
}

/** Gjeneron një PIN të rastësishëm 6-shifror që nuk është i dobët. `rand` jep një numër të plotë 0..2^32-1. */
export function generatePin(rand: () => number): string {
  for (let i = 0; i < 100; i++) {
    const pin = String(rand() % 1_000_000).padStart(6, '0');
    if (!isWeakPin(pin)) return pin;
  }
  return '482915';
}

/** Numri personal: shkronja/shifra, 1-12 karaktere. */
export const isValidPersonnelNo = (s: string): boolean => /^[A-Za-z0-9]{1,12}$/.test(s);
