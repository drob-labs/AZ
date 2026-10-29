import type { Employee } from '../state/session';
import type { Site } from '../state/tracker';
import type { Shift } from '../core/types';
import { berlinParts } from '../core/berlin';

/** Modaliteti Demo (për Apple App Review dhe kureshtarët): të dhëna shembull, pa server dhe pa ruajtje. */
export const DEMO_EMPLOYEE: Employee = {
  id: 'demo-employee',
  personnel_no: 'demo',
  first_name: 'Max',
  last_name: 'Mustermann',
  role: 'worker',
  locale: 'de',
  avatar_path: null,
};

export const DEMO_SITES: Site[] = [
  { id: 'demo-site-1', name: 'Neubau Ludwigsburg, Hauptstraße 12', address: 'Hauptstraße 12, 71634 Ludwigsburg' },
  { id: 'demo-site-2', name: 'Büro Stuttgart, Königstraße 5', address: 'Königstraße 5, 70173 Stuttgart' },
];

/** Turnet e ditëve të mëparshme të punës në muajin aktual. */
export function demoShifts(nowIso: string): Shift[] {
  const out: Shift[] = [];
  const month = berlinParts(nowIso).date.slice(0, 7);
  const now = new Date(nowIso);
  for (let back = 1, n = 0; back <= 14 && n < 6; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, 6, 0));
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const startedAt = d.toISOString();
    if (!berlinParts(startedAt).date.startsWith(month)) continue;
    n++;
    const end = new Date(d.getTime() + (8.5 + (n % 2) * 0.5) * 3600_000).toISOString();
    const breakStart = new Date(d.getTime() + 4 * 3600_000);
    out.push({
      id: `demo-shift-${back}`,
      employeeId: DEMO_EMPLOYEE.id,
      startedAt,
      endedAt: end,
      siteName: DEMO_SITES[n % 2].name,
      breaks: [{ startedAt: breakStart.toISOString(), endedAt: new Date(breakStart.getTime() + 30 * 60_000).toISOString() }],
    });
  }
  return out;
}
