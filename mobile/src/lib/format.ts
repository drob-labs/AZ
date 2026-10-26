import { berlinParts, weekday } from '../core/berlin';

const DAY_NAMES = {
  sq: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'],
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
};

/** "Hën 26.10." sipas gjuhës; Intl nuk e ka shqipen në çdo pajisje, prandaj emrat janë këtu. */
export function formatDay(iso: string, locale: 'sq' | 'de'): string {
  const { date, day, month } = berlinParts(iso);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${DAY_NAMES[locale][weekday(date)]} ${dd}.${mm}.`;
}

const timeFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatTime = (iso: string): string => timeFmt.format(new Date(iso));

/** 495 → "8:15" */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Për kohëmatësin: "08:15:32" */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
