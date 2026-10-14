import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Dot } from '../components/Dot';
import { Icon } from '../components/Icon';
import { SPLIT_SUBTITLES } from '../constants/splits';
import { saveSessionFeedback } from '../database/db';
import { THEME } from '../theme';
import { Feeling, ProgressionDecision, SessionStatus, SetResult } from '../types';
import { triggerLightHaptic } from '../utils/haptics';

interface ExerciseSummaryItem {
  exerciseName: string;
  decision: ProgressionDecision;
  results: SetResult[];
}

interface WorkoutSummaryProps {
  summary: {
    workoutId: number;
    workoutName: string;
    date: string;
    durationMinutes: number;
    totalVolume: number;
    exerciseSummaries: ExerciseSummaryItem[];
  };
  onClose: () => void;
}

const FEELING_SCALE = [1, 2, 3, 4, 5];

const STATUS_LABEL: Record<SessionStatus, string> = {
  EASY_SUCCESS: 'Réussie facile',
  SUCCESS: 'Réussie',
  PARTIAL: 'Partielle',
  FAILED: 'Ratée',
  CALIBRATION: 'Calibration',
  INCOMPLETE: 'Incomplète',
  RESUMED_AFTER_BREAK: 'Reprise',
};

// Pastille pleine (Dot) : couleurs "bordure", plus vives que le texte — cohérent avec la carte
// de séance en direct.
const FEELING_DOT: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyBorder,
  MEDIUM: THEME.colors.feelingMediumBorder,
  HARD: THEME.colors.feelingHardBorder,
};

function statusColors(status: SessionStatus) {
  if (status === 'EASY_SUCCESS' || status === 'SUCCESS') {
    return { bg: THEME.colors.feelingEasyBg, ink: THEME.colors.feelingEasyText };
  }
  if (status === 'PARTIAL') {
    return { bg: THEME.colors.feelingMediumBg, ink: THEME.colors.feelingMediumText };
  }
  if (status === 'FAILED') {
    return { bg: THEME.colors.feelingHardBg, ink: THEME.colors.feelingHardText };
  }
  return { bg: THEME.colors.cardInner, ink: THEME.colors.textSecondary };
}

