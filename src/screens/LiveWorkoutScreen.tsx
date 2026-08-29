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
import { ConfiguredExercise, Feeling, NextSessionPlan, SessionConfig, SetResult, WorkoutLogEntry } from '../types';
import { triggerSuccessHaptic, triggerWarningHaptic } from '../utils/haptics';

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
  // Empêcher l'écran du smartphone de se mettre en veille pendant l'entraînement
  useKeepAwake();

  const exercises: ConfiguredExercise[] = sessionConfig.configuredExercises;
  const [startTime] = useState<number>(Date.now());

  // Index de progression
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);
  const [setIndex, setSetIndex] = useState<number>(0); // 0, 1, 2, ...

  // Résultats enregistrés par exercice
  const [sessionResults, setSessionResults] = useState<Record<number, SetResult[]>>({});

  // Historique global des étapes pour la fonction "Annuler"
  const [historySteps, setHistorySteps] = useState<{ exerciseIndex: number; setIndex: number }[]>([]);

  // Minuteur de repos
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restDuration, setRestDuration] = useState<number>(sessionConfig.standardRestSeconds);

  const currentExercise = exercises[exerciseIndex];
  const totalSets = currentExercise?.numSets || 3;

  // Calcul du poids prévu pour la série en cours
  const currentWeight = currentExercise?.plannedWeights?.[setIndex] ?? currentExercise?.baseWeight ?? 40;
  const targetReps = currentExercise?.targetReps ?? 8;

  // Calcul du progrès global
  const totalSteps = exercises.reduce((acc, ex) => acc + (ex.numSets || 3), 0);
  let stepsDone = 0;
  for (let i = 0; i < exerciseIndex; i++) {
    stepsDone += exercises[i].numSets || 3;
  }
  stepsDone += setIndex + 1;
  const progressPercent = Math.min(100, (stepsDone / Math.max(1, totalSteps)) * 100);

  // Prochain exercice pour l'overlay de repos
  const isLastSetOfExercise = setIndex === totalSets - 1;
  const isLastExercise = exerciseIndex === exercises.length - 1;
  const isFinalSetOfWorkout = isLastSetOfExercise && isLastExercise;

  const nextExercise = isLastSetOfExercise ? exercises[exerciseIndex + 1] : currentExercise;
  const nextSetNum = isLastSetOfExercise ? 1 : setIndex + 2;
  const nextWeight = nextExercise?.plannedWeights?.[nextSetNum - 1] ?? 40;

  const handleCompleteSet = (repsDone: number, feeling: Feeling) => {
    const newResult: SetResult = {
      setNumber: setIndex + 1,
      targetReps,
      repsDone,
      weight: currentWeight,
      feeling,
    };

    const exId = currentExercise.id;
    const currentExResults = sessionResults[exId] || [];
    const updatedExResults = [...currentExResults, newResult];

    setSessionResults((prev) => ({
      ...prev,
      [exId]: updatedExResults,
    }));

    setHistorySteps((prev) => [...prev, { exerciseIndex, setIndex }]);

    if (isFinalSetOfWorkout) {
      // Fin de la séance complète !
      finalizeWorkout({
        ...sessionResults,
        [exId]: updatedExResults,
      });
    } else {
      // Déterminer le temps de repos : Finisher ou Machine
      const nextRest = currentExercise.category === 'FREE_WEIGHT'
        ? sessionConfig.finisherRestSeconds
        : sessionConfig.standardRestSeconds;

      setRestDuration(nextRest);
      setIsResting(true);
    }
  };

  const handleRestFinished = () => {
    setIsResting(false);

    if (setIndex < totalSets - 1) {
      setSetIndex((prev) => prev + 1);
    } else {
      setSetIndex(0);
      setExerciseIndex((prev) => prev + 1);
    }
  };

  const handleUndo = () => {
    if (historySteps.length === 0) return;

    triggerWarningHaptic();
    const lastStep = historySteps[historySteps.length - 1];
    setHistorySteps((prev) => prev.slice(0, -1));

    // Supprimer le dernier log de l'exercice concerné
    const ex = exercises[lastStep.exerciseIndex];
    if (ex && sessionResults[ex.id]) {
      setSessionResults((prev) => ({
        ...prev,
        [ex.id]: prev[ex.id].slice(0, -1),
      }));
    }

    setIsResting(false);
    setExerciseIndex(lastStep.exerciseIndex);
    setSetIndex(lastStep.setIndex);
  };

  const finalizeWorkout = (finalResults: Record<number, SetResult[]>) => {
    triggerSuccessHaptic();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const today = new Date().toISOString().split('T')[0];

    const logsToSave: WorkoutLogEntry[] = [];
    const exerciseSummaries: {
      exerciseName: string;
      plan: NextSessionPlan;
      results: SetResult[];
    }[] = [];

    let totalVolume = 0;

    for (const ex of exercises) {
      const results = finalResults[ex.id] || [];
      if (results.length > 0) {
        for (const res of results) {
          totalVolume += res.weight * res.repsDone;
          logsToSave.push({
            workoutId: sessionConfig.workoutId,
            exerciseId: ex.id,
            exerciseName: ex.name,
            date: today,
            setNumber: res.setNumber,
            weight: res.weight,
            repsTarget: res.targetReps,
            repsDone: res.repsDone,
            feeling: res.feeling,
          });
        }

        // Calcul de la charge N+1
        const plan = calculateNextSession(
          results,
          ex.targetReps,
          ex.minIncrement,
          ex.consecutiveFailures || 0
        );

        const newFailureCount = plan.progressionVerdict === 'MAINTAIN' && results.some((r) => r.feeling === 'HARD')
          ? (ex.consecutiveFailures || 0) + 1
          : 0;

        // Persistance SQLite
        updateExerciseProgression(ex.id, plan.weightsPerSet, newFailureCount);

        exerciseSummaries.push({
          exerciseName: ex.name,
          plan,
          results,
        });
      }
    }

    // Sauvegarde des logs SQLite
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

  // Convertir l'objet ConfiguredExercise pour le composant ExerciseCard
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête Live */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>SÉANCE {sessionConfig.workoutName.toUpperCase()}</Text>
            <Text style={styles.headerTitle}>
              Exo {exerciseIndex + 1}/{exercises.length} • Série {setIndex + 1}/{totalSets}
            </Text>
          </View>

          <TouchableOpacity style={styles.quitButton} onPress={confirmQuit}>
            <Text style={styles.quitButtonText}>Quitter</Text>
          </TouchableOpacity>
        </View>

        {/* Barre de Progression de la séance */}
        <View style={styles.progressBarWrapper}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {/* Carte Focus de l'exercice courant */}
        <ExerciseCard
          exercise={exerciseForCard}
          setIndex={setIndex}
          totalSets={totalSets}
          currentWeight={currentWeight}
          targetReps={targetReps}
          onCompleteSet={handleCompleteSet}
          onUndo={handleUndo}
          canUndo={historySteps.length > 0}
        />
      </ScrollView>

      {/* Minuteur de repos automatique */}
      <RestTimerOverlay
        visible={isResting}
        totalDurationSeconds={restDuration}
        nextExerciseName={nextExercise?.name || ''}
        nextSetNumber={nextSetNum}
        nextWeight={nextWeight}
        onFinish={handleRestFinished}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  quitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quitButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarWrapper: {
    width: '100%',
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3,
  },
});
