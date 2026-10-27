import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
import { TimePicker } from './TimePicker';

interface Props {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  onChange: (date: string, time: string) => void;
  dateLabel: string;
  timeLabel: string;
  doneLabel: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Data dhe ora trajtohen si "orë muri" (pa zonë kohore), kështu pajisja nuk e ndryshon vlerën.
function toDate(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}
const fromDate = (d: Date) => ({
  date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
});
const showDate = (date: string) => date.split('-').reverse().join('.');

export function DateTimeField({ date, time, onChange, dateLabel, timeLabel, doneLabel }: Props) {
  const value = toDate(date, time);

  function onPicked(e: DateTimePickerEvent, picked?: Date) {
    if (e.type !== 'set' || !picked) return;
    const next = fromDate(picked);
    onChange(next.date, next.time);
  }

  if (Platform.OS === 'android') {
    // Në Android zgjedhësi hapet si dialog; çdo fushë hap të vetin.
    const openDate = () => DateTimePickerAndroid.open({ value, mode: 'date', onChange: onPicked });
    return (
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{dateLabel}</Text>
          <Pressable style={styles.field} onPress={openDate} accessibilityRole="button">
            <Text style={styles.fieldText}>{showDate(date)}</Text>
          </Pressable>
        </View>
        <View style={styles.colSmall}>
          <TimePicker value={time} onChange={(tm) => onChange(date, tm)} label={timeLabel} doneLabel={doneLabel} />
        </View>
      </View>
    );
  }

  // iOS: zgjedhës kompakt brenda faqes, hapet kur e prek.
  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <Text style={styles.label}>{dateLabel}</Text>
        <View style={styles.iosBox}>
          <DateTimePicker value={value} mode="date" display="compact" onChange={onPicked} />
        </View>
      </View>
      <View style={styles.colSmall}>
        <TimePicker value={time} onChange={(tm) => onChange(date, tm)} label={timeLabel} doneLabel={doneLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1.4, gap: 10 },
  colSmall: { flex: 1, gap: 10 },
  label: { fontSize: 14, color: colors.muted },
  field: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.bg },
  fieldText: { fontSize: 18, color: colors.text },
  iosBox: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 50 },
});
