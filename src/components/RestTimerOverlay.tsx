import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { THEME } from '../theme';
import { playRestTimerAlarm } from '../utils/audio';
import { fmtKg } from '../utils/format';
import { triggerLightHaptic, triggerTimerEndHaptic, triggerWarningHaptic } from '../utils/haptics';
import {
  armSystemBackupTimer,
  disarmSystemBackupTimer,
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
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);

  // Timestamp cible absolu pour ne jamais perdre le temps en arrière-plan
  const targetTimeRef = useRef<number>(Date.now() + initialSeconds * 1000);

  // Empêche l'AppState listener et le setInterval de déclencher la fin du repos deux fois
  const hasEndedRef = useRef<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation de pulsation et d'entrée
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const notificationBody = `${exerciseName} • Série ${nextSetNumber} • ${nextWeight} kg`;

  // Déclenche l'alerte de fin de repos une seule fois, quel que soit le chemin qui la détecte
  // (retour au premier plan ou minuteur classique).
  const finishNow = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    disarmSystemBackupTimer();
    triggerTimerEndHaptic();
    playRestTimerAlarm();
    onFinish();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    // Service au premier plan Android avec notification persistante : contrairement au
    // son/vibration ci-dessus (qui dépendent du code JS en cours d'exécution), ça garde
    // l'app active pendant tout le repos, donc l'alarme sonne fiablement même écran
    // verrouillé ou app en arrière-plan.
    let isMounted = true;
    requestRestTimerPermission().then((granted) => {
      if (granted && isMounted) {
        startRestTimerService(targetTimeRef.current, notificationBody);
      }
    });

    // Écouteur de changement de premier plan / arrière-plan (depuis Spotify / écran verrouillé).
    // En plus de recalculer le temps restant au retour, on arme/désarme le filet de sécurité
    // de l'appli Horloge du téléphone : seulement actif pendant qu'on est en arrière-plan, pour
    // ne jamais dupliquer le son quand mooscles est ouvert au premier plan.
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));

      if (nextAppState === 'active') {
        setSecondsRemaining(remaining);
        disarmSystemBackupTimer();
        if (remaining <= 0) {
          finishNow();
        }
      } else if (!hasEndedRef.current && remaining > 0) {
        armSystemBackupTimer(remaining, notificationBody);
      }
    });

    // Intervalle régulier d'animation et de décompte
    intervalRef.current = setInterval(() => {
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
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
      stopRestTimerService();
      disarmSystemBackupTimer();
    };
  }, []);

  const addTime = (secs: number) => {
    triggerLightHaptic();
    targetTimeRef.current += secs * 1000;
    const newRemaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
    setSecondsRemaining(newRemaining);
    // Le total (dénominateur de l'anneau) ne grandit que si on AJOUTE du temps ;
    // retirer du temps raccourcit juste le repos restant sans faire "sauter" l'anneau.
    if (secs > 0) {
      setTotalSeconds((prev) => prev + secs);
    }

    // Met à jour le décompte affiché dans la notification persistante
    if (newRemaining > 0) {
      startRestTimerService(targetTimeRef.current, notificationBody);
    }
  };

  const handleSkip = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    disarmSystemBackupTimer();
    triggerLightHaptic();
    onSkip();
  };

  const handleUndo = () => {
    if (hasEndedRef.current || !onUndo) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    disarmSystemBackupTimer();
    onUndo();
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalSecs = totalSeconds % 60;
  const formattedTotal = `${totalMinutes}:${totalSecs < 10 ? '0' : ''}${totalSecs}`;

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

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.topSub}>RÉCUPÉRATION</Text>

          {/* Anneau de progression avec chronomètre centré */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
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

          {/* Boutons d'ajustement du repos */}
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(-15)} activeOpacity={0.7}>
              <Text style={styles.adjustBtnText}>−15s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(30)} activeOpacity={0.7}>
              <Text style={styles.adjustBtnText}>+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(60)} activeOpacity={0.7}>
              <Text style={styles.adjustBtnText}>+60s</Text>
            </TouchableOpacity>
          </View>

          {/* Teaser Prochaine Série */}
          <View style={styles.nextSetInfoCard}>
            <Text style={styles.nextSetLabel}>PROCHAINE SÉRIE</Text>
            <Text style={styles.nextSetTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.nextSetDetails}>
              Série {nextSetNumber} · <Text style={styles.nextSetHighlight}>{fmtKg(nextWeight)} kg</Text> × {nextReps}
            </Text>
          </View>

          {/* Bouton Prêt */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.85}>
            <Text style={styles.skipButtonText}>Je suis prêt</Text>
          </TouchableOpacity>

          {/* Correction d'une erreur de validation, sans attendre la fin du repos */}
          {onUndo && (
            <TouchableOpacity style={styles.undoLink} onPress={handleUndo} activeOpacity={0.7}>
              <Text style={styles.undoLinkText}>Erreur ? Corriger la dernière série</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '800',
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
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
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
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
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
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '600',
  },
  nextSetHighlight: {
    color: THEME.colors.accent,
    fontWeight: '800',
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
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accentTextDark,
    fontSize: 15,
    fontWeight: '800',
  },
  undoLink: {
    paddingVertical: 4,
  },
  undoLinkText: {
    fontFamily: THEME.fonts.sans,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
