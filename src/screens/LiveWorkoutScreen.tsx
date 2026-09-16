import { useKeepAwake } from 'expo-keep-awake';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DraggableExerciseList } from '../components/DraggableExerciseList';
import { ExerciseCard } from '../components/ExerciseCard';
import { RestTimerOverlay } from '../components/RestTimerOverlay';
import { getAllCatalogExercises, saveWorkoutLogs, updateExerciseProgression } from '../database/db';
import { calculateNextSession } from '../engine/progression';
import { THEME } from '../theme';
import {
  ConfiguredExercise,
  Feeling,
  NextSessionPlan,
  SessionConfig,
  SetResult,
  WorkoutLogEntry,
} from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../utils/haptics';

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
  const [exercisesList, setExercisesList] = useState<ConfiguredExercise[]>(
    sessionConfig.configuredExercises
  );
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);
  const [setIndex, setSetIndex] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);

  // Modal d'adaptation en direct
  const [isAdaptModalOpen, setIsAdaptModalOpen] = useState<boolean>(false);
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState<boolean>(false);
  const [catalogExercises, setCatalogExercises] = useState<ConfiguredExercise[]>([]);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Stockage des résultats de séries par index d'exercice
  const [sessionResults, setSessionResults] = useState<{ [exIndex: number]: SetResult[] }>({});

  const currentExercise = exercisesList[exerciseIndex];
  const numSets = currentExercise?.numSets ?? 3;
  const targetReps = currentExercise?.targetReps ?? 8;

  const plannedWeights = currentExercise?.plannedWeights || [currentExercise?.baseWeight || 40];
  const currentWeight =
    plannedWeights[setIndex] !== undefined
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
    const isLastExercise = exerciseIndex + 1 >= exercisesList.length;

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

  // Annule la série qu'on vient de valider, appelée depuis l'écran de repos (avant que
  // setIndex n'ait avancé). Contrairement à handleUndo ci-dessus (depuis la carte suivante),
  // ici on ne touche pas setIndex : il pointe encore sur la série qu'on vient de faire.
  const handleUndoFromRest = () => {
    triggerLightHaptic();
    setIsResting(false);
    setSessionResults((prev) => {
      const currentExResults = [...(prev[exerciseIndex] || [])];
      currentExResults.pop();
      return { ...prev, [exerciseIndex]: currentExResults };
    });
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
      const nextW =
        plannedWeights[setIndex + 1] !== undefined
          ? plannedWeights[setIndex + 1]
          : currentWeight;
      return {
        exerciseName: currentExercise.name,
        setNumber: setIndex + 2,
        weight: nextW,
      };
    } else {
      const nextEx = exercisesList[exerciseIndex + 1];
      const nextExPlanned = nextEx?.plannedWeights || [nextEx?.baseWeight || 40];
      return {
        exerciseName: nextEx ? nextEx.name : 'Fin de séance',
        setNumber: 1,
        weight: nextExPlanned[0] || 40,
      };
    }
  };

  // Ouvrir le modal d'adaptation de séance
  const openAdaptModal = () => {
    triggerLightHaptic();
    setIsResting(false);
    setIsAdaptModalOpen(true);
  };

  // Remplacer un exercice (machine occupée)
  const openReplaceCatalog = (indexToReplace: number) => {
    triggerLightHaptic();
    setReplacingIndex(indexToReplace);
    const catalog = getAllCatalogExercises(sessionConfig.workoutId);
    setCatalogExercises(catalog);
    setIsCatalogPickerOpen(true);
  };

  // Sélectionner un remplaçant depuis le catalogue
  const handleSelectReplacement = (newEx: ConfiguredExercise) => {
    triggerMediumHaptic();
    if (replacingIndex !== null) {
      const updated = [...exercisesList];
      updated[replacingIndex] = newEx;
      setExercisesList(updated);
    } else {
      // Ajout en fin de séance
      setExercisesList([...exercisesList, newEx]);
    }

    setIsCatalogPickerOpen(false);
    setReplacingIndex(null);
  };

  const handleDeleteExerciseInLive = (indexToDelete: number) => {
    if (exercisesList.length <= 1) {
      Alert.alert('Action impossible', 'La séance doit comporter au moins un exercice.');
      return;
    }
    const updated = exercisesList.filter((_, idx) => idx !== indexToDelete);
    setExercisesList(updated);
    if (exerciseIndex >= updated.length) {
      setExerciseIndex(updated.length - 1);
      setSetIndex(0);
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

    for (let i = 0; i < exercisesList.length; i++) {
      const ex = exercisesList[i];
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

        const newFailureCount =
          plan.progressionVerdict === 'MAINTAIN' && results.some((r) => r.feeling === 'HARD')
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
  const totalExercises = exercisesList.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête Live avec bouton Adapter */}
        <View style={styles.header}>
          <View style={styles.titleCol}>
            <Text style={styles.headerSubtitle}>
              EXERCICE {exerciseIndex + 1}/{totalExercises}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {sessionConfig.workoutName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.adaptButton} onPress={openAdaptModal} activeOpacity={0.8}>
              <Text style={styles.adaptButtonText}>✏️ Adapter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quitButton} onPress={confirmQuit} activeOpacity={0.8}>
              <Text style={styles.quitButtonText}>Quitter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de progression segmentée par exercice */}
        <View style={styles.segmentedProgressRow}>
          {exercisesList.map((_, idx) => {
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
            onUndo={handleUndoFromRest}
          />
        )}
      </ScrollView>

      {/* MODAL D'ADAPTATION DE SÉANCE EN DIRECT (MACHINE OCCUPÉE / ORDRE) */}
      <Modal visible={isAdaptModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.adaptModalCard}>
            <Text style={styles.modalTitle}>Adapter la séance en direct</Text>
            <Text style={styles.modalSubtitle}>
              Une machine est occupée ? Remplace-la ou réorganise ta séance.
            </Text>

            <ScrollView style={styles.adaptList} showsVerticalScrollIndicator={false}>
              {exercisesList.map((ex, idx) => {
                const isCompleted = idx < exerciseIndex;
                const isCurrent = idx === exerciseIndex;

                return (
                  <View
                    key={ex.id || idx}
                    style={[
                      styles.adaptItemRow,
                      isCompleted && styles.adaptItemCompleted,
                      isCurrent && styles.adaptItemCurrent,
                    ]}
                  >
                    <View style={styles.adaptItemInfo}>
                      <Text style={styles.adaptItemName} numberOfLines={1}>
                        {idx + 1}. {ex.name}
                      </Text>
                      <Text style={styles.adaptItemStatus}>
                        {isCompleted
                          ? '✓ Terminé'
                          : isCurrent
                          ? `En cours (Série ${setIndex + 1}/${numSets})`
                          : 'À venir'}
                      </Text>
                    </View>

                    {/* Actions : Remplacer ou Supprimer */}
                    {!isCompleted && (
                      <View style={styles.adaptActionsRow}>
                        <TouchableOpacity
                          style={styles.replaceBtn}
                          onPress={() => openReplaceCatalog(idx)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.replaceBtnText}>Remplacer</Text>
                        </TouchableOpacity>

                        {exercisesList.length > 1 && (
                          <TouchableOpacity
                            style={styles.deleteExBtn}
                            onPress={() => handleDeleteExerciseInLive(idx)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.deleteExBtnText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Bouton Ajouter un exercice supplémentaire */}
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() => openReplaceCatalog(null as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.addMoreBtnText}>+ Ajouter un exercice supplémentaire</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resumeButton}
              onPress={() => setIsAdaptModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.resumeButtonText}>REPRENDRE L'ENTRAÎNEMENT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SOUS-MODAL : SÉLECTION DU REMPLAÇANT DU CATALOGUE */}
      <Modal visible={isCatalogPickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.adaptModalCard}>
            <Text style={styles.modalTitle}>
              {replacingIndex !== null ? 'Choisir un remplaçant' : 'Ajouter un exercice'}
            </Text>

            <ScrollView style={styles.adaptList} showsVerticalScrollIndicator={false}>
              {catalogExercises.map((catEx) => (
                <TouchableOpacity
                  key={catEx.id}
                  style={styles.catalogSelectRow}
                  onPress={() => handleSelectReplacement(catEx)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogItemName}>{catEx.name}</Text>
                    <Text style={styles.catalogItemSub}>
                      {catEx.category === 'FREE_WEIGHT' ? 'Barre' : 'Machine'} •{' '}
                      {catEx.plannedWeights?.[0] || 40} kg
                    </Text>
                  </View>
                  <Text style={styles.catalogSelectAction}>Choisir</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelPickerBtn}
              onPress={() => setIsCatalogPickerOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelPickerBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  adaptButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardInner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  adaptButtonText: {
    color: THEME.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  quitButton: {
    paddingHorizontal: 10,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  adaptModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '82%',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
  },
  adaptList: {
    maxHeight: 280,
    marginVertical: 6,
  },
  adaptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 8,
  },
  adaptItemCompleted: {
    opacity: 0.5,
  },
  adaptItemCurrent: {
    borderColor: THEME.colors.accent,
  },
  adaptItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  adaptItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  adaptItemStatus: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  adaptActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replaceBtn: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  replaceBtnText: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteExBtn: {
    backgroundColor: '#2D1216',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteExBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  addMoreBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginVertical: 8,
  },
  addMoreBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  resumeButton: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  resumeButtonText: {
    color: THEME.colors.accentTextDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  catalogSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  catalogItemSub: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  catalogSelectAction: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  cancelPickerBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelPickerBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
