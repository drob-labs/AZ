import { berlinHhmm, berlinParts } from './berlin';
import { calculateMonth, rateOn } from './hours';
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
  workedMin: number;
  overtimeMin: number;
  breakMin: number;
  hourlyRateCents: number | null;
  grossCents: number;
  warnings: WarningCode[];
  days: ReportDay[];
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
      workedMin: r.workedMin,
      overtimeMin: r.overtimeMin,
      breakMin: days.reduce((sum, d) => sum + d.breakMin, 0),
      hourlyRateCents: rateOn(e.rates, lastDay),
      grossCents: r.grossCents,
      warnings: [...new Set(r.warnings.map((w) => w.code))],
      days,
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

const germanDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

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
    ['Personal-Nr.', 'Name', 'Arbeitszeit (Std.)', 'davon Überstunden (Std.)', 'Pausen (Std.)', 'Stundenlohn (€)', 'Brutto (€)', 'Hinweise'],
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
    ['Personal-Nr.', 'Name', 'Datum', 'Baustelle', 'Beginn', 'Ende', 'Pause (Min.)', 'Arbeitszeit (Std.)'],
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

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtH = (min: number): string => hoursDecimal(min).toFixed(2).replace('.', ',');
const fmtEur = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function monthTitleDe(month: string): string {
  return `${MONTHS_DE[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** HTML për PDF (expo-print) ose shtypje. Gjermanisht, sepse e lexon Steuerberater-i. */
export function reportHtml(report: Report): string {
  const rows = report.lines
    .map(
      (l) => `<tr>
<td>${esc(l.personnelNo)}</td><td>${esc(l.name)}</td>
<td class="n">${fmtH(l.workedMin)}</td><td class="n">${fmtH(l.overtimeMin)}</td>
<td class="n">${l.hourlyRateCents === null ? '–' : fmtEur(l.hourlyRateCents)}</td>
<td class="n">${fmtEur(l.grossCents)}</td>
<td class="w">${esc(l.warnings.map((w) => WARNING_DE[w]).join('; '))}</td></tr>`,
    )
    .join('\n');

  const details = report.lines
    .filter((l) => l.days.length > 0)
    .map(
      (l) => `<h2>${esc(l.name)} (${esc(l.personnelNo)})</h2>
<table class="d"><thead><tr><th>Datum</th><th>Baustelle</th><th>Beginn</th><th>Ende</th><th class="n">Pause (Min.)</th><th class="n">Arbeitszeit (Std.)</th></tr></thead><tbody>
${l.days
  .map(
    (d) =>
      `<tr><td>${germanDate(d.date)}</td><td>${esc(d.site || OHNE_BAUSTELLE)}</td><td>${d.start}</td><td>${d.end}</td><td class="n">${d.breakMin}</td><td class="n">${fmtH(d.workedMin)}</td></tr>`,
  )
  .join('\n')}
</tbody></table>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Stundenabrechnung ${esc(monthTitleDe(report.month))}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  h2 { font-size: 11pt; margin: 18px 0 6px; page-break-after: avoid; }
  .meta { color: #555; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  .w { color: #92400e; font-size: 9pt; }
  tfoot td { font-weight: bold; background: #f6f6f6; }
  .note { margin-top: 12px; color: #555; font-size: 9pt; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>Stundenabrechnung ${esc(monthTitleDe(report.month))}</h1>
<div class="meta">${esc(report.company)} · erstellt am ${germanDate(report.generatedAt.slice(0, 10))}</div>
<table><thead><tr><th>Pers.-Nr.</th><th>Name</th><th class="n">Std.</th><th class="n">davon Überstd.</th><th class="n">Stundenlohn (€)</th><th class="n">Brutto (€)</th><th>Hinweise</th></tr></thead>
<tbody>
${rows}
</tbody>
<tfoot><tr><td></td><td>Summe</td><td class="n">${fmtH(report.totals.workedMin)}</td><td class="n">${fmtH(report.totals.overtimeMin)}</td><td></td><td class="n">${fmtEur(report.totals.grossCents)}</td><td></td></tr></tfoot></table>
<p class="note">Brutto = Stunden × Stundenlohn (Überstunden mit Zuschlag). Ohne Steuern, Sozialabgaben, Zuschläge für Nacht-, Sonn- und Feiertagsarbeit und ohne SOKA-BAU.</p>
<h2>Stunden je Baustelle</h2>
<table class="d"><thead><tr><th>Baustelle</th><th class="n">Arbeitszeit (Std.)</th></tr></thead><tbody>
${report.siteTotals.map((s) => `<tr><td>${esc(s.site || OHNE_BAUSTELLE)}</td><td class="n">${fmtH(s.workedMin)}</td></tr>`).join('\n')}
</tbody></table>
${details}
</body></html>`;
}
