import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ConfiguredExercise } from '../types';
import { triggerLightHaptic, triggerWarningHaptic } from '../utils/haptics';

interface SwipeableExerciseRowProps {
  exercise: ConfiguredExercise;
  index: number;
  onEdit: (exercise: ConfiguredExercise) => void;
  onDelete: (index: number) => void;
}

export const SwipeableExerciseRow: React.FC<SwipeableExerciseRowProps> = ({
  exercise,
  index,
  onEdit,
  onDelete,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isFinisher = exercise.category === 'FREE_WEIGHT';
  const currentWeight = exercise.plannedWeights?.[0] ?? exercise.baseWeight ?? 40;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Détecter un glissement horizontal uniquement
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Bloquer le glissement vers la droite, autoriser uniquement vers la gauche jusqu'à -100px
        if (gestureState.dx < 0) {
          pan.x.setValue(Math.max(-90, gestureState.dx));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          triggerLightHaptic();
          Animated.spring(pan.x, {
            toValue: -80,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        } else {
          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(pan.x, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleDeletePress = () => {
    triggerWarningHaptic();
    closeSwipe();
    onDelete(index);
  };

  return (
    <View style={styles.container}>
      {/* Bouton Supprimer en arrière-plan révélé par le glissement */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePress}>
          <Text style={styles.deleteIcon}>🗑️</Text>
          <Text style={styles.deleteText}>Retirer</Text>
        </TouchableOpacity>
      </View>

      {/* Carte principale glissante */}
      <Animated.View
        style={[
          styles.cardForeground,
          isFinisher && styles.cardFinisher,
          { transform: [{ translateX: pan.x }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Numéro d'ordre */}
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>

        {/* Détails de l'exercice */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {exercise.name}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.badge, isFinisher ? styles.finisherBadge : styles.machineBadge]}>
              <Text style={[styles.badgeText, isFinisher ? styles.finisherBadgeText : styles.machineBadgeText]}>
                {isFinisher ? '🔥 BARRE' : '⚙️ HAMMER'}
              </Text>
            </View>

            <Text style={styles.summaryText}>
              {exercise.numSets} séries • {exercise.targetReps} reps •{' '}
              <Text style={styles.weightHighlight}>{currentWeight} kg</Text>
            </Text>
          </View>
        </View>

        {/* Crayon épuré pour modifier */}
        <TouchableOpacity
          style={styles.pencilButton}
          onPress={() => {
            closeSwipe();
            onEdit(exercise);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.pencilIcon}>✏️</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  deleteBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 80,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  cardForeground: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardFinisher: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1B1924',
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  infoCol: {
    flex: 1,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  machineBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  machineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
  },
  finisherBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  finisherBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F87171',
  },
  badgeText: {
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  weightHighlight: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  pencilButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pencilIcon: {
    fontSize: 15,
  },
});
