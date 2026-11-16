import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'arrow-right'
  | 'arrow-left'
  | 'x'
  | 'chevron-down'
  | 'check'
  | 'moon'
  | 'trending-up'
  | 'trending-down'
  | 'plus'
  | 'pause'
  | 'play'
  | 'timer'
  | 'trash'
  | 'swap'
  | 'lock'
  | 'target';

// Tracés Lucide (viewBox 24x24), repris tels quels du handoff design v2.
const ICON_PATHS: Record<IconName, string[]> = {
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'chevron-down': ['m6 9 6 6 6-6'],
  check: ['M20 6 9 17l-5-5'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  'trending-up': ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  'trending-down': ['m22 17-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  pause: ['M8 5h2v14H8z', 'M14 5h2v14h-2z'],
  play: ['M7 4.5v15l12.5-7.5z'],
  timer: ['M10 2h4', 'm12 14 3-3', 'M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
  swap: ['M8 3 4 7l4 4', 'M4 7h16', 'm16 21 4-4-4-4', 'M20 17H4'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  // Rendues via SHAPE_ICONS ci-dessous (rect/cercles, pas que des tracés) : jamais lues.
  lock: [],
  target: [],
};

// Tracés remplis de la couleur du trait (par index), plus lisibles en petit : pause, lecture.
const FILLED_PATHS: Partial<Record<IconName, number[]>> = { pause: [0, 1], play: [0] };

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Icônes dont le tracé Lucide n'est pas qu'une suite de <Path> (rect, cercles) : rendues à part,
// avant la liste ICON_PATHS ci-dessus.
const SHAPE_ICONS: Partial<Record<IconName, (color: string, sw: number) => React.ReactNode>> = {
  // Collier de technique : cadenas fermé.
  lock: (color, sw) => (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth={sw} fill="none" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Série technique : trois cercles concentriques (vise le geste, pas la charge).
  target: (color, sw) => (
    <>
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} fill="none" />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={sw} fill="none" />
      <Circle cx="12" cy="12" r="2" stroke={color} strokeWidth={sw} fill="none" />
    </>
  ),
};

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = '#00296B', strokeWidth }) => {
  // "check" est un peu plus épais que les autres dans le handoff (2.6 vs 2.2).
  const sw = strokeWidth ?? (name === 'check' ? 2.6 : 2.2);

  const shape = SHAPE_ICONS[name];
  if (shape) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {shape(color, sw)}
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICON_PATHS[name].map((d, idx) => (
        <Path
          key={idx}
          d={d}
          stroke={color}
          fill={FILLED_PATHS[name]?.includes(idx) ? color : 'none'}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
};
