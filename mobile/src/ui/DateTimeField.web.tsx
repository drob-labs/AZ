import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

interface Props {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  onChange: (date: string, time: string) => void;
  dateLabel: string;
  timeLabel: string;
  doneLabel?: string;
}

// Në web përdorim kontrollet e shfletuesit (input date/time), që hapin kalendarin e vetë pajisjes.
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: 12,
  fontSize: 18,
  color: colors.text,
  backgroundColor: colors.bg,
  fontFamily: 'inherit',
} as const;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Vetëm 00/15/30/45, formati 24 orë (input type=time ndjek formatin e shfletuesit, prandaj përdorim select).
const MINUTES = ['00', '15', '30', '45'];

export function DateTimeField({ date, time, onChange, dateLabel, timeLabel }: Props) {
  const [hh, mm] = time.split(':');
  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <Text style={styles.label}>{dateLabel}</Text>
        {createElement('input', {
          type: 'date',
          value: date,
          style: inputStyle,
          // Shfletuesi kthen vlerë të zbrazët kur fusha pastrohet; atëherë mbajmë vlerën e mëparshme.
          onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value, time),
        })}
      </View>
      <View style={styles.colSmall}>
        <Text style={styles.label}>{timeLabel}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {createElement(
            'select',
            { value: hh, style: { ...inputStyle, flex: 1 }, onChange: (e: { target: { value: string } }) => onChange(date, `${e.target.value}:${mm}`) },
            HOURS.map((h) => createElement('option', { key: h, value: h }, h)),
          )}
          {createElement(
            'select',
            { value: mm, style: { ...inputStyle, flex: 1 }, onChange: (e: { target: { value: string } }) => onChange(date, `${hh}:${e.target.value}`) },
            MINUTES.map((m) => createElement('option', { key: m, value: m }, m)),
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1.4, gap: 10 },
  colSmall: { flex: 1, gap: 10 },
  label: { fontSize: 14, color: colors.muted },
});
