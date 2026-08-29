import React, { useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ConfiguredExercise } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface DraggableExerciseListProps {
  exercises: ConfiguredExercise[];
  onReorder: (reordered: ConfiguredExercise[]) => void;
  onEdit: (exercise: ConfiguredExercise) => void;
  onDelete: (index: number) => void;
}

const ITEM_HEIGHT = 74; // Hauteur standardisée pour calcul du drag & drop

export const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  onEdit,
  onDelete,
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragY = useState(new Animated.Value(0))[0];

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Détecter un déplacement vertical significatif pour le drag
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderGrant: () => {
      triggerMediumHaptic();
    },
    onPanResponderMove: (_, gestureState) => {
      dragY.setValue(gestureState.dy);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (draggingIndex === null) return;

      const movedPositions = Math.round(gestureState.dy / ITEM_HEIGHT);
      const newIndex = Math.max(0, Math.min(exercises.length - 1, draggingIndex + movedPositions));

      if (newIndex !== draggingIndex) {
        triggerLightHaptic();
        const updated = [...exercises];
        const [movedItem] = updated.splice(draggingIndex, 1);
        updated.splice(newIndex, 0, movedItem);
        onReorder(updated);
      }

      setDraggingIndex(null);
      dragY.setValue(0);
    },
  });

  return (
    <View style={styles.listContainer}>
      {exercises.map((ex, index) => {
        const isDragging = draggingIndex === index;
        const isFinisher = ex.category === 'FREE_WEIGHT';
        const weights = ex.plannedWeights || [40];
        const allIdentical = weights.every((w) => w === weights[0]);
        const formattedWeights = allIdentical ? `${weights[0]} kg` : `${weights.join('/')} kg`;

        return (
          <DraggableItemRow
            key={ex.id || index}
            exercise={ex}
            index={index}
            isDragging={isDragging}
            dragY={dragY}
            panResponder={panResponder}
            onStartDrag={() => setDraggingIndex(index)}
            onEdit={() => onEdit(ex)}
            onDelete={() => onDelete(index)}
            isFinisher={isFinisher}
            formattedWeights={formattedWeights}
          />
        );
      })}
    </View>
  );
};

interface DraggableItemRowProps {
  exercise: ConfiguredExercise;
  index: number;
  isDragging: boolean;
  dragY: Animated.Value;
  panResponder: any;
  onStartDrag: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isFinisher: boolean;
  formattedWeights: string;
}

const DraggableItemRow: React.FC<DraggableItemRowProps> = ({
  exercise,
  index,
  isDragging,
  dragY,
  panResponder,
  onStartDrag,
  onEdit,
  onDelete,
  isFinisher,
  formattedWeights,
}) => {
  const swipeX = useState(new Animated.Value(0))[0];

  const swipePanResponder = useState(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dy) < 10,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) swipeX.setValue(Math.max(-85, g.dx));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -45) {
          triggerLightHaptic();
          Animated.spring(swipeX, { toValue: -75, useNativeDriver: false }).start();
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  )[0];

  const handleDelete = () => {
    triggerWarningHaptic();
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
    onDelete();
  };

  return (
    <View style={styles.itemWrapper}>
      {/* Bouton Supprimer en arrière-plan (Swipe gauche) */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Suppr.</Text>
        </TouchableOpacity>
      </View>

      {/* Carte principale */}
      <Animated.View
        style={[
          styles.card,
          isFinisher && styles.cardFinisher,
          isDragging && styles.cardDragging,
          {
            transform: [
              { translateX: swipeX },
              { translateY: isDragging ? dragY : 0 },
              { scale: isDragging ? 1.03 : 1 },
            ],
            zIndex: isDragging ? 999 : 1,
          },
        ]}
        {...swipePanResponder.panHandlers}
      >
        {/* Poignée de Drag & Drop (Maintenir et glisser pour déplacer) */}
        <View
          style={styles.dragHandle}
          onTouchStart={onStartDrag}
          {...panResponder.panHandlers}
        >
          <Text style={styles.dragHandleIcon}>⠿</Text>
        </View>

        {/* Index & Titre */}
        <View style={styles.infoSection}>
          <Text style={styles.exerciseTitle} numberOfLines={1}>
            <Text style={styles.indexPrefix}>{index + 1}. </Text>
            {exercise.name}
          </Text>

          <View style={styles.subInfoRow}>
            <View style={[styles.badge, isFinisher ? styles.finisherBadge : styles.machineBadge]}>
              <Text style={[styles.badgeText, isFinisher ? styles.finisherBadgeText : styles.machineBadgeText]}>
                {isFinisher ? 'BARRE' : 'HAMMER'}
              </Text>
            </View>

            <Text style={styles.metaSummary} numberOfLines={1}>
              {exercise.numSets}×{exercise.targetReps} reps • <Text style={styles.weightText}>{formattedWeights}</Text>
            </Text>
          </View>
        </View>

        {/* Crayon pour éditer */}
        <TouchableOpacity style={styles.pencilBtn} onPress={onEdit} activeOpacity={0.7}>
          <Text style={styles.pencilIcon}>✏️</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  itemWrapper: {
    width: '100%',
    height: ITEM_HEIGHT,
    marginBottom: 8,
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  deleteBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 75,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardFinisher: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1A1822',
  },
  cardDragging: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  dragHandle: {
    width: 32,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  dragHandleIcon: {
    color: '#64748B',
    fontSize: 20,
    fontWeight: '900',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 18,
  },
  indexPrefix: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  machineBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  machineBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  finisherBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeText: {
    letterSpacing: 0.5,
  },
  metaSummary: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    flexShrink: 1,
  },
  weightText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pencilBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pencilIcon: {
    fontSize: 13,
  },
});
