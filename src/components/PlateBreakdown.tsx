import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlateBreakdownPerSide } from '../engine/plateCalculator';
import { THEME } from '../theme';

interface PlateBreakdownProps {
  totalWeight: number;
  baseWeight?: number;
  category: 'HAMMER_STRENGTH' | 'FREE_WEIGHT';
  /** Variante claire sur texte (carte de série violette, fond sombre). */
  dark?: boolean;
}

export const PlateBreakdown: React.FC<PlateBreakdownProps> = ({
  totalWeight,
  baseWeight = 0,
  category,
  dark = false,
}) => {
  const plates = getPlateBreakdownPerSide(totalWeight, baseWeight);
  const weightToLoad = Math.max(0, totalWeight - baseWeight);
  const weightPerSide = weightToLoad / 2;

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, dark && styles.titleDark]}>CHARGEMENT PAR CÔTÉ</Text>
        <Text style={[styles.subtext, dark && styles.subtextDark]}>
          {category === 'FREE_WEIGHT' ? `Barre 20kg + ${weightPerSide}kg/côté` : `${weightPerSide}kg/côté`}
        </Text>
      </View>

      {plates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>
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
  containerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
  titleDark: {
    color: 'rgba(244, 237, 247, 0.6)',
  },
  subtext: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  subtextDark: {
    color: THEME.colors.textOnDark,
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
  emptyTextDark: {
    color: 'rgba(244, 237, 247, 0.5)',
  },
});
