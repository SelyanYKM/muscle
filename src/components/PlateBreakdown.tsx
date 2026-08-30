import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlateBreakdownPerSide } from '../engine/plateCalculator';
import { THEME } from '../theme';

interface PlateBreakdownProps {
  totalWeight: number;
  baseWeight?: number;
  category: 'HAMMER_STRENGTH' | 'FREE_WEIGHT';
}

export const PlateBreakdown: React.FC<PlateBreakdownProps> = ({
  totalWeight,
  baseWeight = 0,
  category,
}) => {
  const plates = getPlateBreakdownPerSide(totalWeight, baseWeight);
  const weightToLoad = Math.max(0, totalWeight - baseWeight);
  const weightPerSide = weightToLoad / 2;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>CHARGEMENT PAR CÔTÉ</Text>
        <Text style={styles.subtext}>
          {category === 'FREE_WEIGHT' ? `Barre 20kg + ${weightPerSide}kg/côté` : `${weightPerSide}kg/côté`}
        </Text>
      </View>

      {plates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {category === 'FREE_WEIGHT' ? 'Barre à vide (20 kg)' : 'Machine à vide (0 kg)'}
          </Text>
        </View>
      ) : (
        <View style={styles.platesRow}>
          {plates.map((p, idx) => (
            <View
              key={`${p.weight}-${idx}`}
              style={[
                styles.plateBadge,
                { backgroundColor: p.color },
                p.textColor === '#0F172A' ? styles.lightPlateBorder : null,
              ]}
            >
              {p.count > 1 && (
                <View style={styles.multiplierBadge}>
                  <Text style={styles.multiplierText}>{p.count}×</Text>
                </View>
              )}
              <Text style={[styles.plateWeightText, { color: p.textColor }]}>
                {p.weight} <Text style={styles.unitText}>kg</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  subtext: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  platesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  plateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  lightPlateBorder: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  multiplierBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 4,
  },
  multiplierText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  plateWeightText: {
    fontSize: 13,
    fontWeight: '800',
  },
  unitText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
});
