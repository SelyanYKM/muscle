import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle;
  pxPerSecond?: number;
}

/**
 * Texte sur une seule ligne qui défile automatiquement s'il dépasse la largeur disponible
 * (nom d'exercice long), au lieu d'être tronqué par des points de suspension ou coupé net.
 * Centré et immobile tant que le texte tient dans la largeur ; glisse vers la gauche, marque un
 * temps d'arrêt aux deux bouts, puis reprend depuis le début, en boucle.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({ text, style, containerStyle, pxPerSecond = 40 }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const overflow = textWidth - containerWidth;
  const shouldScroll = containerWidth > 0 && overflow > 4;

  useEffect(() => {
    loopRef.current?.stop();
    translateX.setValue(0);
    if (!shouldScroll) return;

    const distance = overflow + 24; // petite marge avant de revenir au début
    const scrollDuration = (distance / pxPerSecond) * 1000;
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(translateX, { toValue: -distance, duration: scrollDuration, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [shouldScroll, overflow, pxPerSecond, text]);

  return (
    <View
      style={[styles.container, { alignItems: shouldScroll ? 'flex-start' : 'center' }, containerStyle]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text style={style} numberOfLines={1} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
});
