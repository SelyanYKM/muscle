import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { DashboardSheet } from '../components/DashboardSheet';
import { Icon } from '../components/Icon';
import { SPLIT_LETTERS, SPLIT_SUBTITLES } from '../constants/splits';
import { clearAllWorkoutLogs, getDashboardSummary, getExercisesForWorkout, getRecentLogs, getWorkouts } from '../database/db';
import { THEME } from '../theme';
import { Workout } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface SplitMeta {
  exerciseCount: number;
  daysSinceLastSession: number | null;
}

function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const past = new Date(y, m - 1, d);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayMidnight.getTime() - past.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

function formatLastSessionMeta(days: number | null): string {
  if (days === null) return 'Jamais fait';
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `il y a ${days} j`;
}

// Charge réelle (nb d'exercices du catalogue + dernière séance) par split, pour la méta
// affichée sur chaque carte et pour déterminer le split "à suivre" (le plus en retard).
function getSplitMeta(workouts: Workout[]): Record<number, SplitMeta> {
  const logs = getRecentLogs(500);
  const lastDateByWorkout = new Map<number, string>();
  for (const log of logs) {
    const existing = lastDateByWorkout.get(log.workoutId);
    if (!existing || log.date > existing) lastDateByWorkout.set(log.workoutId, log.date);
  }

  const meta: Record<number, SplitMeta> = {};
  for (const w of workouts) {
    const lastDate = lastDateByWorkout.get(w.id) || null;
    meta[w.id] = {
      exerciseCount: getExercisesForWorkout(w.id).length,
      daysSinceLastSession: lastDate ? daysSince(lastDate) : null,
    };
  }
  return meta;
}

// Le split "à suivre" : celui dont la dernière séance est la plus ancienne (jamais fait = prioritaire).
function getToFollowWorkoutId(workouts: Workout[], meta: Record<number, SplitMeta>): number | null {
  let candidate: number | null = null;
  let oldestDays = -1;
  for (const w of workouts) {
    const days = meta[w.id]?.daysSinceLastSession;
    if (days === null || days === undefined) return w.id; // jamais fait = le plus en retard possible
    if (days > oldestDays) {
      oldestDays = days;
      candidate = w.id;
    }
  }
  return candidate;
}

interface SplitSelectScreenProps {
  onSelectWorkout: (workoutId: number, workoutName: string) => void;
  onOpenHistory: () => void;
}

export const SplitSelectScreen: React.FC<SplitSelectScreenProps> = ({
  onSelectWorkout,
  onOpenHistory,
}) => {
  const workouts = getWorkouts();
  const dashboardSummary = getDashboardSummary();
  const splitMeta = getSplitMeta(workouts);
  const toFollowWorkoutId = getToFollowWorkoutId(workouts, splitMeta);

  const handleSelect = (wId: number, wName: string) => {
    triggerMediumHaptic();
    onSelectWorkout(wId, wName);
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
      <View style={styles.container}>
        {/* En-tête officiel mooscles */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/icon.png')}
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

        {/* Titre de sélection */}
        <View style={styles.stepTitleBox}>
          <Text style={styles.stepHeading}>Choisis ton split</Text>
          <Text style={styles.stepSubheading}>Quelle séance attaques-tu aujourd'hui ?</Text>
        </View>

        {/* 3 Cartes de Split P/P/L, qui se partagent tout l'espace restant jusqu'au tiroir */}
        <View style={styles.cardsContainer}>
          {workouts.map((w) => {
            const split = THEME.splits[w.id];
            const meta = splitMeta[w.id];
            const isToFollow = w.id === toFollowWorkoutId;

            return (
              <Pressable
                key={w.id}
                onPress={() => handleSelect(w.id, w.name)}
                style={({ pressed }) => [styles.splitCardWrap, pressed && styles.splitCardPressed]}
              >
                <LinearGradient
                  colors={split.gradient}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.splitCard}
                >
                  {/* Lettre en filigrane */}
                  <Text style={styles.watermarkLetter} numberOfLines={1}>
                    {SPLIT_LETTERS[w.id]}
                  </Text>

                  {/* Haut : nom + chip "À suivre" */}
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, { color: split.fg }]}>{w.name}</Text>
                    {isToFollow && (
                      <View style={styles.toFollowChip}>
                        <Text style={styles.toFollowChipText}>À suivre</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cardSubtitle, { color: split.fg }]} numberOfLines={1}>
                    {SPLIT_SUBTITLES[w.id]}
                  </Text>

                  {/* Bas : chip méta + bouton flèche */}
                  <View style={styles.cardBottomRow}>
                    <View style={[styles.cardMetaChip, { backgroundColor: split.chipBg }]}>
                      <Text style={[styles.cardMetaText, { color: split.fg }]}>
                        {meta.exerciseCount} exercices · {formatLastSessionMeta(meta.daysSinceLastSession)}
                      </Text>
                    </View>
                    <View style={[styles.arrowBtn, { backgroundColor: split.btnBg }]}>
                      <Icon name="arrow-right" size={20} color={split.btnFg} />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </View>
      </SafeAreaView>

      <DashboardSheet summary={dashboardSummary} />
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    // Marge basse suffisante pour que les cartes ne soient jamais cachées par la
    // feuille "Ton progrès" repliée (voir PEEK_HEIGHT dans DashboardSheet.tsx).
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandDot: {
    color: THEME.colors.accent,
  },
  brandSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  historyBtn: {
    height: 40,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 16,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  historyBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitleBox: {
    marginBottom: 22,
  },
  stepHeading: {
    fontFamily: THEME.fonts.serif,
    fontSize: 32,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.6,
  },
  stepSubheading: {
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  cardsContainer: {
    flex: 1,
    gap: 12,
  },
  splitCardWrap: {
    flex: 1,
  },
  splitCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  splitCard: {
    flex: 1,
    borderRadius: THEME.radius.sheet,
    padding: 22,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
  },
  watermarkLetter: {
    position: 'absolute',
    right: -6,
    bottom: -46,
    fontFamily: THEME.fonts.serif,
    fontSize: 190,
    color: 'rgba(255, 255, 255, 0.32)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  toFollowChip: {
    backgroundColor: THEME.colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  toFollowChipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardMetaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
  },
  cardMetaText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
