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
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <Text style={styles.topSub}>RÉCUPÉRATION</Text>

          {/* Chronomètre Géant avec pulsation */}
          <Animated.Text style={[styles.timeBig, { transform: [{ scale: pulseAnim }] }]}>
            {formattedTime}
          </Animated.Text>

          {/* Jauge de progression */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
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
          <View style={styles.nextSetInfoCard}>
            <Text style={styles.nextSetLabel}>PROCHAINE SÉRIE</Text>
            <Text style={styles.nextSetTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.nextSetDetails}>
              Série {nextSetNumber} • <Text style={styles.nextSetHighlight}>{nextWeight} kg</Text>
            </Text>
          </View>

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
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(143, 185, 208, 0.4)',
    shadowColor: '#102A43',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
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
    fontFamily: THEME.fonts.sans,
    fontSize: 56,
    fontWeight: '900',
    color: '#334E68',
    letterSpacing: -1,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#E4ECF2',
    borderRadius: 3,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8FB9D0',
    borderRadius: 3,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  adjustBtn: {
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E2EC',
  },
  adjustBtnText: {
    fontFamily: THEME.fonts.sans,
    color: '#334E68',
    fontSize: 12,
    fontWeight: '700',
  },
  nextSetInfoCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nextSetLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#627D98',
    letterSpacing: 1,
    marginBottom: 3,
  },
  nextSetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    fontWeight: '700',
    color: '#102A43',
    textAlign: 'center',
  },
  nextSetDetails: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: '#627D98',
    marginTop: 3,
    fontWeight: '600',
  },
  nextSetHighlight: {
    color: THEME.colors.accent,
    fontWeight: '900',
  },
  skipButton: {
    width: '100%',
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 14,
    borderRadius: 14,
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
