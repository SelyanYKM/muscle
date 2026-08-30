import React from 'react';
import {
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
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Badge et Titre */}
      <View style={styles.victoryHeader}>
        <Text style={styles.trophyIcon}>⚡</Text>
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
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>ENREGISTRER & RETOUR</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
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
  trophyIcon: {
    fontSize: 38,
    marginBottom: 6,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  exerciseCardFull: {
    borderColor: THEME.colors.feelingEasyBorder,
  },
  exerciseCardPartial: {
    borderColor: THEME.colors.cardBorder,
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
    backgroundColor: THEME.colors.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: THEME.colors.accentTextDark,
    letterSpacing: 0.5,
  },
});
