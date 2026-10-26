import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { elapsedWorkedMin, workedMs } from '../../src/core/tracker';
import { useI18n } from '../../src/i18n';
import { formatClock, formatDuration, formatTime } from '../../src/lib/format';
import { nowIso } from '../../src/lib/id';
import { useSession } from '../../src/state/session';
import { useTracker } from '../../src/state/tracker';
import { colors } from '../../src/ui/theme';

const BREAK_CHOICES = [15, 30, 45, 60];

export default function Today() {
  const { t } = useI18n();
  const { employee } = useSession();
  const tr = useTracker();
  const [nowMs, setNowMs] = useState(Date.now());
  const [askBreak, setAskBreak] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [pickSite, setPickSite] = useState(false);

  const currentSite = tr.sites.find((x) => x.id === tr.current?.siteId) ?? null;

  function onStart() {
    // Punëtorët janë në vende të ndryshme: zgjedhin Baustelle-n para START (nëse ka të regjistruara).
    if (tr.sites.length > 0) setPickSite(true);
    else tr.start(null);
  }

  function startAt(siteId: string | null) {
    setPickSite(false);
    tr.start(siteId);
  }

  useEffect(() => {
    if (tr.status === 'idle') return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tr.status]);

  function finish(totalBreakMin: number | null) {
    const done = tr.stop(totalBreakMin);
    setAskBreak(false);
    if (!done) return;
    const now = nowIso();
    const worked = formatDuration(elapsedWorkedMin(done, now));
    const brk = (done.declaredBreakMin ?? 0) + done.breaks.reduce(
      (sum, b) => sum + (b.endedAt ? Math.round((Date.parse(b.endedAt) - Date.parse(b.startedAt)) / 60000) : 0),
      0,
    );
    setSummary(t('summaryText', { worked, brk }));
  }

  // Modalet funksionojnë njësoj në telefon dhe në web (Alert.alert nuk punon në web).
  function confirmedStop() {
    setConfirmStop(false);
    if (tr.settings.breakMode === 'ask_at_stop' && tr.shortfallBeforeStop() > 0) setAskBreak(true);
    else finish(null);
  }

  const idle = tr.status === 'idle';
  const paused = tr.status === 'paused';
  const statusText = idle ? t('statusIdle') : paused ? t('statusPaused') : t('statusWorking');
  const syncText = tr.syncError
    ? t('syncError')
    : tr.pendingCount > 0
      ? `${t('pendingSync')}: ${tr.pendingCount}`
      : t('allSynced');

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.hello}>{employee ? `${employee.first_name} ${employee.last_name}` : ''}</Text>
        <Text style={[styles.status, { color: idle ? colors.muted : paused ? colors.pause : colors.start }]}>
          {statusText}
        </Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.timerLabel}>{t('workedToday')}</Text>
        <Text style={styles.timer} accessibilityLabel={t('workedToday')}>
          {tr.current ? formatClock(workedMs(tr.current, nowMs)) : '00:00:00'}
        </Text>
        {tr.current && (
          <Text style={styles.since}>
            {t('startedAt')} {formatTime(tr.current.startedAt)}
          </Text>
        )}
        {currentSite && (
          <Pressable
            style={styles.siteBox}
            disabled={!currentSite.address}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentSite.address ?? currentSite.name)}`,
              )
            }
            accessibilityRole="link"
          >
            <Text style={styles.siteName}>{currentSite.name}</Text>
            {currentSite.address ? <Text style={styles.siteAddr}>{currentSite.address} · {t('openMap')}</Text> : null}
          </Pressable>
        )}

        <Pressable
          onPress={idle ? onStart : () => setConfirmStop(true)}
          style={[styles.big, { backgroundColor: idle ? colors.start : colors.stop }]}
          accessibilityRole="button"
          accessibilityLabel={idle ? t('start') : t('stop')}
        >
          <Text style={styles.bigText}>{idle ? t('start') : t('stop')}</Text>
        </Pressable>

        {!idle && (
          <Pressable
            onPress={paused ? tr.resume : tr.pause}
            style={[styles.pause, { borderColor: colors.pause }]}
            accessibilityRole="button"
          >
            <Text style={[styles.pauseText, { color: colors.pause }]}>{paused ? t('resume') : t('pause')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.sync, tr.syncError && { color: colors.warn }]}>{syncText}</Text>
      </View>

      <Modal visible={pickSite} transparent animationType="slide" onRequestClose={() => setPickSite(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <Text style={styles.sheetTitle}>{t('pickSite')}</Text>
            <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
              {tr.sites.map((x) => (
                <Pressable key={x.id} style={styles.siteChoice} onPress={() => startAt(x.id)} accessibilityRole="button">
                  <Text style={styles.siteChoiceName}>{x.name}</Text>
                  {x.address ? <Text style={styles.siteChoiceAddr}>{x.address}</Text> : null}
                </Pressable>
              ))}
              {!tr.settings.requireSite && (
                <Pressable style={[styles.siteChoice, { backgroundColor: colors.bg }]} onPress={() => startAt(null)}>
                  <Text style={[styles.siteChoiceName, { color: colors.muted }]}>{t('noSite')}</Text>
                </Pressable>
              )}
            </ScrollView>
            <Pressable onPress={() => setPickSite(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmStop} transparent animationType="fade" onRequestClose={() => setConfirmStop(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('stop')}?</Text>
            <View style={styles.choices}>
              <Pressable style={[styles.choice, { backgroundColor: colors.stop }]} onPress={confirmedStop}>
                <Text style={styles.choiceText}>{t('stop')}</Text>
              </Pressable>
              <Pressable style={[styles.choice, { backgroundColor: colors.muted }]} onPress={() => setConfirmStop(false)}>
                <Text style={styles.choiceText}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={summary !== null} transparent animationType="fade" onRequestClose={() => setSummary(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('summaryTitle')}</Text>
            <Text style={styles.sheetText}>{summary}</Text>
            <Pressable style={[styles.choice, { alignItems: 'center' }]} onPress={() => setSummary(null)}>
              <Text style={styles.choiceText}>{t('ok')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={askBreak} transparent animationType="fade" onRequestClose={() => setAskBreak(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('breakQuestionTitle')}</Text>
            <Text style={styles.sheetText}>{t('breakQuestionText')}</Text>
            <View style={styles.choices}>
              {BREAK_CHOICES.map((m) => (
                <Pressable key={m} style={styles.choice} onPress={() => finish(m)}>
                  <Text style={styles.choiceText}>
                    {m} {t('minutes')}
                  </Text>
                </Pressable>
              ))}
              <Pressable style={styles.choice} onPress={() => finish(0)}>
                <Text style={styles.choiceText}>{t('breakNone')}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setAskBreak(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 12 },
  hello: { fontSize: 22, fontWeight: '700', color: colors.text },
  status: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  timerLabel: { fontSize: 15, color: colors.muted },
  timer: { fontSize: 52, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  since: { fontSize: 16, color: colors.muted },
  siteBox: { alignItems: 'center', marginBottom: 12, paddingHorizontal: 24 },
  siteName: { fontSize: 18, fontWeight: '700', color: colors.text },
  siteAddr: { fontSize: 14, color: colors.primary, marginTop: 2, textAlign: 'center' },
  siteChoice: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  siteChoiceName: { fontSize: 20, fontWeight: '700', color: colors.text },
  siteChoiceAddr: { fontSize: 14, color: colors.muted, marginTop: 2 },
  big: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  bigText: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: 1 },
  pause: { marginTop: 18, borderWidth: 3, borderRadius: 40, paddingVertical: 16, paddingHorizontal: 48 },
  pauseText: { fontSize: 24, fontWeight: '700' },
  footer: { padding: 16, alignItems: 'center' },
  sync: { fontSize: 14, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 10 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  sheetText: { fontSize: 15, color: colors.muted },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  choice: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 22 },
  choiceText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancel: { alignItems: 'center', padding: 14 },
  cancelText: { fontSize: 17, color: colors.muted },
});