function fmtKg(w: number): string {
  return w % 1 === 0 ? String(w) : String(w).replace('.', ',');
}

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryProps> = ({
  summary,
  onClose,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const split = THEME.splits[summary.workoutId];

  // Ressenti mental/physique + étirements : tout optionnel, saisi ici et jamais utilisé par le
  // moteur de progression (purement un journal pour l'utilisateur).
  const [physicalFeeling, setPhysicalFeeling] = useState<number | null>(null);
  const [mentalFeeling, setMentalFeeling] = useState<number | null>(null);
  const [stretched, setStretched] = useState(false);

  const handleClose = () => {
    if (physicalFeeling !== null || mentalFeeling !== null || stretched) {
      saveSessionFeedback(summary.date, summary.workoutId, physicalFeeling, mentalFeeling, stretched);
    }
    onClose();
  };

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

  const todayLabel = new Date()
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '.');

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[split.tint, THEME.colors.bg]}
        locations={[0, 0.5]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          gap: 20,
        }}
      >
        {/* Badge et Titre */}
        <View style={styles.victoryHeader}>
          <LinearGradient
            colors={split.gradient}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.trophyCircle}
          >
            <Icon name="check" size={30} color={split.fg} />
          </LinearGradient>
          <Text style={styles.victoryTitle}>Séance terminée</Text>
          <Text style={styles.workoutSubtitle}>{summary.workoutName} · {todayLabel}</Text>
        </View>

        {/* Bloc Statistiques */}
        <View style={styles.statsBlock}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{summary.durationMinutes}</Text>
            <Text style={styles.statUnit}>min</Text>
            <Text style={styles.statLabel}>DURÉE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{Math.round(summary.totalVolume).toLocaleString('fr-FR')}</Text>
            <Text style={styles.statUnit}>kg</Text>
            <Text style={styles.statLabel}>VOLUME</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>
              {summary.exerciseSummaries.reduce((acc, e) => acc + e.results.length, 0)}
            </Text>
            <Text style={styles.statUnit}>séries</Text>
            <Text style={styles.statLabel}>SÉRIES</Text>
          </View>
        </View>

        {/* Section Calculateur de Surcharge Progressive */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionHeading}>BILAN DE SURCHARGE</Text>

          <View style={{ gap: 12 }}>
            {summary.exerciseSummaries.map((item, index) => {
              const { bg, ink } = statusColors(item.decision.status);

              return (
                <View key={index} style={styles.exerciseCard}>
                  {/* En-tête de l'exercice */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {item.exerciseName}
                    </Text>
                    <View style={[styles.verdictBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.verdictBadgeText, { color: ink }]}>
                        {STATUS_LABEL[item.decision.status]}
                      </Text>
                    </View>
                  </View>

                  {/* Résumé des séries */}
                  <View style={styles.setsSummaryRow}>
                    {item.results.map((res, rIdx) => (
                      <View key={rIdx} style={styles.setResultBadge}>
                        <Dot color={FEELING_DOT[res.feeling]} size={7} />
                        <Text style={styles.setResultText}>
                          S{res.setNumber} · {res.repsDone} × {fmtKg(res.weight)}kg
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardHairline} />

                  {/* Instruction et Prochaine charge */}
                  <View>
                    <Text style={styles.nextSessionLabel}>PROCHAINE SÉANCE</Text>
                    <Text style={[styles.nextWeightsText, { color: ink }]}>
                      {fmtKg(item.decision.nextWeight)} kg × {item.decision.nextTargetReps}
                    </Text>
                    <Text style={styles.planMessageText}>{item.decision.reason}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Ressenti mental/physique + étirements (optionnel) */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionHeading}>RESSENTI DE LA SÉANCE</Text>

          <View style={styles.feelingCard}>
            <View style={styles.feelingScaleBlock}>
              <Text style={styles.feelingScaleLabel}>ÉNERGIE PHYSIQUE</Text>
              <View style={styles.feelingScaleRow}>
                {FEELING_SCALE.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.feelingPill, physicalFeeling === n && styles.feelingPillActive]}
                    onPress={() => {
                      triggerLightHaptic();
                      setPhysicalFeeling(physicalFeeling === n ? null : n);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.feelingPillText, physicalFeeling === n && styles.feelingPillTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.feelingScaleEndsRow}>
                <Text style={styles.feelingScaleEndText}>Épuisé</Text>
                <Text style={styles.feelingScaleEndText}>En forme</Text>
              </View>
            </View>

            <View style={styles.feelingScaleBlock}>
              <Text style={styles.feelingScaleLabel}>MOTIVATION MENTALE</Text>
              <View style={styles.feelingScaleRow}>
                {FEELING_SCALE.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.feelingPill, mentalFeeling === n && styles.feelingPillActive]}
                    onPress={() => {
                      triggerLightHaptic();
                      setMentalFeeling(mentalFeeling === n ? null : n);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.feelingPillText, mentalFeeling === n && styles.feelingPillTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.feelingScaleEndsRow}>
                <Text style={styles.feelingScaleEndText}>Difficile</Text>
                <Text style={styles.feelingScaleEndText}>Au top</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.stretchRow}
              onPress={() => {
                triggerLightHaptic();
                setStretched((prev) => !prev);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.stretchCheckbox, stretched && styles.stretchCheckboxChecked]}>
                {stretched && <Icon name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.stretchText}>Étirements faits</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton de Fermeture */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.85}>
          <Text style={styles.closeButtonText}>Enregistrer & revenir</Text>
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
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 32,
  },
  victoryHeader: {
    alignItems: 'center',
  },
  trophyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  victoryTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 32,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  workoutSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  statsBlock: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: THEME.radius.card,
    paddingVertical: 18,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: THEME.colors.hairline,
  },
  statValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  statUnit: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  statLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  sectionHeading: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: THEME.radius.card,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  verdictBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  verdictBadgeText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  setsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  setResultText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  cardHairline: {
    height: 1,
    backgroundColor: THEME.colors.hairline,
  },
  nextSessionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  nextWeightsText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  planMessageText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  feelingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: THEME.radius.card,
    padding: 16,
    gap: 16,
  },
  feelingScaleBlock: {
    gap: 8,
  },
  feelingScaleLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
  },
  feelingScaleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feelingPill: {
    flex: 1,
    height: 40,
    borderRadius: THEME.radius.inner,
    backgroundColor: THEME.colors.cardInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingPillActive: {
    backgroundColor: THEME.colors.textPrimary,
  },
  feelingPillText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  feelingPillTextActive: {
    color: '#FFFFFF',
  },
  feelingScaleEndsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feelingScaleEndText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  stretchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stretchCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stretchCheckboxChecked: {
    backgroundColor: THEME.colors.textPrimary,
    borderColor: THEME.colors.textPrimary,
  },
  stretchText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  closeButton: {
    height: 56,
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
