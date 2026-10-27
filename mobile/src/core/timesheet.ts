import { weekday } from './berlin';
import { holidaysBW } from './holidays';
import { LOGO_DATA_URI } from './logoData';
import { esc, germanDate, monthTitleDe, type Report, type ReportLine } from './report';

const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** 495 → "8:15"; 0 → "" (fusha e zbrazët te fleta e shtypur). */
const hm = (min: number): string => (min > 0 ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : '');
const decimal = (min: number): string => (Math.round((min / 60) * 100) / 100).toFixed(2).replace('.', ',');

interface DayRow {
  from: string;
  to: string;
  breakMin: number;
  normalMin: number;
  overMin: number;
  sites: string[];
}

function groupByDate(line: ReportLine): Map<string, DayRow> {
  const byDate = new Map<string, DayRow>();
  for (const d of line.days) {
    const row = byDate.get(d.date) ?? { from: d.start, to: d.end, breakMin: 0, normalMin: 0, overMin: 0, sites: [] };
    if (byDate.has(d.date)) {
      // Disa turne në një ditë: nga fillimi i parë deri te fundi i fundit.
      if (d.start < row.from) row.from = d.start;
      if (d.end === '' || d.end > row.to) row.to = d.end === '' ? '' : d.end;
    }
    row.breakMin += d.breakMin;
    row.normalMin += d.workedMin;
    if (d.site && !row.sites.includes(d.site)) row.sites.push(d.site);
    byDate.set(d.date, row);
  }
  for (const [date, row] of byDate) {
    const over = Math.min(line.overtimeByDate[date] ?? 0, row.normalMin);
    row.overMin = over;
    row.normalMin -= over;
  }
  return byDate;
}

/**
 * Fleta e orëve (Arbeitszeitnachweis) për një punëtor dhe një muaj, A4, me logon dhe ngjyrat e AZ.
 * Gjermanisht, sepse e nënshkruan dhe e lexon pala gjermane.
 */
