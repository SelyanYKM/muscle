import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlateBreakdownPerSide } from '../engine/plateCalculator';

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
          {category === 'FREE_WEIGHT' ? `(Barre 20 kg + ${weightPerSide} kg/côté)` : `(${weightPerSide} kg/côté)`}
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  subtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  platesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  plateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  lightPlateBorder: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  multiplierBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
  },
  multiplierText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  plateWeightText: {
    fontSize: 14,
    fontWeight: '800',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
