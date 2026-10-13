import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlateBreakdownPerSide } from '../engine/plateCalculator';
import { THEME } from '../theme';

interface PlateBreakdownProps {
  totalWeight: number;
  baseWeight?: number;
  category: 'HAMMER_STRENGTH' | 'FREE_WEIGHT';
}

// Taille fixe par type de disque (pas une formule : des valeurs de design figées), plus
// lourd = plus haut. Barres verticales (vue de côté, comme sur une barre réelle), rayon 4,
// couleurs olympiques reprises de plateCalculator.ts.
const PLATE_DIMENSIONS: Record<number, { width: number; height: number; border?: string }> = {
  20: { width: 14, height: 72 },
  10: { width: 12, height: 60 },
  5: { width: 10, height: 46 },
  2.5: { width: 8, height: 36, border: '#D0D5DD' },
  1.25: { width: 7, height: 28 },
};

function formatWeightFr(w: number): string {
  return w % 1 === 0 ? String(w) : String(w).replace('.', ',');
}

export const PlateBreakdown: React.FC<PlateBreakdownProps> = ({ totalWeight, baseWeight = 0, category }) => {
  const plates = getPlateBreakdownPerSide(totalWeight, baseWeight);
  const weightToLoad = Math.max(0, totalWeight - baseWeight);
  const weightPerSide = Math.round((weightToLoad / 2) * 100) / 100;
  const isFreeWeight = category === 'FREE_WEIGHT';

  const summaryText = plates.map((p) => `${p.count} × ${formatWeightFr(p.weight)}`).join(' + ');

  return (
    <View style={styles.container}>
      <View style={styles.hairline} />

      <View style={styles.row}>
        {plates.length === 0 ? (
          <Text style={styles.emptyText}>{isFreeWeight ? 'Barre à vide (20 kg)' : 'Machine à vide (0 kg)'}</Text>
        ) : (
          <View style={styles.platesRow}>
            <View style={styles.sleeve} />
            {plates.map((p) => {
              const dim = PLATE_DIMENSIONS[p.weight] || { width: 28, height: 7 };
              return (
                <View
                  key={p.weight}
                  style={[
                    styles.plateBar,
                    {
                      width: dim.width,
                      height: dim.height,
                      backgroundColor: p.color,
                      borderWidth: dim.border ? 1 : 0,
                      borderColor: dim.border,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        <View style={styles.valueCol}>
          <Text style={styles.valueLabel}>PAR CÔTÉ</Text>
          <Text style={styles.valueText}>{formatWeightFr(weightPerSide)} kg</Text>
          {plates.length > 0 && (
            <Text style={styles.summaryText} numberOfLines={1}>
              {summaryText}
              {isFreeWeight && ' · barre 20 kg'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  hairline: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  platesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  sleeve: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#B7B4BD',
  },
  plateBar: {
    borderRadius: 4,
  },
  valueCol: {
    alignItems: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
  },
  valueLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(242, 246, 252, 0.65)',
    letterSpacing: 0.6,
  },
  valueText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    color: THEME.colors.textOnDark,
  },
  summaryText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(242, 246, 252, 0.72)',
    marginTop: 1,
    maxWidth: '100%',
  },
  emptyText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: 'rgba(242, 246, 252, 0.55)',
    fontStyle: 'italic',
  },
});
