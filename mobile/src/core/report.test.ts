import { describe, expect, it } from 'vitest';
import { buildReport, excelSheets, reportHtml } from './report';
import type { Settings, Shift } from './types';

const settings: Settings = {
  overtimeDailyAfterH: 8,
  overtimeWeeklyAfterH: null,
  overtimeSurchargePct: 25,
  minWageCentsByYear: { 2026: 1390 },
};

const sh = (id: string, d: string, from: string, to: string | null, brk = 0): Shift => ({
  id,
  employeeId: 'e',
  startedAt: `${d}T${from}:00Z`,
  endedAt: to ? `${d}T${to}:00Z` : null,
  breaks: [],
  declaredBreakMin: brk,
});

const input = {
  month: '2026-10',
  company: 'AZ Trockenbau & Innenausbau',
  settings,
  generatedAt: '2026-11-01T08:00:00Z',
  employees: [
    {
      personnelNo: '1001',
      firstName: 'Ardit',
      lastName: 'Zeneli <script>',
      rates: [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }],
      shifts: [
        sh('a', '2026-10-05', '05:00', '13:30', 30), // 8h
        sh('b', '2026-10-06', '05:00', '15:45', 45), // 10h → 2h shtesë
        sh('x', '2026-09-30', '05:00', '13:30', 30), // jashtë muajit
      ],
    },
    {
      personnelNo: '1002',
      firstName: 'Beni',
      lastName: 'Aliu',
      rates: [],
      shifts: [sh('c', '2026-10-07', '05:00', '13:30', 30)],
    },
  ],
};

describe('buildReport', () => {
  const r = buildReport(input);

  it('llogarit orët, orët shtesë dhe pagën bruto', () => {
    const z = r.lines.find((l) => l.personnelNo === '1001')!;
    expect(z.workedMin).toBe(18 * 60);
    expect(z.overtimeMin).toBe(120);
    expect(z.grossCents).toBe(16 * 2000 + 2 * 2500);
    expect(z.days).toHaveLength(2);
  });

  it('turni i muajit tjetër nuk numërohet', () => {
    expect(r.shiftCount).toBe(3);
    expect(r.lines.find((l) => l.personnelNo === '1001')!.days.every((d) => d.date.startsWith('2026-10'))).toBe(true);
  });

  it('punëtori pa tarifë merr paralajmërim dhe 0 €', () => {
    const b = r.lines.find((l) => l.personnelNo === '1002')!;
    expect(b.grossCents).toBe(0);
    expect(b.warnings).toContain('NO_RATE');
  });

  it('rendit sipas mbiemrit dhe mbledh totalet', () => {
    expect(r.lines.map((l) => l.personnelNo)).toEqual(['1002', '1001']);
    expect(r.totals.workedMin).toBe(26 * 60);
    expect(r.totals.grossCents).toBe(16 * 2000 + 2 * 2500);
  });

  it('numëron turnet e hapura', () => {
    const open = buildReport({
      ...input,
      employees: [{ ...input.employees[0], shifts: [sh('o', '2026-10-08', '05:00', null)] }],
    });
    expect(open.openShiftCount).toBe(1);
  });
});

describe('eksportet', () => {
  const r = buildReport(input);

  it('Excel ka numra të vërtetë dhe datë gjermane', () => {
    const [summary, detail] = excelSheets(r);
    expect(summary.name).toBe('Zusammenfassung');
    const row = summary.rows.find((x) => x[0] === '1001')!;
    expect(row[2]).toBe(18);
    expect(row[3]).toBe(2);
    expect(row[6]).toBe(370);
    expect(detail.rows[1][2]).toBe('07.10.2026');
    expect(summary.rows.at(-1)![1]).toBe('Summe');
  });

  it('HTML i largon shenjat e rrezikshme dhe ka titullin gjermanisht', () => {
    const html = reportHtml(r);
    expect(html).toContain('Stundenabrechnung Oktober 2026');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('370,00');
  });
});

describe('baustelle në raport', () => {
  const withSite = (id: string, d: string, site: string | null): Shift => ({
    ...sh(id, d, '05:00', '13:30', 30),
    siteName: site,
  });
  const r = buildReport({
    ...input,
    employees: [
      {
        personnelNo: '1',
        firstName: 'A',
        lastName: 'A',
        rates: [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }],
        shifts: [withSite('a', '2026-10-05', 'Stuttgart Büro'), withSite('b', '2026-10-06', 'Stuttgart Büro'), withSite('c', '2026-10-07', null)],
      },
      {
        personnelNo: '2',
        firstName: 'B',
        lastName: 'B',
        rates: [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }],
        shifts: [withSite('d', '2026-10-05', 'Heilbronn Wohnung')],
      },
    ],
  });

  it('mbledh orët sipas baustelle-s, më të shumtat sipër', () => {
    expect(r.siteTotals).toEqual([
      { site: 'Stuttgart Büro', workedMin: 16 * 60 },
      { site: 'Heilbronn Wohnung', workedMin: 8 * 60 },
      { site: '', workedMin: 8 * 60 },
    ].sort((a, b) => b.workedMin - a.workedMin || a.site.localeCompare(b.site, 'de')));
    expect(r.siteTotals[0].site).toBe('Stuttgart Büro');
  });

  it('Excel ka fletën Baustellen dhe kolonën Baustelle te detajet', () => {
    const sheets = excelSheets(r);
    expect(sheets.map((s) => s.name)).toEqual(['Zusammenfassung', 'Einzelnachweis', 'Baustellen']);
    expect(sheets[1].rows[0][3]).toBe('Baustelle');
    expect(sheets[2].rows.some((row) => row[0] === 'ohne Baustelle')).toBe(true);
    expect(sheets[2].rows.at(-1)).toEqual(['Summe', 32]);
  });

  it('PDF liston baustelle-t', () => {
    const html = reportHtml(r);
    expect(html).toContain('Stunden je Baustelle');
    expect(html).toContain('Heilbronn Wohnung');
  });
});
