import React from 'react';
import { View } from 'react-native';
import { FEELING_DOT } from '../constants/feeling';
import { Feeling } from '../types';

interface FeelingMarkProps {
  feeling: Feeling;
  size?: number;
}

/**
 * Pastille de ressenti. La forme porte l'information en plus de la couleur (vert et rouge se
 * confondent pour un daltonien) : point plein = réussi (ou juste), anneau vide = échec.
 * Remplace `Dot` partout où un ressenti est affiché.
 */
export const FeelingMark: React.FC<FeelingMarkProps> = ({ feeling, size = 7 }) => {
  const color = FEELING_DOT[feeling];
  const isFailure = feeling === 'HARD';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isFailure ? 'transparent' : color,
        borderWidth: isFailure ? (size >= 8 ? 2 : 1.75) : 0,
        borderColor: color,
      }}
      accessible={false}
      importantForAccessibility="no"
    />
  );
};
