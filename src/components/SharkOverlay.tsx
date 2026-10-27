import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Géométrie dérivée de l'illustration source (710x464, détourée) découpée en deux pièces à
// x=220 : la nageoire caudale (queue) bat sur un pivot propre pendant que le corps ne fait que
// traverser + tanguer — seule la queue simule vraiment un mouvement de nage.
const TAIL_WIDTH = 34;
const TAIL_HEIGHT = 59;
const TAIL_TOP = 13; // décalage vertical de la queue dans le conteneur (voir BODY_HEIGHT)
const BODY_WIDTH = 76;
const BODY_HEIGHT = 72;
const SHARK_WIDTH = TAIL_WIDTH + BODY_WIDTH;
const SHARK_HEIGHT = BODY_HEIGHT;

const SWIM_DURATION_MS = 3200;
const TAIL_BEAT_MS = 180;
const TAIL_BEAT_DEG = 20;

/**
 * Easter egg "buff shark" : traverse l'écran une fois quand `visible` passe à true (déclenché
 * en tapant 5x sur le chrono de séance). Corps et queue sont deux images séparées
 * (assets/shark_body.png, assets/shark_tail.png) : la queue pivote sur son bord droit (le point
 * d'attache au corps) pour simuler un vrai battement de nage, le corps se contente de tanguer.
 */
export const SharkOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const translateX = useRef(new Animated.Value(-SHARK_WIDTH)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const tailBeat = useRef(new Animated.Value(0)).current;

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
    const battement = Animated.loop(
      Animated.sequence([
        Animated.timing(tailBeat, { toValue: 1, duration: TAIL_BEAT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tailBeat, { toValue: -1, duration: TAIL_BEAT_MS * 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tailBeat, { toValue: 0, duration: TAIL_BEAT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    tangage.start();
    battement.start();
    swim.start(() => {
      tangage.stop();
      battement.stop();
    });

    return () => {
      swim.stop();
      tangage.stop();
      battement.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const tailRotate = tailBeat.interpolate({ inputRange: [-1, 1], outputRange: [`-${TAIL_BEAT_DEG}deg`, `${TAIL_BEAT_DEG}deg`] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { transform: [{ translateX }, { translateY }] }]}
    >
      <Animated.View
        style={[
          styles.tailWrap,
          { transform: [{ translateX: TAIL_WIDTH / 2 }, { rotate: tailRotate }, { translateX: -TAIL_WIDTH / 2 }] },
        ]}
      >
        <Image source={require('../../assets/shark_tail.png')} style={styles.tail} resizeMode="contain" />
      </Animated.View>
      <Image source={require('../../assets/shark_body.png')} style={styles.body} resizeMode="contain" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '38%',
    left: 0,
    width: SHARK_WIDTH,
    height: SHARK_HEIGHT,
    zIndex: 999,
  },
  tailWrap: {
    position: 'absolute',
    left: 0,
    top: TAIL_TOP,
    width: TAIL_WIDTH,
    height: TAIL_HEIGHT,
  },
  tail: {
    width: TAIL_WIDTH,
    height: TAIL_HEIGHT,
  },
  body: {
    position: 'absolute',
    left: TAIL_WIDTH,
    top: 0,
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
  },
});
