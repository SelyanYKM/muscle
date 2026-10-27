import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHARK_SIZE = 64;
const SWIM_DURATION_MS = 3200;

/**
 * Easter egg "buff shark" : traverse l'écran une fois quand `visible` passe à true (déclenché
 * en tapant 5x sur le chrono de séance). Remplace `🦈` par l'illustration finale quand elle
 * sera prête — le reste de l'animation (traversée + léger tangage) ne change pas.
 */
export const SharkOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const translateX = useRef(new Animated.Value(-SHARK_SIZE)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateX.setValue(-SHARK_SIZE);
    const swim = Animated.timing(translateX, {
      toValue: SCREEN_WIDTH + SHARK_SIZE,
      duration: SWIM_DURATION_MS,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    const tangage = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    tangage.start();
    swim.start(() => tangage.stop());

    return () => {
      swim.stop();
      tangage.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { transform: [{ translateX }, { translateY }] }]}
    >
      <Text style={styles.shark}>🦈</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '38%',
    left: 0,
    zIndex: 999,
  },
  shark: {
    fontSize: SHARK_SIZE,
  },
});
