import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FEELING_DOT } from '../constants/feeling';
import { THEME } from '../theme';
import { SetResult } from '../types';
import { durationA11y, kgA11y } from '../utils/a11y';
import { playRestTimerAlarm } from '../utils/audio';
import { fmtKg, formatMinSec } from '../utils/format';
import { triggerLightHaptic, triggerTimerEndHaptic, triggerWarningHaptic } from '../utils/haptics';
import {
  ACTION_PAUSE,
  ACTION_RESUME,
  ACTION_SKIP,
  hideRestTimerLiveNotification,
  REST_TIMER_ACTION_EVENT,
  showRestTimerPausedNotification,
  showRestTimerRunningNotification,
} from '../utils/restTimerNotifee';
import {
  requestRestTimerPermission,
  startRestTimerService,
  stopRestTimerService,
} from '../utils/restTimerService';

interface RestTimerOverlayProps {
  initialSeconds: number;
  exerciseName: string;
  nextSetNumber: number;
  nextWeight: number;
  nextReps: number;
  onSkip: () => void;
  onFinish: () => void;
  /** Ferme le repos et annule la dernière série validée (accessible directement depuis cet écran). */
  onUndo?: () => void;
  /** Série qui vient d'être validée, rappelée en haut de l'écran (absente pour un repos d'échauffement). */
  lastSet?: SetResult;
}

