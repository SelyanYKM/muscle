import React from 'react';
import { View } from 'react-native';

interface DotProps {
  color: string;
  size?: number;
}

/** Pastille pleine, remplace les émojis de ressenti (🟢🟠🔴). */
export const Dot: React.FC<DotProps> = ({ color, size = 8 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
);
