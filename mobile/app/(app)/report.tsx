import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, berlinParts } from '../../src/core/berlin';
import { buildReport, reportHtml, type Report, type ReportEmployee } from '../../src/core/report';
import { timesheetHtml } from '../../src/core/timesheet';
import type { Rate, Settings, Shift } from '../../src/core/types';
import { useI18n } from '../../src/i18n';
import { exportPdf } from '../../src/lib/exportFiles';
import { formatDuration } from '../../src/lib/format';
import { nowIso } from '../../src/lib/id';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/ui/theme';

const COMPANY = 'AZ Trockenbau & Innenausbau';
const PAGE = 1000;

interface ShiftRow {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  declared_break_min: number | null;
  sites: { name: string } | null;
  breaks: { started_at: string; ended_at: string | null }[];
}

/** Punëtor i raportit: id-ja e databazës, të dhënat për llogaritje dhe turnet e hapura të muajit. */
interface Person {
  id: string;
  emp: ReportEmployee;
  openCount: number;
}

const monthTitle = (m: string): string => `${m.slice(5, 7)}.${m.slice(0, 4)}`;

function shiftMonth(prefix: string, delta: number): string {
  const [y, m] = prefix.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Marrim edhe javët e plota që prekin muajin, që pragu javor i orëve shtesë të jetë i saktë. */
function paddedRange(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  return { from: addDays(first, -7), to: addDays(next, 7) };
}

async function fetchAllShifts(from: string, to: string): Promise<ShiftRow[]> {
  const all: ShiftRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('shifts')
      .select('id, employee_id, started_at, ended_at, declared_break_min, sites(name), breaks(started_at, ended_at)')
      .gte('started_at', `${from}T00:00:00Z`)
      .lt('started_at', `${to}T00:00:00Z`)
      .order('started_at')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as unknown as ShiftRow[]));
    if (!data || data.length < PAGE) return all;
  }
}