export function timesheetHtml(report: Report, line: ReportLine, opts: { showPay?: boolean } = {}): string {
  const [year, mon] = report.month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const holidays = holidaysBW(year);
  const byDate = groupByDate(line);

  let sumBreak = 0;
  let sumNormal = 0;
  let sumOver = 0;

  const rows = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = `${report.month}-${String(day).padStart(2, '0')}`;
    const wd = weekday(date);
    const holiday = holidays.get(date);
    const w = byDate.get(date);
    if (w) {
      sumBreak += w.breakMin;
      sumNormal += w.normalMin;
      sumOver += w.overMin;
    }
    const remarks = [...(w?.sites ?? []), ...(holiday ? [holiday] : [])].join(' · ');
    const cls = wd === 0 || wd === 6 || holiday ? ' class="off"' : '';
    return `<tr${cls}>
<td class="day"><b>${day}.</b> <span>${WEEKDAYS_DE[wd]}</span></td>
<td class="c">${holiday ? 'F' : ''}</td>
<td class="c">${w?.from ?? ''}</td><td class="c">${w?.to ?? ''}</td>
<td class="c">${w ? hm(w.breakMin) : ''}</td>
<td class="c">${w ? hm(w.normalMin) : ''}</td><td class="c">${w ? hm(w.overMin) : ''}</td>
<td class="rem">${esc(remarks)}</td></tr>`;
  }).join('\n');

  const total = sumNormal + sumOver;
  const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pay = opts.showPay
    ? `<div class="pay">
  <div><span>Stundenlohn</span><b>${line.hourlyRateCents === null ? '–' : eur(line.hourlyRateCents) + ' €'}</b></div>
  <div><span>Brutto (${decimal(total)} Std.)</span><b>${eur(line.grossCents)} €</b></div>
  <p>Brutto = Stunden × Stundenlohn (Überstunden mit Zuschlag), ohne Steuern und Sozialabgaben.</p>
</div>`
    : '';

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Arbeitszeitnachweis ${esc(line.name)} ${esc(monthTitleDe(report.month))}</title>
<style>
  :root { --dark: #16201C; --green: #2C7A5A; --brand: #409870; --soft: #E6F1EB; --line: #C9D3CC; }
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: var(--dark); margin: 0; }
  @media screen { body { max-width: 186mm; margin: 0 auto; padding: 8mm 0; } }
  .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid var(--green); padding-bottom: 6px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 15mm; }
  .brand .co { font-family: Georgia, 'Times New Roman', serif; font-weight: bold; font-size: 11pt; }
  .brand .co small { display: block; font-family: Arial, sans-serif; font-weight: normal; font-size: 8pt; color: #5B6862; margin-top: 2px; }
  h1 { margin: 0; font-size: 20pt; letter-spacing: .3px; text-align: right; }
  .period { text-align: right; margin-top: 3px; color: #5B6862; font-size: 9.5pt; }
  .period b { color: var(--dark); }
  .boxes { display: flex; gap: 10px; margin: 8px 0 8px; }
  .box { flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; }
  .box .t { font-size: 7pt; letter-spacing: .8px; text-transform: uppercase; color: var(--green); font-weight: bold; margin-bottom: 3px; }
  .box .row { display: flex; gap: 6px; padding: 2px 0; border-bottom: 1px dotted var(--line); }
  .box .row:last-child { border-bottom: 0; }
  .box .row span { color: #5B6862; width: 22mm; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid var(--line); padding: 0 4px; height: 5.55mm; line-height: 5.4mm; }
  thead th { background: var(--dark); color: #fff; font-size: 7.5pt; letter-spacing: .6px; text-transform: uppercase; height: 5mm; line-height: 5mm; border-color: var(--dark); }
  thead tr.sub th { background: var(--green); border-color: var(--green); font-weight: normal; text-transform: none; letter-spacing: 0; font-size: 7.5pt; }
  tbody tr:nth-child(even) td { background: #F1F6F2; }
  tbody tr.off td { background: var(--soft); }
  tbody tr.off td.day { color: var(--green); }
  td.day { white-space: nowrap; } td.day span { color: #5B6862; font-size: 7pt; margin-left: 2px; }
  td.c { text-align: center; font-variant-numeric: tabular-nums; }
  td.rem { font-size: 7.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  tfoot td { background: var(--dark); color: #fff; font-weight: bold; border-color: var(--dark); text-align: center; height: 6.5mm; line-height: 6.3mm; }
  tfoot td.l { text-align: right; letter-spacing: .6px; }
  .dec { text-align: right; font-size: 8pt; color: #5B6862; margin: 4px 0 0; }
  .pay { margin: 6px 0 0 auto; width: 70mm; border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; }
  .pay div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
  .pay div:first-child { border-bottom: 1px dotted var(--line); }
  .pay span { color: #5B6862; }
  .pay div:nth-child(2) b { color: var(--green); font-size: 10pt; }
  .pay p { margin: 3px 0 0; font-size: 6.5pt; color: #5B6862; }
  .sign { display: flex; gap: 14mm; margin-top: 11mm; }
  .sign div { flex: 1; border-top: 1px solid var(--dark); padding-top: 2px; font-size: 7.5pt; color: #5B6862; }
  .legend { margin-top: 6px; font-size: 7pt; color: #5B6862; }
</style></head><body>
<div class="top">
  <div class="brand"><img src="${LOGO_DATA_URI}" alt="AZ"><div class="co">${esc(report.company)}<small>Ludwigsburg</small></div></div>
  <div><h1>Arbeitszeitnachweis</h1><div class="period">Monat: <b>${esc(monthTitleDe(report.month).split(' ')[0])}</b> &nbsp; Jahr: <b>${year}</b></div></div>
</div>
<div class="boxes">
  <div class="box"><div class="t">Arbeitgeber</div><div class="row"><span>Firma</span><b>${esc(report.company)}</b></div><div class="row"><span>Ort</span>Ludwigsburg</div></div>
  <div class="box"><div class="t">Arbeitnehmer</div>
    <div class="row"><span>Vorname</span><b>${esc(line.firstName)}</b></div>
    <div class="row"><span>Nachname</span><b>${esc(line.lastName)}</b></div>
    <div class="row"><span>Benutzername</span><b>${esc(line.personnelNo)}</b></div></div>
</div>
<table>
<colgroup><col style="width:17mm"><col style="width:11mm"><col style="width:14mm"><col style="width:14mm"><col style="width:14mm"><col style="width:15mm"><col style="width:15mm"><col></colgroup>
<thead>
<tr><th rowspan="2">Tag</th><th rowspan="2">Status</th><th colspan="2">Arbeitszeit</th><th>Pause</th><th colspan="2">Arbeitsstunden</th><th rowspan="2">Tätigkeit / Baustelle</th></tr>
<tr class="sub"><th>von</th><th>bis</th><th>Dauer</th><th>Normal</th><th>Über</th></tr>
</thead>
<tbody>
${rows}
</tbody>
<tfoot><tr><td colspan="4" class="l">SUMME</td><td>${hm(sumBreak)}</td><td>${hm(sumNormal)}</td><td>${hm(sumOver)}</td><td></td></tr></tfoot>
</table>
<p class="dec">Gesamt: <b>${hm(total) || '0:00'} Std.</b> (${decimal(total)} Std.)</p>
${pay}
<div class="sign"><div>Datum, Unterschrift Arbeitnehmer</div><div>Datum, Unterschrift Arbeitgeber</div></div>
<p class="legend">Status: F = Feiertag (Baden-Württemberg). Wochenenden und Feiertage sind grün hinterlegt. Erstellt am ${germanDate(report.generatedAt.slice(0, 10))}.</p>
</body></html>`;
}
