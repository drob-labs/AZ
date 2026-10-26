import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '../lib/avatar';
import { colors, serif } from './theme';

interface Props {
  path: string | null | undefined;
  first: string;
  last: string;
  size: number;
}

export function Avatar({ path, first, last, size }: Props) {
  const url = avatarUrl(path);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={[styles.img, box]} accessibilityLabel={`${first} ${last}`} />;
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.primarySoft },
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  initials: { fontFamily: serif, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
});
