import { Asset } from 'expo-asset';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { playBuffRequinSounds } from '../utils/audio';
import { triggerBuffRequinHaptics } from '../utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORIGIN = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT * 0.38 };

// Une seule résolution de chaque asset (réutilisée partout ci-dessous) : évite tout doute sur
// une divergence entre plusieurs require() du même fichier.
const SHARK_SOURCE = require('../../assets/shark_buff.png');
const SPEED_LINES_SOURCE = require('../../assets/speed_lines.png');

/**
 * Précharge shark_buff.png et speed_lines.png — images AJOUTÉES par cette mise à jour OTA,
 * donc pas déjà dans l'APK : sans ce préchargement, la toute première fois que le buff se
 * déclenche après une mise à jour, l'image peut ne pas avoir fini de se télécharger et
 * Android affiche un icône de secours (triangle) à la place, le temps que ça charge.
 */
export function preloadBuffRequinAssets(): void {
  Asset.loadAsync([SHARK_SOURCE, SPEED_LINES_SOURCE]).catch(() => {});
}

const EXP = Easing.bezier(0.16, 1, 0.3, 1); // tout ce qui frappe
const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45); // sorties
const EASE_OUT = Easing.out(Easing.quad);
const LINEAR = Easing.linear;

const GOLD = '#FDC500';
const GOLD_LIGHT = '#FFE27A';
const NAVY = '#00296B';

// ---------------------------------------------------------------------------
// Petit moteur de timeline par propriété : chaque Kf décrit un point (t, valeur) et
// l'easing du SEGMENT QUI SUIT ce point (sémantique Web Animations), un Animated.Value par
// propriété animée. Reproduit fidèlement les séquences du prototype (span()/A() dans
// support.js) sans react-native-reanimated, pour rester livrable en OTA.
// ---------------------------------------------------------------------------
interface Kf {
  t: number;
  v: number;
  e?: (t: number) => number;
}

function timeline(val: Animated.Value, kfs: Kf[]): Animated.CompositeAnimation {
  const steps = kfs.slice(1).map((kf, i) =>
    Animated.timing(val, {
      toValue: kf.v,
      duration: kf.t - kfs[i].t,
      easing: kfs[i].e || LINEAR,
      useNativeDriver: true,
    })
  );
  // `val` garde sa valeur de repos (celle du useRef initial, pensée pour être neutre/masquée)
  // pendant tout le délai — le saut à kfs[0].v n'arrive qu'à kfs[0].t, jamais avant, sinon
  // chaque calque se réglait sur son état "au moment où il apparaît" dès le déclenchement.
  return Animated.sequence([
    Animated.delay(kfs[0].t),
    Animated.timing(val, { toValue: kfs[0].v, duration: 0, useNativeDriver: true }),
    ...steps,
  ]);
}

// Rotation : RN exige une chaîne "Xdeg", jamais un nombre brut, d'où cet interpolate.
const deg = (val: Animated.Value) => val.interpolate({ inputRange: [-1000, 1000], outputRange: ['-1000deg', '1000deg'] });

/** Micro-tremblement : n petits pas aléatoires bornés par 0 au départ et à l'arrivée. */
function microShakeSteps(val: Animated.Value, amplitude: number, duration: number, steps = 7): Kf[] {
  const kfs: Kf[] = [{ t: 0, v: 0 }];
  const stepDur = duration / steps;
  for (let i = 1; i < steps; i++) {
    const amp = amplitude * (1 - i / steps);
    kfs.push({ t: i * stepDur, v: (Math.random() * 2 - 1) * amp });
  }
  kfs.push({ t: duration, v: 0 });
  return kfs;
}

