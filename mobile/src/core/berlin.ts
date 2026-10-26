const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface BerlinParts {
  /** YYYY-MM-DD në orën e Berlinit */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function berlinParts(iso: string): BerlinParts {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(iso))) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** "HH:MM" në orën e Berlinit për një kohë ISO. */
export function berlinHhmm(iso: string): string {
  const p = berlinParts(iso);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export const isValidHhmm = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Data + ora e Berlinit (p.sh. "2026-03-29", "03:30") → kohë ISO në UTC. */
export function berlinLocalToIso(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, m);
  let guess = wanted;
  // Dy kalime mjaftojnë për të kapur ndryshimin veror/dimëror.
  for (let i = 0; i < 2; i++) {
    const p = berlinParts(new Date(guess).toISOString());
    guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(guess).toISOString();
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}

/** 0 = e diel ... 6 = e shtunë, për një datë YYYY-MM-DD. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Çelësi i javës ISO (e hëna si fillim), p.sh. "2026-W44". */
export function isoWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
