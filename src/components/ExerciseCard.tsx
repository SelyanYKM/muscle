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
      style={[
        styles.cardContainer,
        isFinisher && styles.cardContainerFinisher,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
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
        <View style={styles.targetStatBox}>
          <Text style={styles.targetStatLabel}>CHARGE</Text>
          <Text style={styles.targetStatValue}>
            {currentWeight} <Text style={styles.unitText}>kg</Text>
          </Text>
        </View>

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
            <TouchableOpacity
              style={[styles.feelingButton, styles.easyButton]}
              onPress={() => handleFeelingSelect('EASY')}
              activeOpacity={0.85}
            >
              <View style={styles.feelingTextWrapper}>
                <Text style={styles.feelingTitle}>FACILE</Text>
                <Text style={styles.feelingSubtitle}>2 reps ou + en réserve</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Bouton Juste */}
          <Animated.View style={{ transform: [{ scale: mediumScale }] }}>
            <TouchableOpacity
              style={[styles.feelingButton, styles.mediumButton]}
              onPress={() => handleFeelingSelect('MEDIUM')}
              activeOpacity={0.85}
            >
              <View style={styles.feelingTextWrapper}>
                <Text style={styles.feelingTitle}>JUSTE</Text>
                <Text style={styles.feelingSubtitle}>0 à 1 rep en réserve</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Bouton Échec */}
          <Animated.View style={{ transform: [{ scale: hardScale }] }}>
            <TouchableOpacity
              style={[styles.feelingButton, styles.hardButton]}
              onPress={() => handleFeelingSelect('HARD')}
              activeOpacity={0.85}
            >
              <View style={styles.feelingTextWrapper}>
                <Text style={styles.feelingTitle}>ÉCHEC</Text>
                <Text style={styles.feelingSubtitle}>Reps non atteintes</Text>
              </View>
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  cardContainerFinisher: {
    borderColor: THEME.colors.cardFinisherBorder,
    backgroundColor: THEME.colors.cardFinisherBg,
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
    backgroundColor: THEME.colors.badgeBg,
  },
  machineBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.badgeText,
    fontSize: 9,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: THEME.colors.finisherBadgeBg,
  },
  finisherBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.finisherBadgeText,
    fontSize: 9,
    fontWeight: '800',
  },
  badgeText: {
    letterSpacing: 0.5,
  },
  setIndicator: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  setIndicatorText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseName: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
    lineHeight: 28,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  targetStatBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  targetStatLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  targetStatValue: {
    fontFamily: THEME.fonts.sans,
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
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
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  repsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 12,
    padding: 3,
    width: '100%',
    maxWidth: 220,
  },
  stepButton: {
    width: 44,
    height: 40,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  repsNumberContainer: {
    flex: 1,
    alignItems: 'center',
  },
  repsNumberText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  repsSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.colors.textMuted,
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
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  easyButton: {
    backgroundColor: THEME.colors.feelingEasyBg,
    borderColor: THEME.colors.feelingEasyBorder,
  },
  mediumButton: {
    backgroundColor: THEME.colors.feelingMediumBg,
    borderColor: THEME.colors.feelingMediumBorder,
  },
  hardButton: {
    backgroundColor: THEME.colors.feelingHardBg,
    borderColor: THEME.colors.feelingHardBorder,
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
    color: THEME.colors.textSecondary,
  },
});