const RING_SIZE = 264;
const RING_STROKE = 13;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const RestTimerOverlay: React.FC<RestTimerOverlayProps> = ({
  initialSeconds,
  exerciseName,
  nextSetNumber,
  nextWeight,
  nextReps,
  onSkip,
  onFinish,
  onUndo,
  lastSet,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [isPaused, setIsPaused] = useState(false);

  // Timestamp cible absolu pour ne jamais perdre le temps en arrière-plan
  const targetTimeRef = useRef<number>(Date.now() + initialSeconds * 1000);

  // Empêche l'AppState listener et le setInterval de déclencher la fin du repos deux fois
  const hasEndedRef = useRef<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Source de vérité pour l'état pause, lue depuis des callbacks enregistrés une seule fois
  // au montage (écouteur DeviceEventEmitter ci-dessous) : une ref ne se fige jamais, contrairement
  // à une valeur de state capturée dans la fermeture au moment du montage.
  const isPausedRef = useRef<boolean>(false);
  const pauseRemainingMsRef = useRef<number>(0);

  // Animation de pulsation et d'entrée
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const setInfo = { exerciseName, nextSetNumber, nextWeight, nextReps };

  // Retour sur la série validée : réussie si l'objectif de reps est atteint (même règle que
  // FreeWorkoutScreen.handleCompleteSet), sinon "sous l'objectif".
  const lastSetMet = !!lastSet && lastSet.feeling !== 'HARD';
  const lastSetText = lastSet
    ? `Série ${lastSet.setNumber} ${lastSetMet ? 'réussie' : "sous l'objectif"} · ${lastSet.repsDone}/${lastSet.targetReps} reps`
    : null;
  const notificationBody = `${exerciseName} • Série ${nextSetNumber} • ${nextWeight} kg`;

  // Déclenche l'alerte de fin de repos une seule fois, quel que soit le chemin qui la détecte
  // (retour au premier plan ou minuteur classique).
  const finishNow = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    hideRestTimerLiveNotification();
    triggerTimerEndHaptic();
    playRestTimerAlarm();
    AccessibilityInfo.announceForAccessibility('Repos terminé');
    onFinish();
  };

  // Un seul tick, réutilisé par l'intervalle initial et par la reprise après une pause.
  const tick = () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetTimeRef.current - now) / 1000));
    setSecondsRemaining(remaining);

    if (remaining <= 0) {
      finishNow();
      return;
    }

    // Micro-pulsation
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.04,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    if (remaining === 4 || remaining === 3 || remaining === 2) {
      triggerWarningHaptic();
    }

    // Repère vocal pour le lecteur d'écran (sans effet quand TalkBack / VoiceOver est coupé).
    if (remaining === 10) {
      AccessibilityInfo.announceForAccessibility('Encore 10 secondes de repos');
    }
  };

  // Bascule Pause/Reprendre, déclenchable depuis le bouton en appli ou depuis la notification
  // (voir l'écouteur DeviceEventEmitter ci-dessous) — ne lit/écrit que des refs, jamais de
  // state capturé, pour rester correcte même appelée depuis un écouteur figé au montage.
  const togglePause = () => {
    if (hasEndedRef.current) return;
    triggerLightHaptic();

    if (isPausedRef.current) {
      targetTimeRef.current = Date.now() + pauseRemainingMsRef.current;
      isPausedRef.current = false;
      setIsPaused(false);
      intervalRef.current = setInterval(tick, 1000);
      showRestTimerRunningNotification(targetTimeRef.current, setInfo);
      // Reprogramme le filet de secours expo-notifications sur le nouveau temps cible — sinon
      // il reste calé sur l'ancienne heure de fin (celle d'avant la pause) et peut sonner trop
      // tôt (ou pendant la pause elle-même, voir ci-dessous).
      startRestTimerService(targetTimeRef.current, notificationBody);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      pauseRemainingMsRef.current = Math.max(0, targetTimeRef.current - Date.now());
      isPausedRef.current = true;
      setIsPaused(true);
      setSecondsRemaining(Math.ceil(pauseRemainingMsRef.current / 1000));
      showRestTimerPausedNotification(Math.ceil(pauseRemainingMsRef.current / 1000), setInfo);
      // Annule l'alerte programmée : tant qu'on est en pause, aucune alarme ne doit sonner.
      stopRestTimerService();
    }
  };

  const handleSkip = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    hideRestTimerLiveNotification();
    triggerLightHaptic();
    onSkip();
  };

  const handleUndo = () => {
    if (hasEndedRef.current || !onUndo) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    hideRestTimerLiveNotification();
    onUndo();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (lastSet) {
      AccessibilityInfo.announceForAccessibility(
        `Série ${lastSet.setNumber} ${lastSet.feeling !== 'HARD' ? 'réussie' : "sous l'objectif"}, ${lastSet.repsDone} reps sur ${lastSet.targetReps}`
      );
    }

    // Service au premier plan Android avec notification persistante (chronomètre natif +
    // boutons Pause/Passer) : contrairement au son/vibration ci-dessus (qui dépendent du code
    // JS en cours d'exécution), ça garde l'app active pendant tout le repos, donc l'alarme
    // sonne fiablement même écran verrouillé ou app en arrière-plan. L'alerte programmée via
    // expo-notifications (startRestTimerService) reste en plus comme filet de secours si ce
    // service venait à être tué par un gestionnaire de batterie agressif (MIUI etc.).
    let isMounted = true;
    requestRestTimerPermission().then((granted) => {
      if (granted && isMounted) {
        startRestTimerService(targetTimeRef.current, notificationBody);
        showRestTimerRunningNotification(targetTimeRef.current, setInfo);
      }
    });

    // Appuis sur Pause/Reprendre/Passer depuis la notification, que l'app soit ouverte ou en
    // arrière-plan (App.tsx et index.ts relaient les deux cas vers ce même événement).
    const actionSubscription = DeviceEventEmitter.addListener(REST_TIMER_ACTION_EVENT, (actionId: string) => {
      if (actionId === ACTION_PAUSE || actionId === ACTION_RESUME) {
        togglePause();
      } else if (actionId === ACTION_SKIP) {
        handleSkip();
      }
    });

    // Écouteur de changement de premier plan / arrière-plan (depuis Spotify / écran verrouillé) :
    // recalcule juste le temps restant affiché au retour, la notification live reste à jour
    // d'elle-même entre-temps (chronomètre natif).
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !isPausedRef.current) {
        const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          finishNow();
        }
      }
    });

    // Intervalle régulier d'animation et de décompte
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      actionSubscription.remove();
      subscription.remove();
      stopRestTimerService();
      hideRestTimerLiveNotification();
    };
  }, []);

  const addTime = (secs: number) => {
    triggerLightHaptic();

    // En pause : on ajuste directement le temps gelé, sans toucher à targetTimeRef (qui ne
    // redevient pertinent qu'à la reprise).
    if (isPausedRef.current) {
      pauseRemainingMsRef.current = Math.max(0, pauseRemainingMsRef.current + secs * 1000);
      const newRemaining = Math.ceil(pauseRemainingMsRef.current / 1000);
      setSecondsRemaining(newRemaining);
      if (secs > 0) {
        setTotalSeconds((prev) => prev + secs);
      }
      showRestTimerPausedNotification(newRemaining, setInfo);
      return;
    }

    targetTimeRef.current += secs * 1000;
    const newRemaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
    setSecondsRemaining(newRemaining);
    // Le total (dénominateur de l'anneau) ne grandit que si on AJOUTE du temps ;
    // retirer du temps raccourcit juste le repos restant sans faire "sauter" l'anneau.
    if (secs > 0) {
      setTotalSeconds((prev) => prev + secs);
    }

    // Met à jour le décompte affiché dans les deux notifications
    if (newRemaining > 0) {
      startRestTimerService(targetTimeRef.current, notificationBody);
      showRestTimerRunningNotification(targetTimeRef.current, setInfo);
    }
  };

  const formattedTime = formatMinSec(secondsRemaining);
  const formattedTotal = formatMinSec(totalSeconds);

  const progressFraction = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progressFraction);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.root}>
        <LinearGradient
          colors={[THEME.colors.textPrimary, THEME.colors.accentDark, THEME.colors.accentStrong]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Défilement de secours : sur un petit écran (ou police agrandie), "Je suis prêt" ne
            doit jamais sortir de l'écran. Sans effet quand tout tient. */}
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.topGroup}>
            <Text style={styles.topSub}>{isPaused ? 'EN PAUSE' : 'RÉCUPÉRATION'}</Text>
            {!!lastSetText && (
              <View style={styles.lastSetPill}>
                <View
                  style={[
                    styles.lastSetMark,
                    lastSetMet
                      ? { backgroundColor: FEELING_DOT[lastSet!.feeling] }
                      : { borderWidth: 2, borderColor: FEELING_DOT.HARD },
                  ]}
                />
                <Text style={styles.lastSetText}>{lastSetText}</Text>
              </View>
            )}
          </View>

          {/* Anneau de progression avec chronomètre centré */}
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            accessible
            accessibilityRole="timer"
            accessibilityLabel={`${isPaused ? 'Repos en pause' : 'Repos'} : ${durationA11y(secondsRemaining)} restantes sur ${durationA11y(totalSeconds)}`}
          >
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="rgba(255, 255, 255, 0.14)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={THEME.colors.accent}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={dashOffset}
                rotation={-90}
                originX={RING_SIZE / 2}
                originY={RING_SIZE / 2}
              />
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.ringInner]}>
              <Text style={styles.timeBig}>{formattedTime}</Text>
              <Text style={styles.timeOf}>sur {formattedTotal}</Text>
            </View>
          </Animated.View>

          {/* Pause/Reprendre — reflète et pilote le même état que les boutons de la notification */}
          <TouchableOpacity
            style={styles.pauseToggleBtn}
            onPress={togglePause}
            activeOpacity={0.75}
            hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Reprendre le repos' : 'Mettre le repos en pause'}
          >
            <Text style={styles.pauseToggleText}>{isPaused ? '▶  Reprendre' : '⏸  Pause'}</Text>
          </TouchableOpacity>

          {/* Boutons d'ajustement du repos */}
          <View style={styles.adjustRow}>
            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() => addTime(-15)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Retirer 15 secondes"
            >
              <Text style={styles.adjustBtnText}>−15s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() => addTime(30)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Ajouter 30 secondes"
            >
              <Text style={styles.adjustBtnText}>+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() => addTime(60)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Ajouter 60 secondes"
            >
              <Text style={styles.adjustBtnText}>+60s</Text>
            </TouchableOpacity>
          </View>

          {/* Teaser Prochaine Série */}
          <View
            style={styles.nextSetInfoCard}
            accessible
            accessibilityLabel={`Prochaine série : ${exerciseName}, série ${nextSetNumber}, ${kgA11y(nextWeight)}, ${nextReps} reps`}
          >
            <Text style={styles.nextSetLabel}>PROCHAINE SÉRIE</Text>
            <Text style={styles.nextSetTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.nextSetDetails}>
              Série {nextSetNumber} · <Text style={styles.nextSetHighlight}>{fmtKg(nextWeight)} kg</Text> × {nextReps}
            </Text>
          </View>

          {/* Bouton Prêt + correction, groupés et serrés */}
          <View style={styles.bottomGroup}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityHint="Termine le repos"
          >
            <Text style={styles.skipButtonText}>Je suis prêt</Text>
          </TouchableOpacity>

          {/* Correction d'une erreur de validation, sans attendre la fin du repos */}
          {onUndo && (
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndo}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityHint="Annule la série que tu viens de valider"
            >
              <Text style={styles.undoBtnText}>Corriger la dernière série</Text>
            </TouchableOpacity>
          )}
          </View>
        </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 34,
    gap: 22,
  },
  topSub: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.accent,
    letterSpacing: 2.4,
  },
  ringInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBig: {
    fontFamily: THEME.fonts.serif,
    fontSize: 80,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  timeOf: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
  },
  pauseToggleBtn: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pauseToggleText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: '#FFFFFF',
    fontSize: 13,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adjustBtn: {
    height: 44,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  adjustBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: '#FFFFFF',
    fontSize: 14,
  },
  nextSetInfoCard: {
    width: '100%',
    borderRadius: THEME.radius.card,
    padding: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  nextSetLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accent,
    letterSpacing: 1,
    marginBottom: 6,
  },
  nextSetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 21,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nextSetDetails: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  nextSetHighlight: {
    color: THEME.colors.accent,
    fontFamily: THEME.fonts.sansHeavy,
  },
  skipButton: {
    width: '100%',
    height: 56,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.accentTextDark,
    fontSize: 15,
  },
  topGroup: {
    alignItems: 'center',
    gap: 10,
  },
  lastSetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  lastSetMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastSetText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  bottomGroup: {
    width: '100%',
    gap: 10,
  },
  undoBtn: {
    width: '100%',
    height: 44,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBtnText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 13,
  },
});
