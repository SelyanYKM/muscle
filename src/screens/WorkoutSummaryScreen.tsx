import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { THEME } from '../theme';
import { NextSessionPlan, SetResult } from '../types';

interface ExerciseSummaryItem {
  exerciseName: string;
  plan: NextSessionPlan;
  results: SetResult[];
}

interface WorkoutSummaryProps {
  summary: {
    workoutName: string;
    durationMinutes: number;
    totalVolume: number;
    exerciseSummaries: ExerciseSummaryItem[];
  };
  onClose: () => void;
}

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryProps> = ({
  summary,
  onClose,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Badge et Titre */}
        <View style={styles.victoryHeader}>
          <LinearGradient
            colors={['#F4C3AE', '#E28B72']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.trophyCircle}
          >
            <Text style={styles.trophyIcon}>⚡</Text>
          </LinearGradient>
          <Text style={styles.victoryTitle}>SÉANCE TERMINÉE</Text>
          <Text style={styles.workoutSubtitle}>{summary.workoutName}</Text>
        </View>

        {/* Cartes Métriques Clés */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DURÉE</Text>
            <Text style={styles.statValue}>
              {summary.durationMinutes} <Text style={styles.statUnit}>min</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>VOLUME TOTAL</Text>
            <Text style={styles.statValue}>
              {Math.round(summary.totalVolume)} <Text style={styles.statUnit}>kg</Text>
            </Text>
          </View>
        </View>

        {/* Section Calculateur de Surcharge Progressive */}
        <Text style={styles.sectionHeading}>BILAN DE SURCHARGE</Text>

        <View style={styles.exercisesList}>
          {summary.exerciseSummaries.map((item, index) => {
            const isFull = item.plan.progressionVerdict === 'FULL_INCREASE';
            const isPartial = item.plan.progressionVerdict === 'PARTIAL_INCREASE';
            const isDeload = item.plan.progressionVerdict === 'DELOAD';

            return (
              <View
                key={index}
                style={[
                  styles.exerciseCard,
                  isFull && styles.exerciseCardFull,
                  isPartial && styles.exerciseCardPartial,
                  isDeload && styles.exerciseCardDeload,
                ]}
              >
                {/* En-tête de l'exercice */}
                <View style={styles.cardHeader}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {item.exerciseName}
                  </Text>
                  <View
                    style={[
                      styles.verdictBadge,
                      isFull && styles.verdictBadgeFull,
                      isPartial && styles.verdictBadgePartial,
                      isDeload && styles.verdictBadgeDeload,
                    ]}
                  >
                    <Text
                      style={[
                        styles.verdictBadgeText,
                        isFull && styles.verdictBadgeTextFull,
                        isPartial && styles.verdictBadgeTextPartial,
                        isDeload && styles.verdictBadgeTextDeload,
                      ]}
                    >
                      {isFull
                        ? 'AUGMENTATION'
                        : isPartial
                        ? 'INTERMÉDIAIRE'
                        : isDeload
                        ? 'DELOAD'
                        : 'MAINTIEN'}
                    </Text>
                  </View>
                </View>

                {/* Résumé des séries */}
                <View style={styles.setsSummaryRow}>
                  {item.results.map((res, rIdx) => (
                    <View key={rIdx} style={styles.setResultBadge}>
                      <Text style={styles.setResultText}>
                        S{res.setNumber}: {res.repsDone} reps @ {res.weight}kg{' '}
                        {res.feeling === 'EASY' ? '🟢' : res.feeling === 'MEDIUM' ? '🟠' : '🔴'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Instruction et Prochaine charge */}
                <View style={styles.nextSessionBox}>
                  <Text style={styles.nextSessionLabel}>PROCHAINE SÉANCE</Text>
                  <Text style={styles.nextWeightsText}>
                    {item.plan.weightsPerSet.join(' / ')} kg
                  </Text>
                  <Text style={styles.planMessageText}>{item.plan.message}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Bouton de Fermeture */}
        <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
          <LinearGradient
            colors={['#F4C3AE', '#E28B72']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>ENREGISTRER & RETOUR</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 40,
  },
  victoryHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  trophyCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#E28B72',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  trophyIcon: {
    fontSize: 24,
  },
  victoryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  workoutSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  exercisesList: {
    gap: 10,
    marginBottom: 22,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(28, 28, 30, 0.08)',
  },
  exerciseCardFull: {
    borderColor: THEME.colors.feelingEasyBorder,
  },
  exerciseCardPartial: {
    borderColor: 'rgba(28, 28, 30, 0.08)',
  },
  exerciseCardDeload: {
    borderColor: THEME.colors.feelingHardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  verdictBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.cardInner,
  },
  verdictBadgeFull: {
    backgroundColor: THEME.colors.feelingEasyBg,
  },
  verdictBadgePartial: {
    backgroundColor: THEME.colors.cardInner,
  },
  verdictBadgeDeload: {
    backgroundColor: THEME.colors.feelingHardBg,
  },
  verdictBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  verdictBadgeTextFull: {
    color: THEME.colors.feelingEasyBorder,
  },
  verdictBadgeTextPartial: {
    color: THEME.colors.textPrimary,
  },
  verdictBadgeTextDeload: {
    color: THEME.colors.feelingHardBorder,
  },
  setsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  setResultBadge: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  setResultText: {
    fontSize: 10,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  nextSessionBox: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  nextSessionLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  nextWeightsText: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.colors.accent,
    marginBottom: 2,
  },
  planMessageText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#E28B72',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: 0.5,
  },
});
