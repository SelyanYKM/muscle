import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Exercise, Feeling } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';
import { PlateBreakdown } from './PlateBreakdown';

interface ExerciseCardProps {
  exercise: Exercise;
  setIndex: number; // 0, 1, 2
  totalSets: number; // 3
  currentWeight: number; // kg
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

  // Synchronise les reps par défaut si l'exercice change
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
    <View style={styles.cardContainer}>
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

      {/* Section des 3 boutons de ressenti géants */}
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
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  machineBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  machineBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  finisherBadgeText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setIndicator: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  setIndicatorText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 16,
    lineHeight: 28,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  targetStatBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  targetStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  targetStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#38BDF8',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  repsSelectorSection: {
    marginTop: 6,
    marginBottom: 14,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  repsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 4,
    width: '100%',
    maxWidth: 260,
  },
  stepButton: {
    width: 52,
    height: 48,
    backgroundColor: '#334155',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  repsNumberContainer: {
    flex: 1,
    alignItems: 'center',
  },
  repsNumberText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  repsSublabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  feelingSection: {
    marginTop: 6,
  },
  feelingButtonsGrid: {
    gap: 10,
  },
  feelingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  easyButton: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  mediumButton: {
    backgroundColor: '#7C2D12',
    borderColor: '#F97316',
  },
  hardButton: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  feelingEmoji: {
    fontSize: 22,
    marginRight: 14,
  },
  feelingTextWrapper: {
    flex: 1,
  },
  feelingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  feelingSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  undoButton: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  undoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
