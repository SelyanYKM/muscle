import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { clearAllWorkoutLogs, getRecentLogs, getWorkouts } from '../database/db';
import { THEME } from '../theme';
import { Workout } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface RecentSessionSummary {
  date: string;
  workoutId: number;
  workoutName: string;
  totalSets: number;
  totalVolume: number;
  /** Exercices de cette séance (ordre d'apparition), pour relancer avec les mêmes. */
  exerciseIds: number[];
}

// Regroupe les logs récents par séance (date + programme) et ne garde que les 3 dernières.
// getRecentLogs renvoie déjà les entrées de la plus récente à la plus ancienne, donc les 3
// premières séances rencontrées sont les 3 plus récentes.
function getRecentSessionSummaries(workouts: Workout[]): RecentSessionSummary[] {
  const rawLogs = getRecentLogs(60);
  const sessionMap = new Map<string, RecentSessionSummary>();

  for (const log of rawLogs) {
    const key = `${log.date}_${log.workoutId}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        date: log.date,
        workoutId: log.workoutId,
        workoutName: workouts.find((w) => w.id === log.workoutId)?.name || 'Séance',
        totalSets: 0,
        totalVolume: 0,
        exerciseIds: [],
      });
    }
    const session = sessionMap.get(key)!;
    session.totalSets += 1;
    session.totalVolume += log.weight * log.repsDone;
    if (!session.exerciseIds.includes(log.exerciseId)) {
      session.exerciseIds.push(log.exerciseId);
    }
  }

  return Array.from(sessionMap.values()).slice(0, 3);
}

function formatRecentSessionDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

interface SplitSelectScreenProps {
  onSelectWorkout: (workoutId: number, workoutName: string) => void;
  onResumeWorkout: (workoutId: number, workoutName: string, exerciseIds: number[]) => void;
  onOpenHistory: () => void;
}

export const SplitSelectScreen: React.FC<SplitSelectScreenProps> = ({
  onSelectWorkout,
  onResumeWorkout,
  onOpenHistory,
}) => {
  const workouts = getWorkouts();
  const recentSessions = getRecentSessionSummaries(workouts);

  const handleResume = (workoutId: number, workoutName: string, exerciseIds: number[]) => {
    triggerMediumHaptic();
    onResumeWorkout(workoutId, workoutName, exerciseIds);
  };

  const handleSelect = (wId: number, wName: string) => {
    triggerMediumHaptic();
    onSelectWorkout(wId, wName);
  };

  const getSplitDetails = (id: number) => {
    if (id === 1) {
      return {
        letter: 'P',
        subtitle: 'Pectoraux • Épaules • Triceps',
        focus: 'Poussée & Développés',
        exercisesCount: '5 exos cibles',
        gradient: ['#F4C3AE', '#E28B72'] as [string, string],
      };
    } else if (id === 2) {
      return {
        letter: 'P',
        subtitle: 'Dos • Arrière d’épaules • Biceps',
        focus: 'Tirages & Épaisseur',
        exercisesCount: '5 exos cibles',
        gradient: ['#E8D3F5', '#C080E0'] as [string, string],
      };
    } else {
      return {
        letter: 'L',
        subtitle: 'Quadriceps • Ischios • Mollets',
        focus: 'Force & Volume bas du corps',
        exercisesCount: '5 exos cibles',
        gradient: ['#DCE9F2', '#8FB9D0'] as [string, string],
      };
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* En-tête officiel mooscles */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/mooscles_logo.jpg')}
              style={styles.brandLogo}
            />
            <View>
              <Text style={styles.brandTitle}>
                mooscles<Text style={styles.brandDot}>.</Text>
              </Text>
              <Text style={styles.brandSubtitle}>Surcharge progressive PPL</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => {
              triggerLightHaptic();
              onOpenHistory();
            }}
            onLongPress={() => {
              triggerWarningHaptic();
              Alert.alert(
                "Effacer l'historique ?",
                "Toutes les séances enregistrées seront définitivement supprimées.",
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Tout effacer',
                    style: 'destructive',
                    onPress: () => {
                      clearAllWorkoutLogs();
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.historyBtnText}>Historique</Text>
          </TouchableOpacity>
        </View>

        {/* Bandeau "Reprendre" : accès rapide aux 3 dernières séances */}
        {recentSessions.length > 0 && (
          <View style={styles.resumeSection}>
            <Text style={styles.resumeSectionLabel}>REPRENDRE UNE SÉANCE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resumeRow}
            >
              {recentSessions.map((session) => (
                <View key={`${session.date}_${session.workoutId}`} style={styles.resumeCard}>
                  <Text style={styles.resumeCardDate}>{formatRecentSessionDate(session.date)}</Text>
                  <Text style={styles.resumeCardTitle} numberOfLines={1}>
                    {session.workoutName}
                  </Text>
                  <Text style={styles.resumeCardMeta}>
                    {session.totalSets} séries • {Math.round(session.totalVolume)} kg vol.
                  </Text>
                  <TouchableOpacity
                    style={styles.resumeCardBtn}
                    onPress={() => handleResume(session.workoutId, session.workoutName, session.exerciseIds)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.resumeCardBtnText}>Relancer</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Titre de sélection d'étape */}
        <View style={styles.stepTitleBox}>
          <Text style={styles.stepNumberBadge}>ÉTAPE 1 SUR 2</Text>
          <Text style={styles.stepHeading}>Choisis ton split</Text>
          <Text style={styles.stepSubheading}>Quelle séance attaques-tu aujourd'hui ?</Text>
        </View>

        {/* 3 Cartes de Split P/P/L */}
        <View style={styles.cardsContainer}>
          {workouts.map((w) => {
            const details = getSplitDetails(w.id);

            return (
              <TouchableOpacity
                key={w.id}
                style={styles.splitCard}
                onPress={() => handleSelect(w.id, w.name)}
                activeOpacity={0.85}
              >
                {/* Badge lettre majuscule P / P / L */}
                <LinearGradient
                  colors={details.gradient}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.letterBadge}
                >
                  <Text style={styles.letterBadgeText}>{details.letter}</Text>
                </LinearGradient>

                {/* Détails du split */}
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>{w.name}</Text>
                    <Text style={styles.chevron}>→</Text>
                  </View>

                  <Text style={styles.cardSubtitle}>{details.subtitle}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaTag}>
                      <Text style={styles.metaTagText}>{details.focus}</Text>
                    </View>
                    <Text style={styles.metaCount}>{details.exercisesCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandDot: {
    color: THEME.colors.accent,
  },
  brandSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  historyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  historyBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  resumeSection: {
    marginBottom: 22,
  },
  resumeSectionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  resumeRow: {
    gap: 10,
    paddingRight: 4,
  },
  resumeCard: {
    width: 168,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  resumeCardDate: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resumeCardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  resumeCardMeta: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  resumeCardBtn: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  resumeCardBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.accent,
  },
  stepTitleBox: {
    marginBottom: 20,
  },
  stepNumberBadge: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accent,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  stepHeading: {
    fontFamily: THEME.fonts.serif,
    fontSize: 27,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  stepSubheading: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  cardsContainer: {
    gap: 14,
  },
  splitCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  letterBadge: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBadgeText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.accent,
  },
  cardSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaTag: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  metaTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  metaCount: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
});
