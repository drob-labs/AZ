import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../state/session';
import { Avatar } from './Avatar';
import { colors, serif } from './theme';

const mark = require('../../assets/logo-mark.png');
const MARK_RATIO = 410 / 270;

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { employee } = useSession();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Image source={mark} style={styles.mark} resizeMode="contain" accessibilityLabel="AZ" />
      <View style={styles.rule} />
      <Text style={styles.name} numberOfLines={1}>
        Trockenbau & Innenausbau
      </Text>
      {employee ? (
        <Avatar path={employee.avatar_path} first={employee.first_name} last={employee.last_name} size={34} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mark: { height: 40, width: 40 * MARK_RATIO },
  rule: { width: 1, height: 26, backgroundColor: colors.border },
  name: { flex: 1, fontFamily: serif, fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: 0.2 },
});
