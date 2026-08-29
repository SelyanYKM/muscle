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
  totalCount: number;
  onEdit: (exercise: ConfiguredExercise) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export const SwipeableExerciseRow: React.FC<SwipeableExerciseRowProps> = ({
  exercise,
  index,
  totalCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isFinisher = exercise.category === 'FREE_WEIGHT';

  // Formater les charges : "50 / 55 / 60 kg" ou "40 kg" si toutes identiques
  const weights = exercise.plannedWeights || [40];
  const allIdentical = weights.every((w) => w === weights[0]);
  const formattedWeights = allIdentical ? `${weights[0]} kg` : `${weights.join(' / ')} kg`;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
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
        {/* Poignée de réorganisation (Drag handle & position) */}
        <View style={styles.reorderCol}>
          <TouchableOpacity
            style={[styles.reorderArrow, index === 0 && styles.reorderArrowDisabled]}
            disabled={index === 0}
            onPress={() => {
              triggerLightHaptic();
              onMoveUp(index);
            }}
          >
            <Text style={styles.reorderArrowText}>▲</Text>
          </TouchableOpacity>

          <Text style={styles.indexNumber}>{index + 1}</Text>

          <TouchableOpacity
            style={[styles.reorderArrow, index === totalCount - 1 && styles.reorderArrowDisabled]}
            disabled={index === totalCount - 1}
            onPress={() => {
              triggerLightHaptic();
              onMoveDown(index);
            }}
          >
            <Text style={styles.reorderArrowText}>▼</Text>
          </TouchableOpacity>
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
              <Text style={styles.weightHighlight}>{formattedWeights}</Text>
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardFinisher: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1B1924',
  },
  reorderCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reorderArrow: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  reorderArrowDisabled: {
    opacity: 0.15,
  },
  reorderArrowText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  indexNumber: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F8FAFC',
    marginVertical: 1,
  },
  infoCol: {
    flex: 1,
    marginRight: 8,
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
    color: '#38BDF8',
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
