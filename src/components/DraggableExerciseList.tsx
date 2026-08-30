import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { THEME } from '../theme';
import { ConfiguredExercise } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface DraggableExerciseListProps {
  exercises: ConfiguredExercise[];
  onReorder: (reordered: ConfiguredExercise[]) => void;
  onEdit: (exercise: ConfiguredExercise) => void;
  onDelete: (index: number) => void;
}

const ITEM_HEIGHT = 72;

export const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  onEdit,
  onDelete,
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  // Refs pour éviter les closures périmées dans PanResponder
  const draggingIndexRef = useRef<number | null>(null);
  const exercisesRef = useRef<ConfiguredExercise[]>(exercises);

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  const startDrag = (index: number) => {
    triggerMediumHaptic();
    draggingIndexRef.current = index;
    setDraggingIndex(index);
    dragY.setValue(0);
  };

  const endDrag = (gestureDy: number) => {
    const currentIndex = draggingIndexRef.current;
    if (currentIndex !== null) {
      const movedPositions = Math.round(gestureDy / ITEM_HEIGHT);
      const list = exercisesRef.current;
      const targetIndex = Math.max(0, Math.min(list.length - 1, currentIndex + movedPositions));

      if (targetIndex !== currentIndex && targetIndex >= 0 && targetIndex < list.length) {
        triggerLightHaptic();
        const updated = [...list];
        const [movedItem] = updated.splice(currentIndex, 1);
        updated.splice(targetIndex, 0, movedItem);
        onReorder(updated);
      }
    }

    // Réinitialisation inconditionnelle
    draggingIndexRef.current = null;
    setDraggingIndex(null);
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: false,
      friction: 6,
    }).start();
  };

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
            onStartDrag={() => startDrag(index)}
            onEndDrag={endDrag}
            onMoveDrag={(dy) => dragY.setValue(dy)}
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
  onStartDrag: () => void;
  onEndDrag: (dy: number) => void;
  onMoveDrag: (dy: number) => void;
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
  onStartDrag,
  onEndDrag,
  onMoveDrag,
  onEdit,
  onDelete,
  isFinisher,
  formattedWeights,
}) => {
  const swipeX = useRef(new Animated.Value(0)).current;

  // PanResponder dédié pour la poignée de Drag & Drop
  const dragHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        onStartDrag();
      },
      onPanResponderMove: (_, g) => {
        onMoveDrag(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        onEndDrag(g.dy);
      },
      onPanResponderTerminate: (_, g) => {
        onEndDrag(g.dy);
      },
    })
  ).current;

  // PanResponder pour le swipe horizontal avec verrouillage d'angle strict
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Ne s'active QUE sur un geste horizontal franc et jamais sur un glissement vertical
        return (
          Math.abs(gestureState.dx) > 35 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          swipeX.setValue(Math.max(-85, gestureState.dx));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          triggerLightHaptic();
          Animated.spring(swipeX, { toValue: -75, useNativeDriver: false }).start();
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    triggerWarningHaptic();
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
    onDelete();
  };

  return (
    <View style={[styles.itemWrapper, isDragging && { zIndex: 9999 }]}>
      {/* Bouton Supprimer en arrière-plan (Swipe gauche) */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Suppr.</Text>
        </TouchableOpacity>
      </View>

      {/* Carte principale avec effet flottant */}
      <Animated.View
        style={[
          styles.card,
          isFinisher && styles.cardFinisher,
          isDragging && styles.cardFloating,
          {
            transform: [
              { translateX: swipeX },
              { translateY: isDragging ? dragY : 0 },
              { scale: isDragging ? 1.05 : 1 },
            ],
            zIndex: isDragging ? 9999 : 1,
          },
        ]}
        {...swipePanResponder.panHandlers}
      >
        {/* Poignée de Drag & Drop */}
        <View style={styles.dragHandle} {...dragHandlePanResponder.panHandlers}>
          <Text style={[styles.dragHandleIcon, isDragging && styles.dragHandleIconActive]}>
            ⠿
          </Text>
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
    overflow: 'visible',
  },
  itemWrapper: {
    width: '100%',
    height: ITEM_HEIGHT,
    marginBottom: 8,
    position: 'relative',
    borderRadius: 12,
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
    borderRadius: 12,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  cardFinisher: {
    borderColor: THEME.colors.cardFinisherBorder,
    backgroundColor: THEME.colors.cardFinisherBg,
  },
  cardFloating: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.cardInner,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 20,
  },
  dragHandle: {
    width: 38,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  dragHandleIcon: {
    color: THEME.colors.textMuted,
    fontSize: 22,
    fontWeight: '900',
  },
  dragHandleIconActive: {
    color: THEME.colors.accent,
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
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  indexPrefix: {
    color: THEME.colors.accent,
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
  metaSummary: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  weightText: {
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  pencilBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: THEME.colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  pencilIcon: {
    fontSize: 12,
  },
});
