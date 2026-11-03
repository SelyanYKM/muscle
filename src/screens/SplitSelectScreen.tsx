import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSheet } from '../components/DashboardSheet';
import { Icon } from '../components/Icon';
import { SPLIT_LETTERS, SPLIT_SUBTITLES } from '../constants/splits';
import {
  dismissRestBannerForToday,
  getDashboardSummary,
  getExercisesForWorkout,
  getRecentLogs,
  getWorkouts,
  isRestBannerDismissedToday,
} from '../database/db';
import { THEME } from '../theme';
import { Workout } from '../types';
import { parseLocalDate } from '../utils/format';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

interface SplitMeta {
  exerciseCount: number;
  daysSinceLastSession: number | null;
}

function daysSince(dateStr: string): number {
  const past = parseLocalDate(dateStr);
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

// Même information, rédigée pour le lecteur d'écran ("il y a 5 jours" plutôt que "5 j").
function formatLastSessionMetaA11y(days: number | null): string {
  if (days === null) return 'jamais fait';
  if (days === 0) return "fait aujourd'hui";
  if (days === 1) return 'fait hier';
  return `fait il y a ${days} jours`;
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
  // Tiroir "Ton progrès" déplié : le reste de l'écran est masqué au lecteur d'écran.
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);
  // Incrémenté quand un réglage du tiroir change (objectif de la semaine) : le résumé, calculé
  // à chaque rendu, est alors recalculé.
  const [, setDataVersion] = useState(0);
  const [isRestBannerDismissed, setIsRestBannerDismissed] = useState(isRestBannerDismissedToday);
  // Marge du haut : la zone sûre du téléphone (barre d'état, encoche) + un peu d'air, sans
  // descendre sous les 52 px d'avant sur un écran classique.
  const insets = useSafeAreaInsets();
  const restAdvice = isRestBannerDismissed ? null : dashboardSummary.restAdvice;

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
      <SafeAreaView
        edges={['left', 'right']}
        style={styles.safeArea}
        importantForAccessibility={isDashboardExpanded ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={isDashboardExpanded}
      >
      <View style={[styles.container, { paddingTop: Math.max(52, insets.top + 20) }]}>
        {/* En-tête officiel mooscles */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.brandLogo}
              accessible={false}
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
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityLabel="Historique"
            onPress={() => {
              triggerLightHaptic();
              onOpenHistory();
            }}
            // L'effacement de l'historique n'est plus caché ici (appui long) : il a son propre
            // bouton, visible, en bas de l'écran Historique.
            activeOpacity={0.8}
          >
            <Text style={styles.historyBtnText}>Historique</Text>
          </TouchableOpacity>
        </View>

        {/* Titre de sélection ; le bandeau de repos remplace la phrase d'accroche quand un signal
            est là (objectif atteint, jours d'affilée, énergie en baisse). Il ne bloque rien. */}
        <View style={[styles.stepTitleBox, restAdvice && styles.stepTitleBoxWithBanner]}>
          <Text style={styles.stepHeading} accessibilityRole="header">Choisis ton split</Text>
          {restAdvice ? (
            <View style={styles.restBanner}>
              <View
                style={styles.restBannerMain}
                accessible
                accessibilityLabel={`${restAdvice.trainedToday ? 'Repos conseillé demain' : 'Repos conseillé aujourd’hui'} : ${restAdvice.reasons.join(', ')}`}
              >
                <View style={styles.restBannerIcon}>
                  <Icon name="moon" size={20} color={THEME.colors.textPrimary} />
                </View>
                <View style={styles.restBannerTextCol}>
                  <Text style={styles.restBannerTitle}>
                    {restAdvice.trainedToday ? 'Repos conseillé demain' : 'Repos conseillé aujourd’hui'}
                  </Text>
                  <Text style={styles.restBannerReasons} numberOfLines={2}>
                    {restAdvice.reasons.join(' · ')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.restBannerClose}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={() => {
                  triggerLightHaptic();
                  dismissRestBannerForToday();
                  setIsRestBannerDismissed(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Masquer le conseil de repos pour aujourd’hui"
              >
                <Icon name="x" size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.stepSubheading}>Quelle séance attaques-tu aujourd'hui ?</Text>
          )}
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
                accessibilityRole="button"
                accessibilityLabel={`${w.name}${isToFollow ? ', à suivre' : ''}. ${SPLIT_SUBTITLES[w.id].replace(/ • /g, ', ')}. ${meta.exerciseCount} exercices, ${formatLastSessionMetaA11y(meta.daysSinceLastSession)}`}
                accessibilityHint="Démarre la séance"
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
                  <Text style={styles.watermarkLetter} numberOfLines={1} accessible={false} importantForAccessibility="no">
                    {SPLIT_LETTERS[w.id]}
                  </Text>

                  {/* Haut : nom + chip "À suivre" */}
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, { color: split.fg }]}>{w.name}</Text>
                    {isToFollow && (
                      // Mêmes couleurs que le bouton flèche, pour rester visible sur chaque carte.
                      <View style={[styles.toFollowChip, { backgroundColor: split.btnBg }]}>
                        <Text style={[styles.toFollowChipText, { color: split.btnFg }]}>À suivre</Text>
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

      <DashboardSheet
        summary={dashboardSummary}
        onExpandedChange={setIsDashboardExpanded}
        onDataChange={() => setDataVersion((v) => v + 1)}
      />
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
    // Marge basse : au-delà de ne pas cacher les cartes sous la feuille "Ton progrès" repliée
    // (PEEK_HEIGHT = 108 dans DashboardSheet.tsx), laisse une vraie zone morte au doigt entre le
    // bas de la carte Legs et le haut du tiroir — sans ça (paddingBottom trop proche de
    // PEEK_HEIGHT) un tap visant le tiroir touchait la carte juste au-dessus.
    paddingBottom: 148,
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
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
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
  },
  stepTitleBox: {
    marginBottom: 22,
  },
  // Avec le bandeau, l'en-tête gagne en hauteur : on resserre pour laisser la place aux cartes.
  stepTitleBoxWithBanner: {
    marginBottom: 14,
  },
  stepHeading: {
    fontFamily: THEME.fonts.serif,
    fontSize: 32,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.6,
  },
  restBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  restBannerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.splits[1].tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restBannerTextCol: {
    flex: 1,
  },
  restBannerTitle: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  restBannerReasons: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  restBannerClose: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSubheading: {
    fontFamily: THEME.fonts.sansMedium,
    fontSize: 14,
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
    paddingHorizontal: 22,
    // 18 en vertical (et pas 22) : les trois cartes tiennent aussi quand le bandeau de repos est affiché.
    paddingVertical: 18,
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
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
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
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
