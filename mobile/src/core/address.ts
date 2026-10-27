export interface AddressParts {
  street: string;
  postalCode: string;
  city: string;
}

/** "Königstraße 1, 70173 Stuttgart". Pjesët e zbrazëta anashkalohen: nuk lihen presje ose hapësira të tepërta. */
export function formatAddress({ street, postalCode, city }: AddressParts): string {
  const place = [postalCode.trim(), city.trim()].filter(Boolean).join(' ');
  return [street.trim(), place].filter(Boolean).join(', ');
}

/**
 * Ndan një adresë të vjetër të shkruar lirisht ("Rruga 1, 70173 Stuttgart") në pjesë, që të plotësohen fushat kur hapet
 * një Baustelle ekzistuese. Nëse formati nuk njihet, e gjithë teksti futet te rruga që të mos humbasë asgjë.
 */
export function parseAddress(address: string | null | undefined): AddressParts {
  const text = (address ?? '').trim();
  if (!text) return { street: '', postalCode: '', city: '' };
  const m = /^(.*?),\s*(\d{5})\s+(.+)$/.exec(text);
  if (m) return { street: m[1].trim(), postalCode: m[2], city: m[3].trim() };
  return { street: text, postalCode: '', city: '' };
}

/** Kodi postar gjerman: saktësisht 5 shifra (ose bosh). */
export const isValidPostalCode = (s: string): boolean => s === '' || /^\d{5}$/.test(s);
