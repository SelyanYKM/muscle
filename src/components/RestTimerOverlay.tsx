import { BlurView } from 'expo-blur';
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
import { THEME } from '../theme';
import { playRestTimerAlarm } from '../utils/audio';
import { triggerLightHaptic, triggerTimerEndHaptic, triggerWarningHaptic } from '../utils/haptics';
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
  onSkip: () => void;
  onFinish: () => void;
  /** Ferme le repos et annule la dernière série validée (accessible directement depuis cet écran). */
  onUndo?: () => void;
}

export const RestTimerOverlay: React.FC<RestTimerOverlayProps> = ({
  initialSeconds,
  exerciseName,
  nextSetNumber,
  nextWeight,
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

    // Écouteur de retour au premier plan (depuis Spotify / écran verrouillé)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          finishNow();
        }
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
    };
  }, []);

  const addTime = (secs: number) => {
    triggerLightHaptic();
    targetTimeRef.current += secs * 1000;
    const newRemaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
    setSecondsRemaining(newRemaining);
    // Le total (dénominateur de la barre de progression) ne grandit que si on AJOUTE du temps ;
    // retirer du temps raccourcit juste le repos restant sans faire "sauter" la barre.
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
    triggerLightHaptic();
    onSkip();
  };

  const handleUndo = () => {
    if (hasEndedRef.current || !onUndo) return;
    hasEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopRestTimerService();
    onUndo();
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progressPercent = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        {/* Fond dégradé Focus Violet → Rest Blue, "verre" sur la séance en arrière-plan */}
        <LinearGradient
          colors={[THEME.colors.restGradientViolet, THEME.colors.restGradientBlue, THEME.colors.restGradientMist]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView intensity={30} tint="dark" style={styles.backdropBlur} />

        <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim }]}>
          <BlurView intensity={55} tint="light" style={styles.cardBlur}>
            <LinearGradient
              colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.76)', 'rgba(255,255,255,0.85)']}
              locations={[0, 0.45, 1]}
              style={styles.container}
            >
              <Text style={styles.topSub}>RÉCUPÉRATION</Text>

              {/* Chronomètre Géant avec pulsation */}
              <Animated.Text style={[styles.timeBig, { transform: [{ scale: pulseAnim }] }]}>
                {formattedTime}
              </Animated.Text>

              {/* Jauge de progression */}
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[THEME.colors.restGradientMist, THEME.colors.restGradientBlue]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                />
              </View>

              {/* Boutons d'ajustement du repos */}
              <View style={styles.adjustRow}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(-15)} activeOpacity={0.7}>
                  <Text style={styles.adjustBtnText}>-15s</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(30)} activeOpacity={0.7}>
                  <Text style={styles.adjustBtnText}>+30s</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(60)} activeOpacity={0.7}>
                  <Text style={styles.adjustBtnText}>+60s</Text>
                </TouchableOpacity>
              </View>

              {/* Teaser Prochaine Série */}
              <LinearGradient
                colors={['rgba(232,211,245,0.8)', 'rgba(220,233,242,0.72)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextSetInfoCard}
              >
                <Text style={styles.nextSetLabel}>PROCHAINE SÉRIE</Text>
                <Text style={styles.nextSetTitle} numberOfLines={1}>
                  {exerciseName}
                </Text>
                <Text style={styles.nextSetDetails}>
                  Série {nextSetNumber} • <Text style={styles.nextSetHighlight}>{nextWeight} kg</Text>
                </Text>
              </LinearGradient>

              {/* Bouton Passer */}
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.85}>
                <Text style={styles.skipButtonText}>Je suis prêt (Passer)</Text>
              </TouchableOpacity>

              {/* Correction d'une erreur de validation, sans attendre la fin du repos */}
              {onUndo && (
                <TouchableOpacity style={styles.undoLink} onPress={handleUndo} activeOpacity={0.7}>
                  <Text style={styles.undoLinkText}>Erreur ? Corriger la dernière série</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(36, 26, 46, 0.42)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 34,
    overflow: 'hidden',
    shadowColor: '#102A43',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10,
  },
  cardBlur: {
    borderRadius: 34,
    overflow: 'hidden',
  },
  container: {
    borderRadius: 34,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  topSub: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#627D98',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  timeBig: {
    fontFamily: THEME.fonts.serif,
    fontSize: 60,
    fontWeight: '600',
    color: THEME.colors.restNumber,
    letterSpacing: -1,
  },
  progressBarBg: {
    width: '100%',
    height: 7,
    backgroundColor: 'rgba(215, 228, 238, 0.85)',
    borderRadius: 4,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  adjustBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(206, 222, 235, 0.9)',
  },
  adjustBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.restNumber,
    fontSize: 12,
    fontWeight: '700',
  },
  nextSetInfoCard: {
    width: '100%',
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  nextSetLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#627D98',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextSetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '600',
    color: '#102A43',
    textAlign: 'center',
  },
  nextSetDetails: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12.5,
    color: '#627D98',
    marginTop: 3,
    fontWeight: '600',
  },
  nextSetHighlight: {
    color: THEME.colors.accentStrong,
    fontWeight: '800',
  },
  skipButton: {
    width: '100%',
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
  },
  skipButtonText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  undoLink: {
    marginTop: 14,
    paddingVertical: 4,
  },
  undoLinkText: {
    fontFamily: THEME.fonts.sans,
    color: '#627D98',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
