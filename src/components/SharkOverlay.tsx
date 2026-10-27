import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHARK_WIDTH = 110;
const SHARK_HEIGHT = 72; // ratio de l'illustration source (320x209)
const SWIM_DURATION_MS = 3200;

/**
 * Easter egg "buff shark" : traverse l'écran une fois quand `visible` passe à true (déclenché
 * en tapant 5x sur le chrono de séance). L'illustration (assets/shark.png) est orientée vers la
 * droite pour correspondre au sens de la traversée.
 */
export const SharkOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const translateX = useRef(new Animated.Value(-SHARK_WIDTH)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateX.setValue(-SHARK_WIDTH);
    const swim = Animated.timing(translateX, {
      toValue: SCREEN_WIDTH + SHARK_WIDTH,
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
      <Image source={require('../../assets/shark.png')} style={styles.shark} resizeMode="contain" />
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
    width: SHARK_WIDTH,
    height: SHARK_HEIGHT,
  },
});
