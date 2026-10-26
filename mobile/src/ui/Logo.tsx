import { Image } from 'react-native';

const source = require('../../assets/logo.png');
const RATIO = 190 / 199;

export function Logo({ height = 120 }: { height?: number }) {
  return (
    <Image
      source={source}
      style={{ height, width: height * RATIO, alignSelf: 'center' }}
      resizeMode="contain"
      accessibilityLabel="AZ Trockenbau & Innenausbau"
    />
  );
}
