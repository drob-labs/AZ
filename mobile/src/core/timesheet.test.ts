import { describe, expect, it } from 'vitest';
import { buildReport } from './report';
import { timesheetHtml } from './timesheet';
import type { Settings, Shift } from './types';

const settings: Settings = {
  overtimeDailyAfterH: 8,
  overtimeWeeklyAfterH: null,
  overtimeSurchargePct: 25,
  minWageCentsByYear: {},
};

const sh = (id: string, d: string, from: string, to: string | null, brk = 0, siteName: string | null = null): Shift => ({
  id,
  employeeId: 'e',
  startedAt: `${d}T${from}:00Z`,
  endedAt: to ? `${d}T${to}:00Z` : null,
  breaks: [],
  declaredBreakMin: brk,
  siteName,
});

const report = buildReport({
  month: '2026-10',
  company: 'AZ Trockenbau & Innenausbau',
  settings,
  generatedAt: '2026-11-01T08:00:00Z',
  employees: [
    {
      personnelNo: '1001',
      firstName: 'Salih',
      lastName: 'Havolli <b>',
      rates: [{ validFrom: '2026-01-01', hourlyRateCents: 2000 }],
      shifts: [
        sh('a', '2026-10-05', '05:00', '13:30', 30, 'Shpia e Friedrich'), // 8h
        sh('b', '2026-10-06', '05:00', '15:45', 45, 'Zyra Muller'), // 10h → 2h shtesë
        sh('c', '2026-10-07', '05:00', '09:00', 0, 'Zyra Muller'), // dy turne në një ditë
        sh('d', '2026-10-07', '09:30', '13:00', 0, 'Zyra Muller'),
        sh('x', '2026-09-30', '05:00', '13:30', 30), // jashtë muajit
      ],
    },
  ],
});

describe('timesheetHtml', () => {
  const html = timesheetHtml(report, report.lines[0]);

  it('ka një rresht për çdo ditë të muajit', () => {
    expect(html.match(/<td class="day">/g)).toHaveLength(31);
  });

  it('mbledh normal dhe orët shtesë te SUMME', () => {
    // 8:00 + 10:00 + (4:00 + 3:30) = 25:30; nga këto 2:00 janë shtesë (e marta); pauza 0:30 + 0:45
    expect(html).toContain('<td>1:15</td><td>23:30</td><td>2:00</td>');
    expect(html).toContain('<b>25:30 Std.</b> (25,50 Std.)');
  });

  it('merr fillimin e parë dhe fundin e fundit kur ka disa turne në ditë', () => {
    expect(html).toMatch(/<b>7\.<\/b> <span>Mi<\/span><\/td>\s*<td class="c"><\/td>\s*<td class="c">07:00<\/td><td class="c">15:00<\/td>/);
  });

  it('shënon festën me F dhe e shton emrin te vërejtjet', () => {
    expect(html).toMatch(/<b>3\.<\/b> <span>Sa<\/span><\/td>\s*<td class="c">F<\/td>/);
    expect(html).toContain('Tag der Deutschen Einheit');
  });

  it('shfaq tarifën dhe bruton vetëm kur kërkohet', () => {
    expect(html).not.toContain('class="pay"');
    const withPay = timesheetHtml(report, report.lines[0], { showPay: true });
    expect(withPay).toContain('20,00 €');
    expect(withPay).toContain('520,00 €'); // 23:30 × 20 € + 2:00 × 25 € (shtesë 25%)
  });

  it('i shpëton tekstet e punëtorit', () => {
    expect(html).toContain('Havolli &lt;b&gt;');
    expect(html).not.toContain('Havolli <b>');
  });
});