export default function MonthReport() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => berlinParts(nowIso()).date.slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const lastSettings = (): Settings =>
    settingsState ?? { overtimeDailyAfterH: null, overtimeWeeklyAfterH: null, overtimeSurchargePct: 25, minWageCentsByYear: {} };
  const [people, setPeople] = useState<Person[]>([]);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const [allClosed, setAllClosed] = useState(false);
  const [noRateNames, setNoRateNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Person | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [includePay, setIncludePay] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { from, to } = paddedRange(month);
      const [emps, rates, settingsRes, closing, shifts] = await Promise.all([
        supabase.from('employees').select('id, personnel_no, first_name, last_name').eq('role', 'worker').eq('active', true),
        supabase.from('employee_rates').select('employee_id, valid_from, hourly_rate_cents'),
        supabase.from('settings').select('*').single(),
        supabase
          .from('month_closings')
          .select('employee_id')
          .eq('year', Number(month.slice(0, 4)))
          .eq('month', Number(month.slice(5, 7))),
        fetchAllShifts(from, to),
      ]);
      const s = settingsRes.data;
      const settings: Settings = {
        overtimeDailyAfterH: s?.overtime_daily_after_h ?? null,
        overtimeWeeklyAfterH: s?.overtime_weekly_after_h ?? null,
        overtimeSurchargePct: Number(s?.overtime_surcharge_pct ?? 25),
        minWageCentsByYear: Object.fromEntries(
          Object.entries((s?.min_wage_cents_by_year ?? {}) as Record<string, number>).map(([y, c]) => [Number(y), c]),
        ),
      };

      const withIds = (emps.data ?? []).map((e) => ({
        id: e.id as string,
        emp: {
        personnelNo: e.personnel_no,
        firstName: e.first_name,
        lastName: e.last_name,
        rates: (rates.data ?? [])
          .filter((r) => r.employee_id === e.id)
          .map((r): Rate => ({ validFrom: r.valid_from, hourlyRateCents: r.hourly_rate_cents })),
        shifts: shifts
          .filter((x) => x.employee_id === e.id)
          .map(
            (x): Shift => ({
              id: x.id,
              employeeId: e.id,
              startedAt: x.started_at,
              endedAt: x.ended_at,
              declaredBreakMin: x.declared_break_min ?? undefined,
              siteName: x.sites?.name ?? null,
              breaks: x.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at })),
            }),
          ),
        } as ReportEmployee,
      }));
      const employees = withIds.map((w) => w.emp);

      const rep = buildReport({ month, company: COMPANY, employees, settings, generatedAt: nowIso() });
      setReport(rep);
      setSettingsState(settings);
      setPeople(
        withIds.map((w) => ({
          ...w,
          openCount: w.emp.shifts.filter((x) => !x.endedAt && berlinParts(x.startedAt).date.startsWith(month)).length,
        })),
      );
      const closings = closing.data ?? [];
      setAllClosed(closings.some((c) => c.employee_id === null));
      setClosedIds(new Set(closings.flatMap((c) => (c.employee_id ? [c.employee_id as string] : []))));
      setNoRateNames(rep.lines.filter((l) => l.warnings.includes('NO_RATE')).map((l) => l.name));
    } catch {
      setMessage(t('exportFailed'));
    } finally {
      setLoading(false);
    }
  }, [month, t]);

  // Tab-et mbeten të hapura, prandaj rifreskojmë sa herë që kthehesh në ekran.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isClosed = (id: string) => allClosed || closedIds.has(id);
  const personFor = (personnelNo: string) => people.find((x) => x.emp.personnelNo === personnelNo);
  // Turnet e hapura që bllokojnë mbylljen (vetëm të punëtorëve që s'janë mbyllur ende).
  const openBlocking = useMemo(
    () => people.filter((x) => !(allClosed || closedIds.has(x.id))).reduce((sum, x) => sum + x.openCount, 0),
    [people, allClosed, closedIds],
  );
  const closedCount = people.filter((x) => allClosed || closedIds.has(x.id)).length;

  async function run(fn: () => Promise<void>, failMsg: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch {
      setMessage(failMsg);
    } finally {
      setBusy(false);
    }
  }

  const doPdf = () => report && run(() => exportPdf(reportHtml(report), `Stunden_${month}.pdf`), t('exportFailed'));

  const doTimesheet = (person: Person) => {
    const line = report?.lines.find((l) => l.personnelNo === person.emp.personnelNo);
    if (!report || !line) return;
    const safe = (x: string) => x.replace(/[^A-Za-z0-9]+/g, '_');
    const filename = `Arbeitszeitnachweis_${safe(line.lastName)}_${safe(line.firstName)}_${month}.pdf`;
    return run(() => exportPdf(timesheetHtml(report, line, { showPay: includePay }), filename), t('exportFailed'));
  };

  async function doClose() {
    const person = confirming;
    if (!person) return;
    setConfirming(null);
    // Fotografia e ruajtur përmban vetëm këtë punëtor.
    const own = buildReport({ month, company: COMPANY, employees: [person.emp], settings: lastSettings(), generatedAt: nowIso() });
    await run(async () => {
      const { error } = await supabase.rpc('close_employee_month', {
        p_employee: person.id,
        p_year: Number(month.slice(0, 4)),
        p_month: Number(month.slice(5, 7)),
        p_snapshot: { shiftCount: own.shiftCount, report: own },
      });
      if (error) {
        setMessage(`${t('closeFailed')} ${error.message}`);
        return;
      }
      await load();
    }, t('closeFailed'));
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.title}>{t('monthReport')}</Text>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} style={styles.arrow} accessibilityLabel="‹">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{month}</Text>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} style={styles.arrow} accessibilityLabel="›">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
          {people.length > 0 && (
            <Text style={styles.closed}>{t('closedCount', { n: closedCount, total: people.length })}</Text>
          )}
        </View>

        {loading && <ActivityIndicator />}
        {message && <Text style={styles.error}>{message}</Text>}

        {report && (
          <>
            <View style={styles.table}>
              <View style={[styles.tr, styles.th]}>
                <Text style={[styles.cName, styles.thText]}>{t('employee')}</Text>
                <Text style={[styles.cNum, styles.thText]}>{t('colHours')}</Text>
                <Text style={[styles.cNum, styles.thText]}>{t('colOvertime')}</Text>
                <Text style={[styles.cNum, styles.thText]}>{t('colGross')}</Text>
                <View style={styles.cAct} />
              </View>
              {report.lines.map((l) => {
                const person = personFor(l.personnelNo);
                const closed = person ? isClosed(person.id) : false;
                const hasOpen = (person?.openCount ?? 0) > 0;
                return (
                  <Pressable
                    key={l.personnelNo}
                    style={[styles.tr, styles.trCenter]}
                    onPress={() => person && setSelected(person)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cName}>{l.name}</Text>
                    <Text style={styles.cNum}>{formatDuration(l.workedMin)}</Text>
                    <Text style={styles.cNum}>{formatDuration(l.overtimeMin)}</Text>
                    <Text style={styles.cNum}>{(l.grossCents / 100).toFixed(2)} €</Text>
                    <View style={styles.cAct}>
                      {closed ? (
                        <Text style={styles.lock} accessibilityLabel={t('closedLabel')}>🔒</Text>
                      ) : person ? (
                        <Pressable
                          style={[styles.pill, (busy || hasOpen) && styles.off]}
                          disabled={busy || hasOpen}
                          onPress={() => setConfirming(person)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.pillText}>{t('closeEmployee')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              <View style={[styles.tr, styles.sum]}>
                <Text style={[styles.cName, styles.bold]}>{t('total')}</Text>
                <Text style={[styles.cNum, styles.bold]}>{formatDuration(report.totals.workedMin)}</Text>
                <Text style={[styles.cNum, styles.bold]}>{formatDuration(report.totals.overtimeMin)}</Text>
                <Text style={[styles.cNum, styles.bold]}>{(report.totals.grossCents / 100).toFixed(2)} €</Text>
                <View style={styles.cAct} />
              </View>
            </View>

            <Text style={styles.note}>{t('grossNote')}</Text>
            <Text style={styles.note}>{t('tapRowHint')}</Text>
            {openBlocking > 0 && <Text style={styles.error}>{t('openShiftsBlock', { n: openBlocking })}</Text>}
            {noRateNames.length > 0 && (
              <Text style={styles.warn}>
                {t('noRateBlock')} {noRateNames.join(', ')}
              </Text>
            )}

            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, busy && styles.off]} disabled={busy} onPress={doPdf}>
                <Text style={styles.btnText}>{t('exportPdf')}</Text>
              </Pressable>
            </View>

          </>
        )}
      </ScrollView>

      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && (
              <>
                <Text style={styles.sheetTitle}>
                  {selected.emp.firstName} {selected.emp.lastName}
                </Text>
                <Text style={styles.note}>
                  {selected.emp.personnelNo} · {monthTitle(month)}
                </Text>
                <View style={styles.payRow}>
                  <Switch value={includePay} onValueChange={setIncludePay} />
                  <Text style={styles.payText}>{t('includePay')}</Text>
                </View>
                <Pressable style={[styles.btn, busy && styles.off]} disabled={busy} onPress={() => doTimesheet(selected)}>
                  <Text style={styles.btnText}>{t('employeeSheetPdf')}</Text>
                </Pressable>
                {isClosed(selected.id) ? (
                  <Text style={styles.closed}>🔒 {t('closedLabel')}</Text>
                ) : (
                  <Pressable
                    style={[styles.btn, styles.closeBtn, (busy || selected.openCount > 0) && styles.off]}
                    disabled={busy || selected.openCount > 0}
                    onPress={() => {
                      setConfirming(selected);
                      setSelected(null);
                    }}
                  >
                    <Text style={styles.btnText}>{t('closeMonth')}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.later} onPress={() => setSelected(null)}>
                  <Text style={styles.laterText}>{t('close')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirming !== null} transparent animationType="fade" onRequestClose={() => setConfirming(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {t('closeConfirmEmployeeTitle', { name: confirming ? `${confirming.emp.firstName} ${confirming.emp.lastName}` : '' })}
            </Text>
            <Text style={styles.note}>
              {t('closeConfirmEmployeeText', { name: confirming ? `${confirming.emp.firstName} ${confirming.emp.lastName}` : '' })}
            </Text>
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => setConfirming(null)}>
                <Text style={styles.btnText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.closeBtn]} onPress={doClose}>
                <Text style={styles.btnText}>{t('closeMonth')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  arrowText: { fontSize: 22, color: colors.text },
  month: { fontSize: 18, fontWeight: '700', color: colors.text },
  closed: { marginLeft: 'auto', fontSize: 14, color: colors.muted },
  table: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  trCenter: { alignItems: 'center' },
  cAct: { width: 66, alignItems: 'flex-end' },
  lock: { fontSize: 16 },
  pill: { borderWidth: 1, borderColor: colors.stop, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  pillText: { color: colors.stop, fontSize: 13, fontWeight: '700' },
  tr: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { backgroundColor: colors.bg },
  thText: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  sum: { borderBottomWidth: 0, backgroundColor: colors.bg },
  bold: { fontWeight: '700' },
  cName: { flex: 2, fontSize: 14, color: colors.text },
  cNum: { flex: 1.2, fontSize: 14, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: colors.muted },
  warn: { fontSize: 14, color: colors.warn },
  error: { fontSize: 15, color: colors.stop },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  closeBtn: { backgroundColor: colors.stop },
  off: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payText: { flex: 1, fontSize: 15, color: colors.text },
  later: { padding: 10, alignItems: 'center' },
  laterText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
});
