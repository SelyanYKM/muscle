import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { playTimerEndSound } from '../utils/audio';
import { triggerLightHaptic, triggerTimerEndHaptic } from '../utils/haptics';

interface RestTimerOverlayProps {
  visible: boolean;
  totalDurationSeconds: number;
  nextExerciseName: string;
  nextSetNumber: number;
  nextWeight: number;
  onFinish: () => void;
}

export const RestTimerOverlay: React.FC<RestTimerOverlayProps> = ({
  visible,
  totalDurationSeconds,
  nextExerciseName,
  nextSetNumber,
  nextWeight,
  onFinish,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(totalDurationSeconds);

  useEffect(() => {
    if (visible) {
      setSecondsLeft(totalDurationSeconds);
    }
  }, [visible, totalDurationSeconds]);

  useEffect(() => {
    if (!visible) return;

    if (secondsLeft <= 0) {
      triggerTimerEndHaptic();
      playTimerEndSound();
      onFinish();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, secondsLeft, onFinish]);

  if (!visible) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / totalDurationSeconds) * 100));

  const addTime = (secs: number) => {
    triggerLightHaptic();
    setSecondsLeft((prev) => Math.max(0, prev + secs));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.timerBadge}>TEMPS DE REPOS</Text>

          {/* Chrono Principal */}
          <View style={styles.timerCircle}>
            <Text style={styles.timerNumber}>{formattedTime}</Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Prochaine série en aperçu */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>À SUIVRE</Text>
            <Text style={styles.previewExercise} numberOfLines={1}>
              {nextExerciseName}
            </Text>
            <Text style={styles.previewDetails}>
              Série {nextSetNumber} • {nextWeight} kg
            </Text>
          </View>

          {/* Boutons d'ajustement du temps */}
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.adjustButton} onPress={() => addTime(-15)}>
              <Text style={styles.adjustButtonText}>-15s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adjustButton} onPress={() => addTime(30)}>
              <Text style={styles.adjustButtonText}>+30s</Text>
            </TouchableOpacity>
          </View>

          {/* Passer le repos */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              triggerLightHaptic();
              onFinish();
            }}
          >
            <Text style={styles.skipButtonText}>Passer le repos & Commencer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  timerBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  timerCircle: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  timerNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  previewBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  previewExercise: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  previewDetails: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 14,
  },
  adjustButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  skipButton: {
    width: '100%',
    backgroundColor: '#38BDF8',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
});
