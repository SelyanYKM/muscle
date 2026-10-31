import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type IconName = 'arrow-right' | 'arrow-left' | 'x' | 'chevron-down' | 'check' | 'minus';

// Tracés Lucide (viewBox 24x24), repris tels quels du handoff design v2.
const ICON_PATHS: Record<IconName, string[]> = {
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'chevron-down': ['m6 9 6 6 6-6'],
  check: ['M20 6 9 17l-5-5'],
  minus: ['M5 12h14'],
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = '#00296B', strokeWidth }) => {
  // "check" est un peu plus épais que les autres dans le handoff (2.6 vs 2.2).
  const sw = strokeWidth ?? (name === 'check' ? 2.6 : 2.2);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICON_PATHS[name].map((d, idx) => (
        <Path key={idx} d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
};
