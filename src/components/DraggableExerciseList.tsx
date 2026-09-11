import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { THEME } from '../theme';
import { ConfiguredExercise } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DraggableExerciseListProps {
  exercises: ConfiguredExercise[];
  onReorder: (reordered: ConfiguredExercise[]) => void;
  onEdit: (exercise: ConfiguredExercise) => void;
  onDelete: (index: number) => void;
}

const ITEM_HEIGHT = 74;

export const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  onEdit,
  onDelete,
}) => {
  const [items, setItems] = useState<ConfiguredExercise[]>(exercises);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const itemsRef = useRef<ConfiguredExercise[]>(exercises);
  const currentDragDy = useRef<number>(0);

  useEffect(() => {
    setItems(exercises);
    itemsRef.current = exercises;
  }, [exercises]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;

    triggerLightHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setItems(updated);
    itemsRef.current = updated;
    onReorder(updated);
  };

  const handleStartDrag = (index: number) => {
    triggerMediumHaptic();
    draggingIndexRef.current = index;
    setDraggingIndex(index);
    dragY.setValue(0);
    currentDragDy.current = 0;
  };

  const handleDragMove = (dy: number) => {
    dragY.setValue(dy);
    currentDragDy.current = dy;

    const fromIdx = draggingIndexRef.current;
    if (fromIdx === null) return;

    const movedSlots = Math.round(dy / ITEM_HEIGHT);
    const targetIdx = Math.max(0, Math.min(itemsRef.current.length - 1, fromIdx + movedSlots));

    if (targetIdx !== fromIdx) {
      triggerLightHaptic();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const list = [...itemsRef.current];
      const [moved] = list.splice(fromIdx, 1);
      list.splice(targetIdx, 0, moved);

      setItems(list);
      itemsRef.current = list;
      draggingIndexRef.current = targetIdx;
      onReorder(list);

      // Réajustement du delta
      const newDy = dy - (targetIdx - fromIdx) * ITEM_HEIGHT;
      dragY.setValue(newDy);
      currentDragDy.current = newDy;
    }
  };

  const handleEndDrag = () => {
    triggerLightHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    draggingIndexRef.current = null;
    setDraggingIndex(null);
    dragY.setValue(0);
    currentDragDy.current = 0;
  };

  return (
    <View style={styles.listContainer}>
      {items.map((ex, index) => {
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
            totalItems={items.length}
            isDragging={isDragging}
            dragY={dragY}
            onStartDrag={() => handleStartDrag(index)}
            onDragMove={handleDragMove}
            onEndDrag={handleEndDrag}
            onMoveUp={() => moveItem(index, index - 1)}
            onMoveDown={() => moveItem(index, index + 1)}
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
  totalItems: number;
  isDragging: boolean;
  dragY: Animated.Value;
  onStartDrag: () => void;
  onDragMove: (dy: number) => void;
  onEndDrag: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isFinisher: boolean;
  formattedWeights: string;
}

const DraggableItemRow: React.FC<DraggableItemRowProps> = ({
  exercise,
  index,
  totalItems,
  isDragging,
  dragY,
  onStartDrag,
  onDragMove,
  onEndDrag,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isFinisher,
  formattedWeights,
}) => {
  const swipeX = useRef(new Animated.Value(0)).current;

  // PanResponder attaché à la poignée, avec mise à jour continue via refs
  const dragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onStartDrag();
      },
      onPanResponderMove: (_, gestureState) => {
        onDragMove(gestureState.dy);
      },
      onPanResponderRelease: () => {
        onEndDrag();
      },
      onPanResponderTerminate: () => {
        onEndDrag();
      },
    })
  ).current;

  // Swipe horizontal pour supprimer
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 30 &&
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
      {/* Bouton Supprimer en arrière-plan */}
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
        {/* Poignée de drag avec zone de contact large & retour immédiat */}
        <View
          style={styles.dragHandle}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          {...dragPanResponder.panHandlers}
        >
          <View style={[styles.handlePill, isDragging && styles.handlePillActive]}>
            <Text style={[styles.dragHandleIcon, isDragging && styles.dragHandleIconActive]}>
              ⠿
            </Text>
          </View>
        </View>

        {/* Index & Titre de l'exercice */}
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

        {/* Boutons flèches rapides pour micro-ajustement d'ordre */}
        <View style={styles.reorderArrowsCol}>
          {index > 0 && (
            <TouchableOpacity style={styles.arrowBtn} onPress={onMoveUp} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.arrowIcon}>▲</Text>
            </TouchableOpacity>
          )}
          {index < totalItems - 1 && (
            <TouchableOpacity style={styles.arrowBtn} onPress={onMoveDown} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.arrowIcon}>▼</Text>
            </TouchableOpacity>
          )}
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
    borderRadius: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardFinisher: {
    borderColor: THEME.colors.cardFinisherBorder,
    backgroundColor: THEME.colors.cardFinisherBg,
  },
  cardFloating: {
    borderColor: THEME.colors.accent,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  dragHandle: {
    paddingHorizontal: 6,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  handlePill: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  handlePillActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  dragHandleIcon: {
    color: THEME.colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  dragHandleIconActive: {
    color: THEME.colors.accentTextDark,
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 4,
    overflow: 'hidden',
  },
  exerciseTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 19,
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
  reorderArrowsCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
    marginRight: 6,
  },
  arrowBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    fontWeight: '900',
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
