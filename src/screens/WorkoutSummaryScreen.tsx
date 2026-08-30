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
      {/* Badge et Titre Victoire */}
      <View style={styles.victoryHeader}>
        <Text style={styles.trophyIcon}>⚡</Text>
        <Text style={styles.victoryTitle}>SÉANCE TERMINÉE !</Text>
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
      <Text style={styles.sectionHeading}>BILAN DE SURCHARGE PROGRESSIVE</Text>

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
                      ? '🔥 AUGMENTATION'
                      : isPartial
                      ? '⚡ INTERMÉDIAIRE'
                      : isDeload
                      ? '🔄 DELOAD'
                      : '💪 MAINTIEN'}
                  </Text>
                </View>
              </View>

              {/* Résumé des séries réalisées */}
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
                <Text style={styles.nextSessionLabel}>PROCHAINE SÉANCE :</Text>
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
    marginBottom: 20,
  },
  trophyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  victoryTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  workoutSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.oceanMist,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  statBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.limeCream,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  exercisesList: {
    gap: 12,
    marginBottom: 26,
  },
  exerciseCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  exerciseCardFull: {
    borderColor: THEME.colors.emerald,
  },
  exerciseCardPartial: {
    borderColor: THEME.colors.oceanMist,
  },
  exerciseCardDeload: {
    borderColor: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  verdictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: THEME.colors.cardInner,
  },
  verdictBadgeFull: {
    backgroundColor: 'rgba(118, 200, 147, 0.2)',
  },
  verdictBadgePartial: {
    backgroundColor: 'rgba(82, 182, 154, 0.2)',
  },
  verdictBadgeDeload: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  verdictBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  verdictBadgeTextFull: {
    color: THEME.colors.emerald,
  },
  verdictBadgeTextPartial: {
    color: THEME.colors.limeCream,
  },
  verdictBadgeTextDeload: {
    color: '#F87171',
  },
  setsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  setResultBadge: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setResultText: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  nextSessionBox: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  nextSessionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  nextWeightsText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.limeCream,
    marginBottom: 4,
  },
  planMessageText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  closeButton: {
    backgroundColor: THEME.colors.limeCream,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: THEME.colors.limeCream,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#081119',
    letterSpacing: 0.5,
  },
});
