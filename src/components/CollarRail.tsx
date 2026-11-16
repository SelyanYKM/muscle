import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { THEME } from '../theme';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { Icon } from './Icon';

const RAIL_HEIGHT = 52;
const RAIL_RADIUS = 16;
const COLLAR_SIZE = 44;
const COLLAR_RADIUS = 12;
const STOP_WIDTH = 10;
const PLATE_SIZE = 30;
const PLATE_GAP = 4;
const PLATES_WIDTH = PLATE_SIZE * 3 + PLATE_GAP * 4; // + un peu d'air avant/après les disques
const PLATE_COLORS = ['#3B7AC4', '#D45454', '#F1F3F5'];

/**
 * Rail du collier de technique : une barre vue de côté (butée, disques, manchon acier) sur
 * laquelle le collier glisse. Posé contre les disques = technique (charge gelée) ; au bout du
 * manchon = force (comportement normal). Glisser ou toucher le rail bascule l'état.
 * Déclenché par un appui long sur la charge (voir FreeWorkoutScreen) ; visible seulement tant
 * que le parent le monte (règle de visibilité : posé, ou sorti pendant cet exercice).
 */
export const CollarRail: React.FC<{
  posed: boolean;
  onChange: (posed: boolean) => void;
}> = ({ posed, onChange }) => {
  const [sleeveWidth, setSleeveWidth] = useState(0);
  const travel = Math.max(0, sleeveWidth - COLLAR_SIZE);
  // 0 = force (collier au bout du manchon, à droite) ; 1 = technique (contre les disques, à gauche).
  const drag = useRef(new Animated.Value(posed ? 1 : 0)).current;
  const dragStartRef = useRef(0);
  const posedRef = useRef(posed);
  posedRef.current = posed;
  // PanResponder.create() n'est appelé qu'une fois (useRef) : ses callbacks restent figés sur
  // les valeurs du tout premier rendu (travel = 0 - COLLAR_SIZE, négatif, avant la mesure du
  // manchon). On passe donc par des refs mises à jour à chaque rendu, lues depuis les callbacks
  // au lieu de fermer directement sur `travel`/`settle`.
  const travelRef = useRef(travel);
  travelRef.current = travel;

  const settle = (next: boolean, haptic: boolean = true) => {
    if (haptic) (next ? triggerMediumHaptic : triggerLightHaptic)();
    Animated.spring(drag, { toValue: next ? 1 : 0, useNativeDriver: false, friction: 8, tension: 90 }).start();
    if (next !== posedRef.current) onChange(next);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => travelRef.current > 0,
      onMoveShouldSetPanResponder: (_, g) => travelRef.current > 0 && Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        dragStartRef.current = posedRef.current ? 1 : 0;
      },
      onPanResponderMove: (_, g) => {
        const t = travelRef.current;
        if (t <= 0) return;
        // Glisser vers la gauche (dx négatif) rapproche des disques (= technique, drag → 1).
        const delta = -g.dx / t;
        const next = Math.min(1, Math.max(0, dragStartRef.current + delta));
        drag.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const t = travelRef.current;
        // Un simple appui (quasi aucun déplacement) bascule l'état, comme un tap sur le rail.
        if (t <= 0 || Math.abs(g.dx) < 4) {
          settleRef.current(!posedRef.current);
          return;
        }
        const current = Math.min(1, Math.max(0, dragStartRef.current - g.dx / t));
        settleRef.current(current >= 0.5);
      },
    })
  ).current;

  const collarTranslate = drag.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] });
  const railTint = drag.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        {posed ? (
          <>
            <View style={styles.labelLeft}>
              <Icon name="lock" size={13} color={THEME.technique.validateBtnBg} />
              <Text style={[styles.labelText, { color: THEME.technique.validateBtnBg }]}>Technique · charge gelée</Text>
            </View>
            <Text style={[styles.labelHint, { color: THEME.technique.accentStrong }]}>retire le collier ›</Text>
          </>
        ) : (
          <>
            <Text style={styles.labelText}>Force</Text>
            <Text style={styles.labelHint}>‹ pose le collier pour la technique</Text>
          </>
        )}
      </View>

      <View
        style={styles.rail}
        accessibilityRole="switch"
        accessibilityLabel="Mode technique"
        accessibilityState={{ checked: posed }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => settle(!posed)}
        {...panResponder.panHandlers}
      >
        {/* Butée de la barre. */}
        <View style={styles.stop} />

        {/* Disques. */}
        <View style={styles.plates}>
          {PLATE_COLORS.map((color, i) => (
            <View
              key={i}
              style={[
                styles.plate,
                { backgroundColor: color, borderColor: color === '#F1F3F5' ? '#D0D5DD' : color },
              ]}
            />
          ))}
        </View>

        {/* Manchon acier : le rail où glisse le collier. */}
        <View
          style={styles.sleeveWrap}
          onLayout={(e) => setSleeveWidth(e.nativeEvent.layout.width)}
        >
          <LinearGradient
            colors={['#EEF2F7', '#B7C1D1', '#8E9AAE']}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: THEME.technique.railTint, opacity: railTint },
            ]}
          />

          {sleeveWidth > 0 && (
            <Animated.View
              style={[
                styles.collar,
                posed && { backgroundColor: THEME.technique.railPosedBg, borderColor: THEME.technique.railPosedBg },
                { transform: [{ translateX: collarTranslate }] },
              ]}
            >
              {posed ? (
                <Icon name="lock" size={16} color="#FFFFFF" />
              ) : (
                <View style={styles.grip}>
                  <View style={styles.gripLine} />
                  <View style={styles.gripLine} />
                  <View style={styles.gripLine} />
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelText: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
  },
  labelHint: {
    fontFamily: THEME.fonts.sansMedium,
    fontSize: 11.5,
    color: THEME.colors.textMuted,
  },
  rail: {
    height: RAIL_HEIGHT,
    borderRadius: RAIL_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 8,
    gap: PLATE_GAP,
    overflow: 'hidden',
  },
  stop: {
    width: STOP_WIDTH,
    height: RAIL_HEIGHT - 16,
    borderRadius: 4,
    backgroundColor: THEME.colors.controlBorder,
  },
  plates: { flexDirection: 'row', gap: PLATE_GAP, width: PLATES_WIDTH, alignItems: 'center', justifyContent: 'center' },
  plate: {
    width: PLATE_SIZE,
    height: RAIL_HEIGHT - 10,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  sleeveWrap: {
    flex: 1,
    height: RAIL_HEIGHT - 8,
    borderRadius: (RAIL_HEIGHT - 8) / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  collar: {
    position: 'absolute',
    left: 0,
    width: COLLAR_SIZE,
    height: COLLAR_SIZE,
    borderRadius: COLLAR_RADIUS,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: THEME.colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { flexDirection: 'row', gap: 3 },
  gripLine: { width: 2, height: 16, borderRadius: 1, backgroundColor: THEME.colors.controlBorder },
});
