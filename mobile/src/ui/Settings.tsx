import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './iconPaths';
import { colors } from './theme';

/** Grup rreshtash si te cilësimet e telefonit: titull i vogël sipër dhe kartë me rreshta të ndarë. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.card}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.sep} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

interface RowProps {
  icon: IconName;
  label: string;
  /** Vlera aktuale djathtas (p.sh. gjuha e zgjedhur). */
  value?: string;
  onPress: () => void;
  danger?: boolean;
  /** Pa shigjetë djathtas. */
  plain?: boolean;
}

export function Row({ icon, label, value, onPress, danger, plain }: RowProps) {
  const tint = danger ? colors.stop : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]}
    >
      <View style={[styles.iconBox, { backgroundColor: danger ? '#F8E7E5' : colors.primarySoft }]}>
        <Icon name={icon} color={tint} size={20} />
      </View>
      <Text style={[styles.label, danger && { color: colors.stop }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {plain ? null : <Icon name="caretRight" color={colors.muted} size={16} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 62 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  value: { fontSize: 15, color: colors.muted, maxWidth: '45%' },
});
