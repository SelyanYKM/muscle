import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { THEME } from '../theme';
import { triggerLightHaptic, triggerNotificationSuccessHaptic, triggerWarningHaptic } from '../utils/haptics';

interface RestTimerOverlayProps {
  initialSeconds: number;
  exerciseName: string;
  nextSetNumber: number;
  nextWeight: number;
  onSkip: () => void;
  onFinish: () => void;
}

export const RestTimerOverlay: React.FC<RestTimerOverlayProps> = ({
  initialSeconds,
  exerciseName,
  nextSetNumber,
  nextWeight,
  onSkip,
  onFinish,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playBip = async () => {
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { shouldPlay: true }
      );
      setSound(newSound);
    } catch {
      // audio fallback
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerNotificationSuccessHaptic();
          playBip();
          onFinish();
          return 0;
        }

        if (prev === 4 || prev === 3 || prev === 2) {
          triggerWarningHaptic();
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const addTime = (secs: number) => {
    triggerLightHaptic();
    setSecondsRemaining((prev) => prev + secs);
    setTotalSeconds((prev) => prev + secs);
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progressPercent = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.topSub}>TEMPS DE RÉCUPÉRATION</Text>

          {/* Chronomètre Géant */}
          <Text style={styles.timeBig}>{formattedTime}</Text>

          {/* Jauge de progression */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Boutons d'ajustement du repos */}
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(-15)}>
              <Text style={styles.adjustBtnText}>-15s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(30)}>
              <Text style={styles.adjustBtnText}>+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adjustBtn} onPress={() => addTime(60)}>
              <Text style={styles.adjustBtnText}>+60s</Text>
            </TouchableOpacity>
          </View>

          {/* Teaser Prochaine Série */}
          <View style={styles.nextSetInfoCard}>
            <Text style={styles.nextSetLabel}>PROCHAINE SÉRIE :</Text>
            <Text style={styles.nextSetTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.nextSetDetails}>
              Série {nextSetNumber} • <Text style={styles.nextSetHighlight}>{nextWeight} kg</Text>
            </Text>
          </View>

          {/* Bouton Passer */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              triggerLightHaptic();
              onSkip();
            }}
          >
            <Text style={styles.skipButtonText}>Je suis prêt (Passer)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 17, 25, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  topSub: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.oceanMist,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  timeBig: {
    fontSize: 58,
    fontWeight: '900',
    color: THEME.colors.limeCream,
    letterSpacing: -1,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 3,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.limeCream,
    borderRadius: 3,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  adjustBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  adjustBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  nextSetInfoCard: {
    width: '100%',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  nextSetLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  nextSetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  nextSetDetails: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  nextSetHighlight: {
    color: THEME.colors.limeCream,
    fontWeight: '900',
  },
  skipButton: {
    width: '100%',
    backgroundColor: THEME.colors.limeCream,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#081119',
    fontSize: 14,
    fontWeight: '900',
  },
});
