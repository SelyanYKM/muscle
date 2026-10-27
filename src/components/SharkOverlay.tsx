import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHARK_WIDTH = 84;
const SHARK_HEIGHT = 55; // ratio de l'illustration source (320x209)
const HEART_SIZE = 26;
const HEART_LEAD_PX = SHARK_WIDTH + 30; // écart fixe : doit dépasser la largeur du requin pour se décoller de son nez

// 3 couples requin/cœur décalés en hauteur, délai de départ et vitesse pour que la traversée
// ne soit pas un simple copier-coller synchronisé.
const CHASES = [
  { top: '22%', delay: 0, duration: 2800 },
  { top: '44%', delay: 280, duration: 3100 },
  { top: '66%', delay: 560, duration: 2600 },
] as const;

const TOTAL_VISIBLE_MS = Math.max(...CHASES.map((c) => c.delay + c.duration)) + 300;

const SharkHeartChase: React.FC<{ top: `${number}%`; delay: number; duration: number; active: boolean }> = ({
  top,
  delay,
  duration,
  active,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    const tangage = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    tangage.start();
    run.start(() => tangage.stop());

    return () => {
      run.stop();
      tangage.stop();
    };
  }, [active]);

  const sharkX = progress.interpolate({ inputRange: [0, 1], outputRange: [-SHARK_WIDTH, SCREEN_WIDTH + SHARK_WIDTH] });
  const heartX = Animated.add(sharkX, HEART_LEAD_PX);
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <>
      <Animated.Text
        style={[styles.heart, { top, transform: [{ translateX: heartX }, { translateY: bobY }] }]}
      >
        ❤️
      </Animated.Text>
      <Animated.View
        style={[styles.sharkWrap, { top, transform: [{ translateX: sharkX }, { translateY: bobY }] }]}
      >
        <Image source={require('../../assets/shark.png')} style={styles.shark} resizeMode="contain" />
      </Animated.View>
    </>
  );
};

/**
 * Easter egg "buff shark" : 3 requins poursuivant chacun un cœur traversent l'écran quand
 * `visible` passe à true (déclenché en tapant 5x sur le chrono de séance), décalés en hauteur,
 * délai et vitesse pour ne pas se chevaucher à l'identique.
 */
export const SharkOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [shouldRender, setShouldRender] = React.useState(false);

  useEffect(() => {
    if (!visible) return;
    setShouldRender(true);
    const timeout = setTimeout(() => setShouldRender(false), TOTAL_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <>
      {CHASES.map((chase, idx) => (
        <SharkHeartChase key={idx} top={chase.top} delay={chase.delay} duration={chase.duration} active={shouldRender} />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  sharkWrap: {
    position: 'absolute',
    left: 0,
    zIndex: 999,
  },
  shark: {
    width: SHARK_WIDTH,
    height: SHARK_HEIGHT,
  },
  heart: {
    position: 'absolute',
    left: 0,
    fontSize: HEART_SIZE,
    zIndex: 999,
  },
});
