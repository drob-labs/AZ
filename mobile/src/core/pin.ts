/** PIN-et e dobëta që nuk lejohen: të gjitha shifrat njësoj, vargje në rritje/rënie dhe disa të njohura. */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  if (up || down) return true;
  return ['123123', '121212', '112233', '654321', '000000', '123321'].includes(pin);
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