// ---------------------------------------------------------------------------
// Éclat triangulaire doré (CSS triangle via bordures) — utilisé pour les 12 éclats
// convergents (charge) et les 18 éclats du burst (révélation).
// ---------------------------------------------------------------------------
const Shard: React.FC<{ kind: 'converge' | 'burst' }> = ({ kind }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const spec = useRef({
    w: 10 + Math.random() * 12,
    color: Math.random() < 1 / 3 ? GOLD_LIGHT : GOLD,
    angle: Math.random() * Math.PI * 2,
    radius: kind === 'converge' ? 200 + Math.random() * 120 : 170 + Math.random() * 230,
    startRotation: kind === 'converge' ? Math.random() * 360 : 0,
    endRotation: kind === 'converge' ? 0 : Math.random() * 720 - 360,
    delay: kind === 'converge' ? Math.random() * 200 : 530,
    duration: kind === 'converge' ? 250 : 450 + Math.random() * 350,
  }).current;

  useEffect(() => {
    const easing = kind === 'converge' ? EASE_IN : EXP;
    Animated.timing(progress, {
      toValue: 1,
      duration: spec.duration,
      delay: spec.delay,
      easing,
      useNativeDriver: true,
    }).start();
  }, []);

  const dx = Math.cos(spec.angle) * spec.radius;
  const dy = Math.sin(spec.angle) * spec.radius;

  const translateX = kind === 'converge' ? progress.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) : progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = kind === 'converge' ? progress.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) : progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const rotation = progress.interpolate({ inputRange: [0, 1], outputRange: [spec.startRotation, spec.endRotation] });
  const scale = kind === 'converge' ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) : progress.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.5] });
  // Les éclats convergents doivent s'éteindre AVANT d'arriver au centre (effet "étincelles qui
  // se consument en approchant"), pas pile dessus.
  // Pour les deux types : `progress` vaut 0 aussi bien "avant que son delay ne s'écoule" (pas
  // encore parti) qu'"au tout début de son animation" (vient de partir) — l'interpolation doit
  // donc valoir 0 en 0, jamais 1, sinon l'éclat est pleinement visible, immobile à l'origine,
  // pendant tout son delay. C'était le vrai bug : les 18 éclats du burst (delay fixe 530ms)
  // restaient tous visibles et superposés à l'origine jusqu'à 530ms, lus comme un triangle figé.
  const opacity = kind === 'converge'
    ? progress.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 1, 0, 0] })
    : progress.interpolate({ inputRange: [0, 0.05, 0.6, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: ORIGIN.x,
        top: ORIGIN.y,
        opacity,
        transform: [
          { translateX },
          { translateY },
          { rotate: rotation.interpolate({ inputRange: [-1000, 1000], outputRange: ['-1000deg', '1000deg'] }) },
          { scale },
        ],
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: spec.w / 2,
          borderRightWidth: spec.w / 2,
          borderBottomWidth: spec.w * 1.3,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: spec.color,
        }}
      />
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Texte avec contour (RN n'a pas de text-stroke natif) : 8 copies décalées en #00296B
// derrière le texte coloré, + une ombre dure (sans flou) décalée.
// ---------------------------------------------------------------------------
const StrokedText: React.FC<{
  text: string;
  fontSize: number;
  color: string;
  shadowOffset: number;
  style?: object;
}> = ({ text, fontSize, color, shadowOffset, style }) => {
  const base = { fontFamily: 'Anton_400Regular', fontSize, letterSpacing: 1 };
  const copies = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return { x: Math.cos(angle) * 2.5, y: Math.sin(angle) * 2.5 };
  });
  return (
    <View style={style}>
      <Text style={[base, { color: NAVY, position: 'absolute', transform: [{ translateX: shadowOffset }, { translateY: shadowOffset }] }]}>
        {text}
      </Text>
      {copies.map((o, i) => (
        <Text key={i} style={[base, { color: NAVY, position: 'absolute', transform: [{ translateX: o.x }, { translateY: o.y }] }]}>
          {text}
        </Text>
      ))}
      <Text style={[base, { color }]}>{text}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// BuffRequin — wrapper plein écran : Camera (shake) > Zoom (écran de séance) + Overlay
// (effets, pointerEvents none). `active` passe à true déclenche la séquence 1,8 s
// (anticipation → impact → rémanence) ; le parent garde `active` true le temps de la
// séquence + un peu de marge, voir FreeWorkoutScreen.
// ---------------------------------------------------------------------------
export const BuffRequin: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => {
  const [playing, setPlaying] = React.useState(false);

  const camX = useRef(new Animated.Value(0)).current;
  const camY = useRef(new Animated.Value(0)).current;
  const zoomScale = useRef(new Animated.Value(1)).current;

  const dimOpacity = useRef(new Animated.Value(0)).current;

  const convKey = useRef(0);
  const burstKey = useRef(0);

  const ringScale = useRef(new Animated.Value(2.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const silScale = useRef(new Animated.Value(0.3)).current;
  const silOpacity = useRef(new Animated.Value(0)).current;

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashGoldOpacity = useRef(new Animated.Value(0)).current;

  const sharkOpacity = useRef(new Animated.Value(0)).current;
  const sharkScale = useRef(new Animated.Value(0.35)).current;
  const sharkTranslateX = useRef(new Animated.Value(0)).current;
  const sharkImgScaleX = useRef(new Animated.Value(1)).current;
  const sharkImgScaleY = useRef(new Animated.Value(1)).current;

  const ghost1Opacity = useRef(new Animated.Value(0)).current;
  const ghost1TranslateX = useRef(new Animated.Value(0)).current;
  const ghost1ScaleX = useRef(new Animated.Value(1.2)).current;
  const ghost1ScaleY = useRef(new Animated.Value(0.9)).current;
  const ghost2Opacity = useRef(new Animated.Value(0)).current;
  const ghost2TranslateX = useRef(new Animated.Value(0)).current;
  const ghost2ScaleX = useRef(new Animated.Value(1.2)).current;
  const ghost2ScaleY = useRef(new Animated.Value(0.9)).current;

  const shockScale = useRef(new Animated.Value(0.2)).current;
  const shockOpacity = useRef(new Animated.Value(0)).current;
  const shock2Scale = useRef(new Animated.Value(0.2)).current;
  const shock2Opacity = useRef(new Animated.Value(0)).current;

  const linesOpacity = useRef(new Animated.Value(0)).current;
  const linesRotate = useRef(new Animated.Value(0)).current;

  const w1Opacity = useRef(new Animated.Value(0)).current;
  const w1Scale = useRef(new Animated.Value(3)).current;
  const w1TranslateX = useRef(new Animated.Value(0)).current;
  const w2Opacity = useRef(new Animated.Value(0)).current;
  const w2Scale = useRef(new Animated.Value(3)).current;
  const w2TranslateX = useRef(new Animated.Value(0)).current;
  const textShakeX = useRef(new Animated.Value(0)).current;
  const textShakeY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    setPlaying(true);
    convKey.current += 1;
    burstKey.current += 1;
    triggerBuffRequinHaptics();
    playBuffRequinSounds();

    const anims: Animated.CompositeAnimation[] = [
      timeline(zoomScale, [{ t: 0, v: 1, e: EASE_OUT }, { t: 150, v: 1.04 }, { t: 1500, v: 1.04, e: EXP }, { t: 1800, v: 1 }]),
      timeline(dimOpacity, [{ t: 0, v: 0 }, { t: 150, v: 1 }, { t: 1500, v: 1 }, { t: 1800, v: 0 }]),
      timeline(ringScale, [{ t: 150, v: 2.4, e: EASE_IN }, { t: 450, v: 0.45 }]),
      timeline(ringOpacity, [{ t: 150, v: 0, e: EASE_IN }, { t: 250, v: 0.9 }, { t: 450, v: 1 }, { t: 460, v: 0 }]),
      timeline(silScale, [{ t: 150, v: 0.3 }, { t: 230, v: 0.34 }, { t: 449, v: 0.36 }]),
      timeline(silOpacity, [{ t: 150, v: 0 }, { t: 230, v: 1 }, { t: 449, v: 1 }, { t: 450, v: 0 }]),
      timeline(flashOpacity, [{ t: 450, v: 1 }, { t: 510, v: 1 }, { t: 520, v: 0 }]),
      timeline(flashGoldOpacity, [{ t: 510, v: 0.9, e: EASE_OUT }, { t: 900, v: 0 }]),
      timeline(sharkOpacity, [{ t: 450, v: 1 }, { t: 1800, v: 1 }]),
      timeline(sharkScale, [{ t: 450, v: 0.35 }, { t: 530, v: 0.35, e: EXP }, { t: 700, v: 1.2, e: EASE_OUT }, { t: 860, v: 1 }, { t: 1500, v: 1, e: EASE_IN }, { t: 1800, v: 1 }]),
      timeline(sharkTranslateX, [{ t: 450, v: 0 }, { t: 1500, v: 0, e: EASE_IN }, { t: 1800, v: -620 }]),
      timeline(sharkImgScaleX, [{ t: 700, v: 1 }, { t: 760, v: 1.15 }, { t: 860, v: 1 }, { t: 1500, v: 1, e: EASE_OUT }, { t: 1600, v: 1.5 }, { t: 1800, v: 1.5 }]),
      timeline(sharkImgScaleY, [{ t: 700, v: 1 }, { t: 760, v: 0.88 }, { t: 860, v: 1 }, { t: 1500, v: 1, e: EASE_OUT }, { t: 1600, v: 0.85 }, { t: 1800, v: 0.85 }]),
      timeline(ghost1Opacity, [{ t: 1540, v: 0, e: EASE_IN }, { t: 1585, v: 0.45, e: EASE_IN }, { t: 1750, v: 0.45, e: EASE_IN }, { t: 1840, v: 0 }]),
      timeline(ghost1TranslateX, [{ t: 1540, v: 0, e: EASE_IN }, { t: 1840, v: -620 }]),
      timeline(ghost1ScaleX, [{ t: 1540, v: 1.2, e: EASE_IN }, { t: 1840, v: 1.5 }]),
      timeline(ghost1ScaleY, [{ t: 1540, v: 0.9, e: EASE_IN }, { t: 1840, v: 0.85 }]),
      timeline(ghost2Opacity, [{ t: 1580, v: 0, e: EASE_IN }, { t: 1625, v: 0.22, e: EASE_IN }, { t: 1790, v: 0.22, e: EASE_IN }, { t: 1880, v: 0 }]),
      timeline(ghost2TranslateX, [{ t: 1580, v: 0, e: EASE_IN }, { t: 1880, v: -620 }]),
      timeline(ghost2ScaleX, [{ t: 1580, v: 1.2, e: EASE_IN }, { t: 1880, v: 1.5 }]),
      timeline(ghost2ScaleY, [{ t: 1580, v: 0.9, e: EASE_IN }, { t: 1880, v: 0.85 }]),
      timeline(shockScale, [{ t: 530, v: 0.2, e: EXP }, { t: 900, v: 3.2 }]),
      timeline(shockOpacity, [{ t: 530, v: 1, e: EXP }, { t: 900, v: 0 }]),
      timeline(shock2Scale, [{ t: 590, v: 0.2, e: EXP }, { t: 980, v: 4 }]),
      timeline(shock2Opacity, [{ t: 590, v: 0.9, e: EXP }, { t: 980, v: 0 }]),
      timeline(linesOpacity, [{ t: 530, v: 0 }, { t: 620, v: 0.9 }, { t: 1500, v: 0.7 }, { t: 1800, v: 0 }]),
      timeline(linesRotate, [{ t: 530, v: 0 }, { t: 1800, v: 45 }]),
      timeline(w1Opacity, [{ t: 700, v: 0, e: EXP }, { t: 820, v: 1 }, { t: 1550, v: 1, e: EASE_IN }, { t: 1750, v: 0 }]),
      timeline(w1Scale, [{ t: 700, v: 3, e: EXP }, { t: 820, v: 1 }, { t: 1550, v: 1 }, { t: 1750, v: 1 }]),
      timeline(w1TranslateX, [{ t: 700, v: 0 }, { t: 1550, v: 0, e: EASE_IN }, { t: 1750, v: -460 }]),
      timeline(w2Opacity, [{ t: 780, v: 0, e: EXP }, { t: 900, v: 1 }, { t: 1590, v: 1, e: EASE_IN }, { t: 1750, v: 0 }]),
      timeline(w2Scale, [{ t: 780, v: 3, e: EXP }, { t: 900, v: 1 }, { t: 1590, v: 1 }, { t: 1750, v: 1 }]),
      timeline(w2TranslateX, [{ t: 780, v: 0 }, { t: 1590, v: 0, e: EASE_IN }, { t: 1750, v: -460 }]),
      // Mini-shake sur le bloc texte : deux secousses du prototype (820 et 900 ms) se
      // chevauchent sur la même propriété côté web ; on les fusionne en une seule secousse
      // continue 820→1020 ms, visuellement équivalente et sans timeline qui revient en arrière.
      timeline(textShakeX, microShakeSteps(textShakeX, 4, 200).map((kf) => ({ ...kf, t: kf.t + 820 }))),
      timeline(textShakeY, microShakeSteps(textShakeY, 4, 200).map((kf) => ({ ...kf, t: kf.t + 820 }))),
      timeline(camX, [{ t: 530, v: 0 }, ...microShakeSteps(camX, 9, 300).slice(1).map((kf) => ({ ...kf, t: kf.t + 530 }))]),
      timeline(camY, [{ t: 530, v: 0 }, ...microShakeSteps(camY, 9, 300).slice(1).map((kf) => ({ ...kf, t: kf.t + 530 }))]),
    ];

    Animated.parallel(anims).start();

    const stopTimer = setTimeout(() => setPlaying(false), 1900);
    return () => {
      clearTimeout(stopTimer);
    };
  }, [active]);

  if (!playing) return <>{children}</>;

  return (
    <Animated.View style={[styles.flex, { transform: [{ translateX: camX }, { translateY: camY }] }]}>
      <Animated.View style={[styles.flex, { transform: [{ scale: zoomScale }], transformOrigin: '50% 30%' } as object]}>
        {children}
      </Animated.View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.dim, { opacity: dimOpacity }]} />

        <Animated.Image
          source={SPEED_LINES_SOURCE}
          style={[
            styles.speedLines,
            { left: ORIGIN.x - 240, top: ORIGIN.y - 240, opacity: linesOpacity, transform: [{ rotate: deg(linesRotate) }] },
          ]}
          resizeMode="contain"
        />

        <React.Fragment key={`conv-${convKey.current}`}>
          {Array.from({ length: 12 }, (_, i) => <Shard key={i} kind="converge" />)}
        </React.Fragment>

        <Animated.View style={[styles.ring, { left: ORIGIN.x - 110, top: ORIGIN.y - 110, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

        <Animated.View
          style={[
            styles.sharkWrap,
            { left: ORIGIN.x - 150, top: ORIGIN.y - 97, opacity: silOpacity, transform: [{ scale: silScale }] },
          ]}
        >
          <Image source={SHARK_SOURCE} style={styles.sharkImg} tintColor="#000" resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.shock, { left: ORIGIN.x - 100, top: ORIGIN.y - 100, opacity: shockOpacity, transform: [{ scale: shockScale }] }]} />
        <Animated.View style={[styles.shock2, { left: ORIGIN.x - 100, top: ORIGIN.y - 100, opacity: shock2Opacity, transform: [{ scale: shock2Scale }] }]} />

        <React.Fragment key={`burst-${burstKey.current}`}>
          {Array.from({ length: 18 }, (_, i) => <Shard key={i} kind="burst" />)}
        </React.Fragment>

        <Animated.View style={[styles.sharkWrap, { left: ORIGIN.x - 150, top: ORIGIN.y - 97, opacity: ghost2Opacity, transform: [{ translateX: ghost2TranslateX }, { scaleX: ghost2ScaleX }, { scaleY: ghost2ScaleY }] }]}>
          <Image source={SHARK_SOURCE} style={styles.sharkImg} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.sharkWrap, { left: ORIGIN.x - 150, top: ORIGIN.y - 97, opacity: ghost1Opacity, transform: [{ translateX: ghost1TranslateX }, { scaleX: ghost1ScaleX }, { scaleY: ghost1ScaleY }] }]}>
          <Image source={SHARK_SOURCE} style={styles.sharkImg} resizeMode="contain" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sharkWrap,
            { left: ORIGIN.x - 150, top: ORIGIN.y - 97, opacity: sharkOpacity, transform: [{ translateX: sharkTranslateX }, { scale: sharkScale }] },
          ]}
        >
          <Animated.Image
            source={SHARK_SOURCE}
            style={[styles.sharkImg, { transform: [{ scaleX: sharkImgScaleX }, { scaleY: sharkImgScaleY }] }]}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.textBlock} pointerEvents="none">
          <Animated.View
            style={{
              opacity: w1Opacity,
              transform: [{ translateX: w1TranslateX }, { translateX: textShakeX }, { translateY: textShakeY }, { scale: w1Scale }],
            }}
          >
            <StrokedText text="BUFF" fontSize={104} color={GOLD} shadowOffset={6} />
          </Animated.View>
          <Animated.View
            style={{
              opacity: w2Opacity,
              transform: [{ translateX: w2TranslateX }, { translateX: textShakeX }, { translateY: textShakeY }, { scale: w2Scale }],
            }}
          >
            <StrokedText text="REQUIN" fontSize={70} color="#FFFFFF" shadowOffset={5} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.flashGold, { opacity: flashGoldOpacity }]} />
        <Animated.View style={[styles.flashWhite, { opacity: flashOpacity }]} />
      </View>
    </Animated.View>
  );
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { ...FILL, backgroundColor: 'rgba(0, 18, 52, 0.88)' },
  speedLines: { position: 'absolute', width: 480, height: 480 },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 3, borderColor: GOLD },
  sharkWrap: { position: 'absolute', width: 300 },
  sharkImg: { width: 300, height: 195 },
  shock: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 8, borderColor: GOLD },
  shock2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: '#FFFFFF' },
  textBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SCREEN_HEIGHT * 0.52,
    alignItems: 'center',
    transform: [{ skewX: '-8deg' }],
  },
  flashGold: { ...FILL, backgroundColor: GOLD },
  flashWhite: { ...FILL, backgroundColor: '#FFFFFF' },
});
