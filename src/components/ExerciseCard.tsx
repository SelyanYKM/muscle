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
            {isFinisher ? '🔥 FINISHER BARRE' : '⚙️ HAMMER STRENGTH'}
          </Text>
        </View>

        <View style={styles.setIndicator}>
          <Text style={styles.setIndicatorText}>
            SÉRIE {setIndex + 1} / {totalSets}
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
          <Text style={styles.targetStatLabel}>CHARGE CIBLE</Text>
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

      {/* 3 boutons de ressenti géants */}
      <View style={styles.feelingSection}>
        <Text style={styles.sectionLabel}>RESSENTI EN FIN DE SÉRIE</Text>

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
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cardContainerFinisher: {
    borderColor: THEME.colors.cardFinisherBorder,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  machineBadge: {
    backgroundColor: 'rgba(82, 182, 154, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.oceanMist,
  },
  machineBadgeText: {
    color: THEME.colors.limeCream,
    fontSize: 10,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  finisherBadgeText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeText: {
    letterSpacing: 0.5,
  },
  setIndicator: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setIndicatorText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginBottom: 14,
    lineHeight: 26,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  targetStatBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: 'center',
  },
  targetStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  targetStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.limeCream,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  repsSelectorSection: {
    marginTop: 6,
    marginBottom: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 3,
    width: '100%',
    maxWidth: 240,
  },
  stepButton: {
    width: 48,
    height: 44,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.limeCream,
  },
  repsNumberContainer: {
    flex: 1,
    alignItems: 'center',
  },
  repsNumberText: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  repsSublabel: {
    fontSize: 10,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  easyButton: {
    backgroundColor: '#0A3326',
    borderColor: THEME.colors.emerald,
  },
  mediumButton: {
    backgroundColor: '#3E200C',
    borderColor: THEME.colors.feelingMedium,
  },
  hardButton: {
    backgroundColor: '#3D1313',
    borderColor: THEME.colors.feelingHard,
  },
  feelingEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  feelingTextWrapper: {
    flex: 1,
  },
  feelingTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  feelingSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  undoButton: {
    marginTop: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  undoText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
});
