import Svg, { Path } from 'react-native-svg';
import { ICONS, type IconName } from './iconPaths';

interface Props {
  name: IconName;
  color: string;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, color, size = 24, filled = false }: Props) {
  const paths = filled ? ICONS[name].fill : ICONS[name].regular;
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}
