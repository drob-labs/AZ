import { berlinHhmm, berlinParts, weekday } from './berlin';
import { calculateMonth, rateOn } from './hours';
import { LOGO_DATA_URI } from './logoData';
import type { Rate, Settings, Shift, WarningCode } from './types';

export interface ReportEmployee {
  personnelNo: string;
  firstName: string;
  lastName: string;
  rates: Rate[];
  /** Turnet e muajit, plus ato të javëve që e prekin (për pragun javor). */
  shifts: Shift[];
}

export interface ReportInput {
  /** "2026-10" */
  month: string;
  company: string;
  employees: ReportEmployee[];
  settings: Settings;
  /** Koha e krijimit, ISO */
  generatedAt: string;
}

export const NO_SITE = '';

export interface ReportDay {
  date: string;
  site: string;
  start: string;
  end: string;
  breakMin: number;
  workedMin: number;
}

export interface ReportLine {
  personnelNo: string;
  name: string;
  firstName: string;
  lastName: string;
  workedMin: number;
  overtimeMin: number;
  breakMin: number;
  hourlyRateCents: number | null;
  grossCents: number;
  warnings: WarningCode[];
  days: ReportDay[];
  /** Orët shtesë për çdo datë (YYYY-MM-DD → minuta), për fletën e orëve. */
  overtimeByDate: Record<string, number>;
}

export interface Report {
  month: string;
  company: string;
  generatedAt: string;
  lines: ReportLine[];
  totals: { workedMin: number; overtimeMin: number; grossCents: number };
  /** Sa turne i përkasin muajit (sipas datës së Berlinit): përdoret nga close_month për kontroll. */
  shiftCount: number;
  openShiftCount: number;
  /** Orët sipas Baustelle-s ('' = pa Baustelle), më të shumtat sipër. */
  siteTotals: { site: string; workedMin: number }[];
}

export function buildReport(input: ReportInput): Report {
  let shiftCount = 0;
  let openShiftCount = 0;

  const lines: ReportLine[] = input.employees.map((e) => {
    const r = calculateMonth(e.shifts, e.rates, input.settings, input.month);
    const inMonth = e.shifts.filter((s) => berlinParts(s.startedAt).date.startsWith(input.month));
    shiftCount += inMonth.length;
    openShiftCount += inMonth.filter((s) => !s.endedAt).length;

    const days: ReportDay[] = r.days
      .filter((d) => d.workedMin > 0 || d.grossMin > 0)
      .map((d) => {
        const s = e.shifts.find((x) => x.id === d.shiftId) as Shift;
        return {
          date: d.date,
          site: s.siteName ?? NO_SITE,
          start: berlinHhmm(s.startedAt),
          end: s.endedAt ? berlinHhmm(s.endedAt) : '',
          breakMin: d.breakMin,
          workedMin: d.workedMin,
        };
      });

    const lastDay = days.at(-1)?.date ?? `${input.month}-28`;
    return {
      personnelNo: e.personnelNo,
      name: `${e.lastName}, ${e.firstName}`,
      firstName: e.firstName,
      lastName: e.lastName,
      workedMin: r.workedMin,
      overtimeMin: r.overtimeMin,
      breakMin: days.reduce((sum, d) => sum + d.breakMin, 0),
      hourlyRateCents: rateOn(e.rates, lastDay),
      grossCents: r.grossCents,
      warnings: [...new Set(r.warnings.map((w) => w.code))],
      days,
      overtimeByDate: r.overtimeByDate,
    };
  });

  lines.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const bySite = new Map<string, number>();
  for (const l of lines) for (const d of l.days) bySite.set(d.site, (bySite.get(d.site) ?? 0) + d.workedMin);
  const siteTotals = [...bySite.entries()]
    .map(([site, workedMin]) => ({ site, workedMin }))
    .sort((a, b) => b.workedMin - a.workedMin || a.site.localeCompare(b.site, 'de'));

  return {
    month: input.month,
    company: input.company,
    generatedAt: input.generatedAt,
    lines,
    totals: {
      workedMin: lines.reduce((s, l) => s + l.workedMin, 0),
      overtimeMin: lines.reduce((s, l) => s + l.overtimeMin, 0),
      grossCents: lines.reduce((s, l) => s + l.grossCents, 0),
    },
    shiftCount,
    openShiftCount,
    siteTotals,
  };
}

