import React from 'react';
import { View } from 'react-native';
import { FEELING_DOT } from '../constants/feeling';
import { Feeling } from '../types';
import { Icon, IconName } from './Icon';

// Pictogramme par ressenti : la forme porte l'information en plus de la couleur (vert et rouge
// se confondent pour un daltonien), coche = réussi, tiret = juste, croix = échec.
const FEELING_GLYPH: Record<Feeling, IconName> = { EASY: 'check', MEDIUM: 'minus', HARD: 'x' };

interface FeelingMarkProps {
  feeling: Feeling;
  size?: number;
}

/** Pastille de ressenti avec pictogramme (remplace `Dot` partout où un ressenti est affiché). */
export const FeelingMark: React.FC<FeelingMarkProps> = ({ feeling, size = 12 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: FEELING_DOT[feeling],
      alignItems: 'center',
      justifyContent: 'center',
    }}
    accessible={false}
    importantForAccessibility="no"
  >
    <Icon name={FEELING_GLYPH[feeling]} size={Math.round(size * 0.72)} color="#FFFFFF" strokeWidth={3.5} />
  </View>
);
