import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { NextSessionPlan, SetResult } from '../types';
import { triggerLightHaptic } from '../utils/haptics';

interface WorkoutSummaryScreenProps {
  summary: {
    workoutName: string;
    durationMinutes: number;
    totalVolume: number;
    exerciseSummaries: {
      exerciseName: string;
      plan: NextSessionPlan;
      results: SetResult[];
    }[];
  };
  onClose: () => void;
}

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({
  summary,
  onClose,
}) => {
  const getFeelingEmoji = (feeling: 'EASY' | 'MEDIUM' | 'HARD') => {
    if (feeling === 'EASY') return '🟢';
    if (feeling === 'MEDIUM') return '🟠';
    return '🔴';
  };

  const getVerdictBadge = (verdict: NextSessionPlan['progressionVerdict']) => {
    switch (verdict) {
      case 'FULL_INCREASE':
        return { text: '🔥 +2.5 KG', style: styles.badgeFull, textStyle: styles.badgeFullText };
      case 'PARTIAL_INCREASE':
        return { text: '⚡ S1 +2.5 KG', style: styles.badgePartial, textStyle: styles.badgePartialText };
      case 'DELOAD':
        return { text: '🔄 DELOAD -10%', style: styles.badgeDeload, textStyle: styles.badgeDeloadText };
      default:
        return { text: '🛡️ MAINTIEN', style: styles.badgeMaintain, textStyle: styles.badgeMaintainText };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Célébration & Titre */}
      <View style={styles.celebrationBox}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={styles.celebrationTitle}>Séance {summary.workoutName} Validée !</Text>
        <Text style={styles.celebrationSub}>
          Excellent travail. Les charges pour ta prochaine séance ont été recalculées automatiquement.
        </Text>
      </View>

      {/* Statistiques Clés */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>DURÉE</Text>
          <Text style={styles.statValue}>
            {summary.durationMinutes} <Text style={styles.statUnit}>min</Text>
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>VOLUME TOTAL</Text>
          <Text style={styles.statValue}>
            {summary.totalVolume.toLocaleString('fr-FR')} <Text style={styles.statUnit}>kg</Text>
          </Text>
        </View>
      </View>

      {/* Liste des progressions calculées pour la séance N+1 */}
      <Text style={styles.sectionHeading}>NOUVELLES CHARGES (SÉANCE N+1)</Text>

      <View style={styles.summaryList}>
        {summary.exerciseSummaries.map((item, idx) => {
          const badge = getVerdictBadge(item.plan.progressionVerdict);
          const feelingsStr = item.results.map((r) => `${getFeelingEmoji(r.feeling)} ${r.repsDone} reps`).join('  •  ');
          const nextWeightsStr = item.plan.weightsPerSet.join(' / ') + ' kg';

          return (
            <View key={idx} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {item.exerciseName}
                </Text>
                <View style={[styles.badgeBase, badge.style]}>
                  <Text style={[styles.badgeTextBase, badge.textStyle]}>{badge.text}</Text>
                </View>
              </View>

              {/* Historique des séries de la séance */}
              <View style={styles.feelingsRow}>
                <Text style={styles.feelingsText}>{feelingsStr}</Text>
              </View>

              {/* Message de décision de l'algorithme */}
              <View style={styles.verdictBox}>
                <Text style={styles.verdictMessage}>{item.plan.message}</Text>
                <Text style={styles.nextWeightsText}>Poids prévu : {nextWeightsStr}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Bouton de retour */}
      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => {
          triggerLightHaptic();
          onClose();
        }}
      >
        <Text style={styles.doneButtonText}>Enregistrer & Retour au Menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  celebrationBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  celebrationEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  celebrationTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  celebrationSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#38BDF8',
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryList: {
    gap: 12,
    marginBottom: 30,
  },
  exerciseCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextBase: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeFull: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  badgeFullText: {
    color: '#34D399',
  },
  badgePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgePartialText: {
    color: '#FBBF24',
  },
  badgeMaintain: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  badgeMaintainText: {
    color: '#38BDF8',
  },
  badgeDeload: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  badgeDeloadText: {
    color: '#F87171',
  },
  feelingsRow: {
    marginBottom: 10,
  },
  feelingsText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  verdictBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  verdictMessage: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  nextWeightsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 4,
  },
  doneButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
});