export const hoursDecimal = (min: number): number => Math.round((min / 60) * 100) / 100;
export const euros = (cents: number): number => cents / 100;

const OHNE_BAUSTELLE = 'ohne Baustelle';

export const germanDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

const WARNING_DE: Record<WarningCode, string> = {
  OPEN_SHIFT: 'Offene Schicht',
  DAILY_OVER_10H: 'Mehr als 10 Std. an einem Tag',
  BREAK_TOO_SHORT: 'Pause zu kurz',
  SUNDAY_WORK: 'Sonntagsarbeit',
  HOLIDAY_WORK: 'Feiertagsarbeit',
  REST_UNDER_11H: 'Ruhezeit unter 11 Std.',
  BELOW_MIN_WAGE: 'Stundenlohn unter Mindestlohn',
  NO_RATE: 'Kein Stundenlohn hinterlegt',
};

/** Rreshtat e Excel-it: dy fletë, me numra të vërtetë që mblidhen në Excel. */
export function excelSheets(report: Report): { name: string; rows: (string | number)[][] }[] {
  const summary: (string | number)[][] = [
    ['Benutzername', 'Name', 'Arbeitszeit (Std.)', 'davon Überstunden (Std.)', 'Pausen (Std.)', 'Stundenlohn (€)', 'Brutto (€)', 'Hinweise'],
    ...report.lines.map((l) => [
      l.personnelNo,
      l.name,
      hoursDecimal(l.workedMin),
      hoursDecimal(l.overtimeMin),
      hoursDecimal(l.breakMin),
      l.hourlyRateCents === null ? '' : euros(l.hourlyRateCents),
      euros(l.grossCents),
      l.warnings.map((w) => WARNING_DE[w]).join('; '),
    ]),
    [
      '',
      'Summe',
      hoursDecimal(report.totals.workedMin),
      hoursDecimal(report.totals.overtimeMin),
      '',
      '',
      euros(report.totals.grossCents),
      '',
    ],
  ];

  const detail: (string | number)[][] = [
    ['Benutzername', 'Name', 'Datum', 'Baustelle', 'Beginn', 'Ende', 'Pause (Min.)', 'Arbeitszeit (Std.)'],
    ...report.lines.flatMap((l) =>
      l.days.map((d) => [
        l.personnelNo,
        l.name,
        germanDate(d.date),
        d.site || OHNE_BAUSTELLE,
        d.start,
        d.end,
        d.breakMin,
        hoursDecimal(d.workedMin),
      ]),
    ),
  ];

  const sites: (string | number)[][] = [
    ['Baustelle', 'Arbeitszeit (Std.)'],
    ...report.siteTotals.map((s) => [s.site || OHNE_BAUSTELLE, hoursDecimal(s.workedMin)]),
    ['Summe', hoursDecimal(report.totals.workedMin)],
  ];

  return [
    { name: 'Zusammenfassung', rows: summary },
    { name: 'Einzelnachweis', rows: detail },
    { name: 'Baustellen', rows: sites },
  ];
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtH = (min: number): string => hoursDecimal(min).toFixed(2).replace('.', ',');
const fmtEur = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function monthTitleDe(month: string): string {
  return `${MONTHS_DE[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** HTML për PDF (expo-print) ose shtypje. Gjermanisht, sepse e lexon Steuerberater-i. Stil zyrtar, me logon e AZ. */
export function reportHtml(report: Report): string {
  const withHours = report.lines.filter((l) => l.workedMin > 0).length;
  const totalMin = report.totals.workedMin;

  const rows = report.lines
    .map(
      (l) => `<tr>
<td>${esc(l.personnelNo)}</td><td>${esc(l.name)}</td>
<td class="n">${fmtH(l.workedMin)}</td><td class="n">${l.overtimeMin > 0 ? fmtH(l.overtimeMin) : '–'}</td>
<td class="n">${l.hourlyRateCents === null ? '–' : fmtEur(l.hourlyRateCents)}</td>
<td class="n">${fmtEur(l.grossCents)}</td>
<td class="hint">${esc(l.warnings.map((w) => WARNING_DE[w]).join('; '))}</td></tr>`,
    )
    .join('\n');

  const sites = report.siteTotals
    .map(
      (s) => `<tr><td>${esc(s.site || OHNE_BAUSTELLE)}</td>
<td class="n">${totalMin > 0 ? Math.round((s.workedMin / totalMin) * 1000) / 10 : 0}</td>
<td class="n">${fmtH(s.workedMin)}</td></tr>`,
    )
    .join('\n');

  const details = report.lines
    .filter((l) => l.days.length > 0)
    .map(
      (l) => `<section class="emp">
<div class="emphead"><b>${esc(l.name)}</b><span>Benutzername: ${esc(l.personnelNo)}</span>
<span class="sum">Arbeitszeit ${fmtH(l.workedMin)} Std. · davon Überstunden ${fmtH(l.overtimeMin)} Std. · Brutto ${fmtEur(l.grossCents)} €</span></div>
<table class="d"><thead><tr><th>Datum</th><th>Baustelle</th><th class="c">Beginn</th><th class="c">Ende</th><th class="n">Pause (Min.)</th><th class="n">Arbeitszeit (Std.)</th></tr></thead><tbody>
${l.days
  .map(
    (d) =>
      `<tr><td>${WEEKDAYS_DE[weekday(d.date)]}, ${germanDate(d.date)}</td><td>${esc(d.site || OHNE_BAUSTELLE)}</td><td class="c">${d.start}</td><td class="c">${d.end}</td><td class="n">${d.breakMin}</td><td class="n">${fmtH(d.workedMin)}</td></tr>`,
  )
  .join('\n')}
</tbody></table></section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Stundenabrechnung ${esc(monthTitleDe(report.month))}</title>
<style>
  :root { --ink: #111; --rule: #222; --grid: #8a8f8c; --head: #E7EAE8; --green: #2C7A5A; --muted: #4a524e; }
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: var(--ink); margin: 0; line-height: 1.35; }
  @media screen { body { max-width: 180mm; margin: 0 auto; padding: 8mm 0; } }
  .top { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 8px; border-bottom: 1.5px solid var(--rule); }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 15mm; }
  .brand .co { font-family: Georgia, 'Times New Roman', serif; font-weight: bold; font-size: 11.5pt; }
  .brand .co small { display: block; font-family: Arial, sans-serif; font-weight: normal; font-size: 8pt; color: var(--muted); margin-top: 1px; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 15pt; text-transform: uppercase; letter-spacing: 1.2px; }
  .title div { margin-top: 2px; color: var(--muted); font-size: 9pt; }
  .accent { height: 3px; background: var(--green); margin-top: 2px; }
  table.meta { margin: 12px 0 4px; }
  table.meta td { border: 0.5px solid var(--grid); padding: 4px 8px; }
  table.meta td.k { width: 34mm; background: var(--head); font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
  h2 { font-size: 10pt; margin: 16px 0 5px; padding-bottom: 2px; border-bottom: 0.75px solid var(--rule); page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 0.5px solid var(--grid); padding: 3.5px 6px; text-align: left; vertical-align: top; }
  thead th { background: var(--head); font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4px; font-weight: bold; vertical-align: bottom; }
  tfoot td { background: var(--head); font-weight: bold; border-top: 1.5px solid var(--rule); }
  .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .c { text-align: center; font-variant-numeric: tabular-nums; }
  .hint { font-size: 7.5pt; color: var(--muted); }
  .note { margin: 5px 0 0; color: var(--muted); font-size: 7.5pt; }
  .details { page-break-before: always; }
  .emp { margin-bottom: 14px; page-break-inside: avoid; }
  .emphead { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; padding: 3px 0 4px; }
  .emphead b { font-size: 10pt; }
  .emphead span { color: var(--muted); font-size: 8pt; }
  .emphead .sum { margin-left: auto; color: var(--ink); }
  table.d th, table.d td { padding: 2.5px 6px; font-size: 8.5pt; }
  tr { page-break-inside: avoid; }
  .sign { display: flex; gap: 16mm; margin-top: 16mm; page-break-inside: avoid; }
  .sign div { flex: 1; border-top: 0.75px solid var(--rule); padding-top: 3px; font-size: 7.5pt; color: var(--muted); }
  .foot { margin-top: 10px; font-size: 7pt; color: var(--muted); }
</style></head><body>
<div class="top">
  <div class="brand"><img src="${LOGO_DATA_URI}" alt="AZ"><div class="co">${esc(report.company)}<small>Ludwigsburg</small></div></div>
  <div class="title"><h1>Stundenabrechnung</h1><div>Berichtszeitraum: ${esc(monthTitleDe(report.month))}</div></div>
</div>
<div class="accent"></div>

<table class="meta">
  <tr><td class="k">Arbeitgeber</td><td>${esc(report.company)}</td><td class="k">Berichtszeitraum</td><td>${esc(monthTitleDe(report.month))}</td></tr>
  <tr><td class="k">Erstellt am</td><td>${germanDate(report.generatedAt.slice(0, 10))}</td><td class="k">Mitarbeiter mit Stunden</td><td>${withHours} von ${report.lines.length}</td></tr>
</table>

<h2>1. Übersicht je Mitarbeiter</h2>
<table><thead><tr><th>Benutzername</th><th>Name</th><th class="n">Arbeitszeit (Std.)</th><th class="n">davon Überstd.</th><th class="n">Stundenlohn (€)</th><th class="n">Brutto (€)</th><th>Hinweise</th></tr></thead>
<tbody>
${rows}
</tbody>
<tfoot><tr><td></td><td>Summe</td><td class="n">${fmtH(report.totals.workedMin)}</td><td class="n">${fmtH(report.totals.overtimeMin)}</td><td></td><td class="n">${fmtEur(report.totals.grossCents)}</td><td></td></tr></tfoot></table>
<p class="note">Brutto = Stunden × Stundenlohn (Überstunden mit Zuschlag). Ohne Steuern, Sozialabgaben, Zuschläge für Nacht-, Sonn- und Feiertagsarbeit und ohne SOKA-BAU.</p>

<h2>2. Stunden je Baustelle</h2>
<table class="d"><thead><tr><th>Baustelle</th><th class="n">Anteil (%)</th><th class="n">Arbeitszeit (Std.)</th></tr></thead><tbody>
${sites}
</tbody>
<tfoot><tr><td>Summe</td><td class="n">${totalMin > 0 ? '100' : '0'}</td><td class="n">${fmtH(totalMin)}</td></tr></tfoot></table>

<div class="sign"><div>Ort, Datum, Unterschrift Geschäftsführung</div><div>Ort, Datum, Unterschrift Steuerberater / Lohnbuchhaltung</div></div>
<div class="foot">${esc(report.company)} · Stundenabrechnung ${esc(monthTitleDe(report.month))} · erstellt am ${germanDate(report.generatedAt.slice(0, 10))}</div>

${details ? `<div class="details"><h2>3. Einzelnachweise</h2>\n${details}</div>` : ''}
</body></html>`;
}
