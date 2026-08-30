import { useKeepAwake } from 'expo-keep-awake';
import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ExerciseCard } from '../components/ExerciseCard';
import { RestTimerOverlay } from '../components/RestTimerOverlay';
import { saveWorkoutLogs, updateExerciseProgression } from '../database/db';
import { calculateNextSession } from '../engine/progression';
import { THEME } from '../theme';
import {
  Feeling,
  NextSessionPlan,
  SessionConfig,
  SetResult,
  WorkoutLogEntry,
} from '../types';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

interface LiveWorkoutScreenProps {
  sessionConfig: SessionConfig;
  onFinishSession: (summary: {
    workoutName: string;
    durationMinutes: number;
    totalVolume: number;
    exerciseSummaries: {
      exerciseName: string;
      plan: NextSessionPlan;
      results: SetResult[];
    }[];
  }) => void;
  onQuitSession: () => void;
}

export const LiveWorkoutScreen: React.FC<LiveWorkoutScreenProps> = ({
  sessionConfig,
  onFinishSession,
  onQuitSession,
}) => {
  useKeepAwake();

  const [startTime] = useState<number>(Date.now());
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);
  const [setIndex, setSetIndex] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);

  const [sessionResults, setSessionResults] = useState<{ [exIndex: number]: SetResult[] }>({});

  const currentExercise = sessionConfig.configuredExercises[exerciseIndex];
  const numSets = currentExercise?.numSets ?? 3;
  const targetReps = currentExercise?.targetReps ?? 8;

  const plannedWeights = currentExercise?.plannedWeights || [currentExercise?.baseWeight || 40];
  const currentWeight = plannedWeights[setIndex] !== undefined
    ? plannedWeights[setIndex]
    : plannedWeights[0] || 40;

  const handleCompleteSet = (repsDone: number, feeling: Feeling) => {
    const newResult: SetResult = {
      setNumber: setIndex + 1,
      targetReps,
      repsDone,
      weight: currentWeight,
      feeling,
    };

    const currentExResults = sessionResults[exerciseIndex] || [];
    const updatedExResults = [...currentExResults, newResult];

    setSessionResults((prev) => ({
      ...prev,
      [exerciseIndex]: updatedExResults,
    }));

    const isLastSetOfExercise = setIndex + 1 >= numSets;
    const isLastExercise = exerciseIndex + 1 >= sessionConfig.configuredExercises.length;

    if (isLastSetOfExercise && isLastExercise) {
      handleFinalizeWorkout({
        ...sessionResults,
        [exerciseIndex]: updatedExResults,
      });
      return;
    }

    setIsResting(true);
  };

  const handleRestFinished = () => {
    setIsResting(false);
    const isLastSetOfExercise = setIndex + 1 >= numSets;

    if (isLastSetOfExercise) {
      setExerciseIndex((prev) => prev + 1);
      setSetIndex(0);
    } else {
      setSetIndex((prev) => prev + 1);
    }
  };

  const handleUndo = () => {
    if (setIndex > 0) {
      triggerLightHaptic();
      setSetIndex((prev) => prev - 1);
      setSessionResults((prev) => {
        const currentExResults = [...(prev[exerciseIndex] || [])];
        currentExResults.pop();
        return { ...prev, [exerciseIndex]: currentExResults };
      });
    }
  };

  const getRestDuration = () => {
    if (!currentExercise) return 90;
    return currentExercise.category === 'FREE_WEIGHT'
      ? sessionConfig.finisherRestSeconds
      : sessionConfig.standardRestSeconds;
  };

  const getNextSetPreview = () => {
    const isLastSetOfExercise = setIndex + 1 >= numSets;
    if (!isLastSetOfExercise) {
      const nextW = plannedWeights[setIndex + 1] !== undefined
        ? plannedWeights[setIndex + 1]
        : currentWeight;
      return {
        exerciseName: currentExercise.name,
        setNumber: setIndex + 2,
        weight: nextW,
      };
    } else {
      const nextEx = sessionConfig.configuredExercises[exerciseIndex + 1];
      const nextExPlanned = nextEx?.plannedWeights || [nextEx?.baseWeight || 40];
      return {
        exerciseName: nextEx ? nextEx.name : 'Fin de séance',
        setNumber: 1,
        weight: nextExPlanned[0] || 40,
      };
    }
  };

  const handleFinalizeWorkout = (finalResults: { [exIndex: number]: SetResult[] }) => {
    triggerSuccessHaptic();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const todayStr = new Date().toISOString().split('T')[0];

    const logsToSave: WorkoutLogEntry[] = [];
    const exerciseSummaries: {
      exerciseName: string;
      plan: NextSessionPlan;
      results: SetResult[];
    }[] = [];

    let totalVolume = 0;

    for (let i = 0; i < sessionConfig.configuredExercises.length; i++) {
      const ex = sessionConfig.configuredExercises[i];
      const results = finalResults[i] || [];

      if (results.length > 0) {
        for (const res of results) {
          totalVolume += res.repsDone * res.weight;
          logsToSave.push({
            workoutId: sessionConfig.workoutId,
            exerciseId: ex.id,
            exerciseName: ex.name,
            date: todayStr,
            setNumber: res.setNumber,
            weight: res.weight,
            repsTarget: res.targetReps,
            repsDone: res.repsDone,
            feeling: res.feeling,
          });
        }

        const plan = calculateNextSession(
          results,
          ex.targetReps || 8,
          ex.minIncrement || 2.5,
          ex.consecutiveFailures || 0
        );

        const newFailureCount = plan.progressionVerdict === 'MAINTAIN' && results.some((r) => r.feeling === 'HARD')
          ? (ex.consecutiveFailures || 0) + 1
          : 0;

        updateExerciseProgression(ex.id, plan.weightsPerSet, newFailureCount);

        exerciseSummaries.push({
          exerciseName: ex.name,
          plan,
          results,
        });
      }
    }

    saveWorkoutLogs(logsToSave);

    onFinishSession({
      workoutName: sessionConfig.workoutName,
      durationMinutes,
      totalVolume,
      exerciseSummaries,
    });
  };

  const confirmQuit = () => {
    Alert.alert(
      'Quitter la séance ?',
      'Ta progression sur cette séance ne sera pas enregistrée.',
      [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: onQuitSession },
      ]
    );
  };

  if (!currentExercise) return null;

  const exerciseForCard = {
    id: currentExercise.id,
    workoutId: currentExercise.workoutId,
    name: currentExercise.name,
    category: currentExercise.category,
    minIncrement: currentExercise.minIncrement,
    baseWeight: currentExercise.baseWeight,
    orderIndex: exerciseIndex + 1,
    defaultTargetReps: targetReps,
    defaultStartingWeight: currentWeight,
  };

  const nextPreview = getNextSetPreview();
  const totalExercises = sessionConfig.configuredExercises.length;
  const progressRatio = (exerciseIndex + setIndex / numSets) / totalExercises;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête Live */}
        <View style={styles.header}>
          <View style={styles.titleCol}>
            <Text style={styles.headerSubtitle}>
              EXERCICE {exerciseIndex + 1}/{totalExercises}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {sessionConfig.workoutName}
            </Text>
          </View>

          <TouchableOpacity style={styles.quitButton} onPress={confirmQuit}>
            <Text style={styles.quitButtonText}>Quitter</Text>
          </TouchableOpacity>
        </View>

        {/* Barre de progression segmentée par exercice */}
        <View style={styles.segmentedProgressRow}>
          {sessionConfig.configuredExercises.map((_, idx) => {
            const isPast = idx < exerciseIndex;
            const isCurrent = idx === exerciseIndex;
            const currentRatio = isCurrent ? Math.max(0.15, setIndex / numSets) : 0;

            return (
              <View key={idx} style={styles.segmentTrack}>
                {isPast && <View style={[styles.segmentFill, { width: '100%' }]} />}
                {isCurrent && (
                  <View style={[styles.segmentFill, { width: `${currentRatio * 100}%` }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Carte Focus active */}
        <ExerciseCard
          exercise={exerciseForCard}
          setIndex={setIndex}
          totalSets={numSets}
          currentWeight={currentWeight}
          targetReps={targetReps}
          onCompleteSet={handleCompleteSet}
          onUndo={handleUndo}
          canUndo={setIndex > 0}
        />

        {/* Modal Chrono de Repos */}
        {isResting && (
          <RestTimerOverlay
            initialSeconds={getRestDuration()}
            exerciseName={nextPreview.exerciseName}
            nextSetNumber={nextPreview.setNumber}
            nextWeight={nextPreview.weight}
            onSkip={handleRestFinished}
            onFinish={handleRestFinished}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginTop: 2,
    flexShrink: 1,
  },
  quitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  quitButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentedProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 18,
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    backgroundColor: THEME.colors.accent,
    borderRadius: 2,
  },
});
