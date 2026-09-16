import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { THEME } from '../theme';
import { Exercise, Feeling } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';
import { PlateBreakdown } from './PlateBreakdown';

interface ExerciseCardProps {
  exercise: Exercise;
  setIndex: number;
  totalSets: number;
  currentWeight: number;
  targetReps: number;
  onCompleteSet: (repsDone: number, feeling: Feeling) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  setIndex,
  totalSets,
  currentWeight,
  targetReps,
  onCompleteSet,
  onUndo,
  canUndo = false,
}) => {
  const [repsDone, setRepsDone] = useState(targetReps);

  // Animations d'entrée fluide à chaque changement de série ou exercice
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  // Animation de pression sur les boutons
  const easyScale = useRef(new Animated.Value(1)).current;
  const mediumScale = useRef(new Animated.Value(1)).current;
  const hardScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setRepsDone(targetReps);
    fadeAnim.setValue(0);
    slideAnim.setValue(12);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [exercise.id, setIndex, targetReps]);

  const animateButtonPress = (scaleValue: Animated.Value, callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start(() => callback());
  };

  const handleFeelingSelect = (feeling: Feeling) => {
    if (feeling === 'EASY') {
      triggerLightHaptic();
      animateButtonPress(easyScale, () => onCompleteSet(repsDone, feeling));
    } else if (feeling === 'MEDIUM') {
      triggerMediumHaptic();
      animateButtonPress(mediumScale, () => onCompleteSet(repsDone, feeling));
    } else {
      triggerWarningHaptic();
      animateButtonPress(hardScale, () => onCompleteSet(repsDone, feeling));
    }
  };

  const adjustReps = (delta: number) => {
    triggerLightHaptic();
    setRepsDone((prev) => Math.max(0, prev + delta));
  };

  const isFinisher = exercise.category === 'FREE_WEIGHT';

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <LinearGradient
        colors={[THEME.colors.seriesCardFrom, THEME.colors.seriesCardMid, THEME.colors.seriesCardTo]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.cardContainer}
      >
      {/* En-tête : Catégorie & Numéro de série */}
      <View style={styles.topHeader}>
        <View style={[styles.badge, isFinisher ? styles.finisherBadge : styles.machineBadge]}>
          <Text style={[styles.badgeText, isFinisher ? styles.finisherBadgeText : styles.machineBadgeText]}>
            {isFinisher ? 'FINISHER BARRE' : 'HAMMER STRENGTH'}
          </Text>
        </View>

        <View style={styles.setIndicator}>
          <Text style={styles.setIndicatorText}>
            SÉRIE {setIndex + 1}/{totalSets}
          </Text>
        </View>
      </View>

      {/* Titre de l'exercice */}
      <Text style={styles.exerciseName} numberOfLines={2}>
        {exercise.name}
      </Text>

      {/* Zone Charge Cible & Répétitions */}
      <View style={styles.targetRow}>
        <LinearGradient
          colors={[THEME.colors.restGradientViolet, THEME.colors.restGradientBlue]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.targetStatBoxAccent}
        >
          <Text style={styles.targetStatLabelAccent}>CHARGE</Text>
          <Text style={styles.targetStatValueAccent}>
            {currentWeight} <Text style={styles.unitTextAccent}>kg</Text>
          </Text>
        </LinearGradient>

        <View style={styles.targetStatBox}>
          <Text style={styles.targetStatLabel}>OBJECTIF</Text>
          <Text style={styles.targetStatValue}>
            {targetReps} <Text style={styles.unitText}>reps</Text>
          </Text>
        </View>
      </View>

      {/* Calculateur de disques visuel */}
      <PlateBreakdown
        totalWeight={currentWeight}
        baseWeight={exercise.baseWeight}
        category={exercise.category}
        dark
      />

      {/* Sélecteur de répétitions réalisées */}
      <View style={styles.repsSelectorSection}>
        <Text style={styles.sectionLabel}>RÉPÉTITIONS EFFECTUÉES</Text>
        <View style={styles.repsStepper}>
          <TouchableOpacity style={styles.stepButton} onPress={() => adjustReps(-1)} activeOpacity={0.7}>
            <Text style={styles.stepButtonText}>-</Text>
          </TouchableOpacity>

          <View style={styles.repsNumberContainer}>
            <Text style={styles.repsNumberText}>{repsDone}</Text>
            <Text style={styles.repsSublabel}>reps</Text>
          </View>

          <TouchableOpacity style={styles.stepButton} onPress={() => adjustReps(1)} activeOpacity={0.7}>
            <Text style={styles.stepButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3 boutons de ressenti épurés sans émojis */}
      <View style={styles.feelingSection}>
        <Text style={styles.sectionLabel}>RESSENTI DE LA SÉRIE</Text>

        <View style={styles.feelingButtonsGrid}>
          {/* Bouton Facile */}
          <Animated.View style={{ transform: [{ scale: easyScale }] }}>
            <TouchableOpacity onPress={() => handleFeelingSelect('EASY')} activeOpacity={0.85}>
              <LinearGradient
                colors={THEME.colors.feelingEasyGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelingButton}
              >
                <View style={styles.feelingTextWrapper}>
                  <Text style={[styles.feelingTitle, { color: THEME.colors.feelingEasyText }]}>FACILE</Text>
                  <Text style={[styles.feelingSubtitle, { color: THEME.colors.feelingEasyText }]}>
                    2 reps ou + en réserve
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Bouton Juste */}
          <Animated.View style={{ transform: [{ scale: mediumScale }] }}>
            <TouchableOpacity onPress={() => handleFeelingSelect('MEDIUM')} activeOpacity={0.85}>
              <LinearGradient
                colors={THEME.colors.feelingMediumGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelingButton}
              >
                <View style={styles.feelingTextWrapper}>
                  <Text style={[styles.feelingTitle, { color: THEME.colors.feelingMediumText }]}>JUSTE</Text>
                  <Text style={[styles.feelingSubtitle, { color: THEME.colors.feelingMediumText }]}>
                    0 à 1 rep en réserve
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Bouton Échec */}
          <Animated.View style={{ transform: [{ scale: hardScale }] }}>
            <TouchableOpacity onPress={() => handleFeelingSelect('HARD')} activeOpacity={0.85}>
              <LinearGradient
                colors={THEME.colors.feelingHardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelingButton}
              >
                <View style={styles.feelingTextWrapper}>
                  <Text style={[styles.feelingTitle, { color: THEME.colors.feelingHardText }]}>ÉCHEC</Text>
                  <Text style={[styles.feelingSubtitle, { color: THEME.colors.feelingHardText }]}>
                    Reps non atteintes
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Pied de carte : Annulation */}
      {canUndo && (
        <TouchableOpacity style={styles.undoButton} onPress={onUndo} activeOpacity={0.7}>
          <Text style={styles.undoText}>↩️ Corriger la série précédente</Text>
        </TouchableOpacity>
      )}
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 26,
    padding: 18,
    shadowColor: '#2B1E38',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  machineBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  machineBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textOnDark,
    fontSize: 9,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  finisherBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textOnDark,
    fontSize: 9,
    fontWeight: '800',
  },
  badgeText: {
    letterSpacing: 0.5,
  },
  setIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  setIndicatorText: {
    fontFamily: THEME.fonts.sans,
    color: 'rgba(244, 237, 247, 0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseName: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    color: THEME.colors.textOnDark,
    marginBottom: 12,
    lineHeight: 30,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  targetStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  targetStatBoxAccent: {
    flex: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  targetStatLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(244, 237, 247, 0.6)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  targetStatLabelAccent: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(28, 28, 30, 0.55)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  targetStatValue: {
    fontFamily: THEME.fonts.sans,
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.textOnDark,
  },
  targetStatValueAccent: {
    fontFamily: THEME.fonts.sans,
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(244, 237, 247, 0.6)',
  },
  unitTextAccent: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.5)',
  },
  repsSelectorSection: {
    marginTop: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(244, 237, 247, 0.55)',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  repsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    padding: 4,
    width: '100%',
    maxWidth: 236,
  },
  stepButton: {
    width: 48,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.colors.textOnDark,
  },
  repsNumberContainer: {
    flex: 1,
    alignItems: 'center',
  },
  repsNumberText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.textOnDark,
  },
  repsSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(244, 237, 247, 0.5)',
  },
  feelingSection: {
    marginTop: 4,
  },
  feelingButtonsGrid: {
    gap: 8,
  },
  feelingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: '#1C1200',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  feelingTextWrapper: {
    alignItems: 'center',
  },
  feelingTitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  feelingSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  undoButton: {
    marginTop: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  undoText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(244, 237, 247, 0.55)',
  },
});
