import React, { useState } from 'react';
import {
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

  React.useEffect(() => {
    setRepsDone(targetReps);
  }, [exercise.id, setIndex, targetReps]);

  const handleFeelingSelect = (feeling: Feeling) => {
    if (feeling === 'EASY') triggerLightHaptic();
    else if (feeling === 'MEDIUM') triggerMediumHaptic();
    else triggerWarningHaptic();

    onCompleteSet(repsDone, feeling);
  };

  const adjustReps = (delta: number) => {
    triggerLightHaptic();
    setRepsDone((prev) => Math.max(0, prev + delta));
  };

  const isFinisher = exercise.category === 'FREE_WEIGHT';

  return (
    <View style={[styles.cardContainer, isFinisher && styles.cardContainerFinisher]}>
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
          <TouchableOpacity style={styles.stepButton} onPress={() => adjustReps(-1)}>
            <Text style={styles.stepButtonText}>-</Text>
          </TouchableOpacity>

          <View style={styles.repsNumberContainer}>
            <Text style={styles.repsNumberText}>{repsDone}</Text>
            <Text style={styles.repsSublabel}>reps</Text>
          </View>

          <TouchableOpacity style={styles.stepButton} onPress={() => adjustReps(1)}>
            <Text style={styles.stepButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3 boutons de ressenti */}
      <View style={styles.feelingSection}>
        <Text style={styles.sectionLabel}>RESSENTI DE LA SÉRIE</Text>

        <View style={styles.feelingButtonsGrid}>
          {/* Bouton Facile */}
          <TouchableOpacity
            style={[styles.feelingButton, styles.easyButton]}
            onPress={() => handleFeelingSelect('EASY')}
            activeOpacity={0.8}
          >
            <Text style={styles.feelingEmoji}>🟢</Text>
            <View style={styles.feelingTextWrapper}>
              <Text style={styles.feelingTitle}>FACILE</Text>
              <Text style={styles.feelingSubtitle}>2 reps ou + en réserve</Text>
            </View>
          </TouchableOpacity>

          {/* Bouton Juste */}
          <TouchableOpacity
            style={[styles.feelingButton, styles.mediumButton]}
            onPress={() => handleFeelingSelect('MEDIUM')}
            activeOpacity={0.8}
          >
            <Text style={styles.feelingEmoji}>🟠</Text>
            <View style={styles.feelingTextWrapper}>
              <Text style={styles.feelingTitle}>JUSTE</Text>
              <Text style={styles.feelingSubtitle}>0 à 1 rep en réserve</Text>
            </View>
          </TouchableOpacity>

          {/* Bouton Échec */}
          <TouchableOpacity
            style={[styles.feelingButton, styles.hardButton]}
            onPress={() => handleFeelingSelect('HARD')}
            activeOpacity={0.8}
          >
            <Text style={styles.feelingEmoji}>🔴</Text>
            <View style={styles.feelingTextWrapper}>
              <Text style={styles.feelingTitle}>ÉCHEC</Text>
              <Text style={styles.feelingSubtitle}>Reps non atteintes</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pied de carte : Annulation */}
      {canUndo && (
        <TouchableOpacity style={styles.undoButton} onPress={onUndo}>
          <Text style={styles.undoText}>↩️ Corriger la série précédente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  cardContainerFinisher: {
    borderColor: THEME.colors.cardFinisherBorder,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  machineBadge: {
    backgroundColor: THEME.colors.badgeBg,
  },
  machineBadgeText: {
    color: THEME.colors.badgeText,
    fontSize: 9,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: THEME.colors.finisherBadgeBg,
  },
  finisherBadgeText: {
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
    borderRadius: 5,
  },
  setIndicatorText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseName: {
    fontSize: 19,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
    lineHeight: 24,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  targetStatBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  targetStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  targetStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  repsSelectorSection: {
    marginTop: 4,
    marginBottom: 10,
    alignItems: 'center',
  },
  sectionLabel: {
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
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  repsSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  feelingSection: {
    marginTop: 2,
  },
  feelingButtonsGrid: {
    gap: 6,
  },
  feelingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
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
  feelingEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  feelingTextWrapper: {
    flex: 1,
  },
  feelingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  feelingSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
  },
  undoButton: {
    marginTop: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  undoText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
});
