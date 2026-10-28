import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors } from './theme';

interface Props {
  /** HH:MM, formati 24 orë */
  value: string;
  onChange: (time: string) => void;
  label: string;
  doneLabel: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

// Zgjedhës kohe me formatin 24 orë dhe minuta vetëm 00/15/30/45 (zgjedhësit e sistemit nuk e kufizojnë këtë në të gjitha pajisjet).
export function TimePicker({ value, onChange, label, doneLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [hh, mm] = value.split(':');

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.fieldText}>{value}</Text>
      </Pressable>

      {open && (
        <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.cols}>
                <Column items={HOURS} selected={hh} onPick={(h) => onChange(`${h}:${mm}`)} />
                <Text style={styles.colon}>:</Text>
                <Column items={MINUTES} selected={mm} onPick={(m) => onChange(`${hh}:${m}`)} />
              </View>
              <Pressable style={styles.done} onPress={() => setOpen(false)} accessibilityRole="button">
                <Text style={styles.doneText}>{doneLabel}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function Column({ items, selected, onPick }: { items: string[]; selected: string; onPick: (v: string) => void }) {
  const index = Math.max(0, items.indexOf(selected));
  const ref = useRef<ScrollViewInstance>(null);
  // contentOffset nuk punon në web, prandaj e çojmë listën te vlera e zgjedhur pas hapjes.
  useEffect(() => {
    ref.current?.scrollTo({ y: Math.max(0, index - 2) * ROW_H, animated: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ScrollView
      ref={ref}
      style={styles.col}
      contentOffset={{ x: 0, y: Math.max(0, index - 2) * ROW_H }}
      showsVerticalScrollIndicator={false}
    >
      {items.map((v) => (
        <Pressable key={v} style={[styles.item, v === selected && styles.itemOn]} onPress={() => onPick(v)}>
          <Text style={[styles.itemText, v === selected && { color: '#fff' }]}>{v}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const ROW_H = 48;

const styles = StyleSheet.create({
  label: { fontSize: 14, color: colors.muted },
  field: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.bg },
  fieldText: { fontSize: 18, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: colors.card, borderRadius: 20, padding: 16, width: 260, gap: 12 },
  cols: { flexDirection: 'row', alignItems: 'center', height: ROW_H * 5, gap: 4 },
  col: { flex: 1, height: ROW_H * 5 },
  colon: { fontSize: 24, fontWeight: '700', color: colors.text },
  item: { height: ROW_H - 6, marginVertical: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.primary },
  itemText: { fontSize: 22, fontWeight: '600', color: colors.text },
  done: { backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
