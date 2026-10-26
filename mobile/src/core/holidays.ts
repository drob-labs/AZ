/** Festat zyrtare në Baden-Württemberg. */

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plusDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

const cache = new Map<number, Map<string, string>>();

export function holidaysBW(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const easter = easterSunday(year);
  const list: Array<[string, string]> = [
    [`${year}-01-01`, 'Neujahr'],
    [`${year}-01-06`, 'Heilige Drei Könige'],
    [iso(plusDays(easter, -2)), 'Karfreitag'],
    [iso(plusDays(easter, 1)), 'Ostermontag'],
    [`${year}-05-01`, 'Tag der Arbeit'],
    [iso(plusDays(easter, 39)), 'Christi Himmelfahrt'],
    [iso(plusDays(easter, 50)), 'Pfingstmontag'],
    [iso(plusDays(easter, 60)), 'Fronleichnam'],
    [`${year}-10-03`, 'Tag der Deutschen Einheit'],
    [`${year}-11-01`, 'Allerheiligen'],
    [`${year}-12-25`, '1. Weihnachtstag'],
    [`${year}-12-26`, '2. Weihnachtstag'],
  ];
  const map = new Map(list);
  cache.set(year, map);
  return map;
}

export function isHolidayBW(date: string): boolean {
  return holidaysBW(Number(date.slice(0, 4))).has(date);
}
