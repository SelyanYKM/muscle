import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlateBreakdown } from '../components/PlateBreakdown';
import { RestTimerOverlay } from '../components/RestTimerOverlay';
import {
  addCustomExercise,
  getAllCatalogExercises,
  saveWorkoutLogs,
  updateExerciseProgression,
} from '../database/db';
import { calculateNextSession } from '../engine/progression';
import { THEME } from '../theme';
import {
  ConfiguredExercise,
  EquipmentCategory,
  Feeling,
  NextSessionPlan,
  SetResult,
  WorkoutLogEntry,
} from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../utils/haptics';

interface FreeWorkoutScreenProps {
  workoutId: number;
  workoutName: string;
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

interface CompletedExerciseLog {
  exerciseId: number;
  exerciseName: string;
  category: EquipmentCategory;
  sets: SetResult[];
}

export const FreeWorkoutScreen: React.FC<FreeWorkoutScreenProps> = ({
  workoutId,
  workoutName,
  onFinishSession,
  onQuitSession,
}) => {
  useKeepAwake();

  const [startTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Catalogue des exercices disponibles
  const [catalogExercises, setCatalogExercises] = useState<ConfiguredExercise[]>([]);
  const [currentExercise, setCurrentExercise] = useState<ConfiguredExercise | null>(null);

  // État de la série en cours
  const [currentWeight, setCurrentWeight] = useState<number>(40);
  const [currentReps, setCurrentReps] = useState<number>(8);

  // Minuteur de repos
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restDuration, setRestDuration] = useState<number>(90);

  // Logs déjà effectués dans la séance
  const [completedExercises, setCompletedExercises] = useState<CompletedExerciseLog[]>([]);

  // Modals
  const [isPickerModalOpen, setIsPickerModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>('');
  const [newExCategory, setNewExCategory] = useState<EquipmentCategory>('HAMMER_STRENGTH');
  const [newExWeight, setNewExWeight] = useState<string>('40');

  // Chronomètre global de séance
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Chargement du catalogue
  useEffect(() => {
    const list = getAllCatalogExercises(workoutId);
    setCatalogExercises(list);
    if (list.length > 0 && !currentExercise) {
      setCurrentExercise(list[0]);
      setCurrentWeight(list[0].plannedWeights?.[0] || 40);
      setCurrentReps(list[0].targetReps || 8);
    }
  }, [workoutId]);

  const formatElapsedTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelectExercise = (ex: ConfiguredExercise) => {
    triggerLightHaptic();
    setCurrentExercise(ex);
    // Vérifier si l'exercice a déjà des séries dans la séance courante
    const existing = completedExercises.find((c) => c.exerciseId === ex.id);
    if (existing && existing.sets.length > 0) {
      const lastSet = existing.sets[existing.sets.length - 1];
      setCurrentWeight(lastSet.weight);
      setCurrentReps(lastSet.repsDone);
    } else {
      setCurrentWeight(ex.plannedWeights?.[0] || 40);
      setCurrentReps(ex.targetReps || 8);
    }
    setIsPickerModalOpen(false);
  };

  const handleCreateCustomExercise = () => {
    if (!newExName.trim()) {
      Alert.alert('Nom requis', 'Merci de renseigner un nom pour l’exercice.');
      return;
    }
    triggerMediumHaptic();
    const weightNum = parseFloat(newExWeight) || 40;
    const created = addCustomExercise(
      workoutId,
      newExName.trim(),
      newExCategory,
      weightNum,
      8,
      3
    );

    setCatalogExercises((prev) => [...prev, created]);
    setCurrentExercise(created);
    setCurrentWeight(weightNum);
    setCurrentReps(8);
    setIsCreateModalOpen(false);
    setIsPickerModalOpen(false);
    setNewExName('');
    setNewExWeight('40');
  };

  // Ajustements de charge et reps pour la série en cours
  const adjustWeight = (delta: number) => {
    triggerLightHaptic();
    setCurrentWeight((prev) => Math.max(0, Math.round((prev + delta) * 100) / 100));
  };

  const adjustReps = (delta: number) => {
    triggerLightHaptic();
    setCurrentReps((prev) => Math.max(1, prev + delta));
  };

  // Calcul du numéro de la prochaine série pour l'exercice actuel
  const getCurrentSetNumber = () => {
    if (!currentExercise) return 1;
    const existing = completedExercises.find((c) => c.exerciseId === currentExercise.id);
    return existing ? existing.sets.length + 1 : 1;
  };

  // Valider la série avec ressenti
  const handleCompleteSet = (feeling: Feeling) => {
    if (!currentExercise) return;

    if (feeling === 'EASY') triggerLightHaptic();
    else if (feeling === 'MEDIUM') triggerMediumHaptic();
    else triggerWarningHaptic();

    const setNumber = getCurrentSetNumber();
    const newSet: SetResult = {
      setNumber,
      targetReps: currentReps,
      repsDone: currentReps,
      weight: currentWeight,
      feeling,
    };

    setCompletedExercises((prev) => {
      const existingIdx = prev.findIndex((c) => c.exerciseId === currentExercise.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          sets: [...updated[existingIdx].sets, newSet],
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            exerciseId: currentExercise.id,
            exerciseName: currentExercise.name,
            category: currentExercise.category,
            sets: [newSet],
          },
        ];
      }
    });

    const isFinisher = currentExercise.category === 'FREE_WEIGHT';
    setRestDuration(isFinisher ? 150 : 90);
    setIsResting(true);
  };

  // Annule la série qu'on vient de valider, appelée depuis l'écran de repos.
  const handleUndoFromRest = () => {
    if (!currentExercise) return;
    triggerLightHaptic();
    setIsResting(false);
    setCompletedExercises((prev) => {
      const existingIdx = prev.findIndex((c) => c.exerciseId === currentExercise.id);
      if (existingIdx < 0) return prev;

      const remainingSets = prev[existingIdx].sets.slice(0, -1);
      if (remainingSets.length === 0) {
        return prev.filter((_, idx) => idx !== existingIdx);
      }
      const updated = [...prev];
      updated[existingIdx] = { ...updated[existingIdx], sets: remainingSets };
      return updated;
    });
  };

  // Finaliser la séance libre
  const handleFinalizeSession = () => {
    if (completedExercises.length === 0) {
      Alert.alert('Séance vide', 'Renseigne au moins une série avant de terminer.');
      return;
    }

    triggerSuccessHaptic();
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const todayStr = new Date().toISOString().split('T')[0];

    const logsToSave: WorkoutLogEntry[] = [];
    const exerciseSummaries: {
      exerciseName: string;
      plan: NextSessionPlan;
      results: SetResult[];
    }[] = [];

    let totalVolume = 0;

    for (const exLog of completedExercises) {
      for (const s of exLog.sets) {
        totalVolume += s.weight * s.repsDone;
        logsToSave.push({
          workoutId,
          exerciseId: exLog.exerciseId,
          exerciseName: exLog.exerciseName,
          date: todayStr,
          setNumber: s.setNumber,
          weight: s.weight,
          repsTarget: s.targetReps,
          repsDone: s.repsDone,
          feeling: s.feeling,
        });
      }

      // Applique le même moteur de surcharge progressive qu'en mode guidé, pour que les
      // charges proposées la prochaine fois (guidée ou libre) tiennent compte de cette séance.
      const catalogEx = catalogExercises.find((c) => c.id === exLog.exerciseId);
      const plan = calculateNextSession(
        exLog.sets,
        catalogEx?.targetReps || 8,
        catalogEx?.minIncrement || 2.5,
        catalogEx?.consecutiveFailures || 0
      );

      const newFailureCount =
        plan.progressionVerdict === 'MAINTAIN' && exLog.sets.some((s) => s.feeling === 'HARD')
          ? (catalogEx?.consecutiveFailures || 0) + 1
          : 0;

      updateExerciseProgression(exLog.exerciseId, plan.weightsPerSet, newFailureCount);

      exerciseSummaries.push({
        exerciseName: exLog.exerciseName,
        plan,
        results: exLog.sets,
      });
    }

    saveWorkoutLogs(logsToSave);

    onFinishSession({
      workoutName: `${workoutName} (Libre)`,
      durationMinutes,
      totalVolume,
      exerciseSummaries,
    });
  };

  const confirmQuit = () => {
    Alert.alert(
      'Quitter la séance ?',
      'Les séries effectuées pendant cette séance ne seront pas enregistrées.',
      [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: onQuitSession },
      ]
    );
  };

  const isFinisher = currentExercise?.category === 'FREE_WEIGHT';
  const currentSetNum = getCurrentSetNumber();

  // Volume total accumulé en direct
  const liveVolume = completedExercises.reduce((total, ex) => {
    return total + ex.sets.reduce((exVol, s) => exVol + s.weight * s.repsDone, 0);
  }, 0);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink]}
        locations={[0, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* En-tête de la séance libre */}
        <View style={styles.topHeader}>
          <View style={styles.titleCol}>
            <View style={styles.freeModeBadge}>
              <Text style={styles.freeModeBadgeText}>⚡ MODE LIBRE</Text>
            </View>
            <Text style={styles.sessionTitle}>{workoutName}</Text>
          </View>

          <View style={styles.headerRightBox}>
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>{formatElapsedTime(elapsedSeconds)}</Text>
            </View>
            <TouchableOpacity style={styles.quitBtn} onPress={confirmQuit} activeOpacity={0.8}>
              <Text style={styles.quitBtnText}>Quitter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. Sélecteur d'exercice actif */}
        <View style={styles.exerciseSelectorBox}>
          <View style={styles.selectorHeader}>
            <Text style={styles.sectionLabel}>EXERCICE ACTUEL</Text>
            <TouchableOpacity
              style={styles.changeExBtn}
              onPress={() => {
                triggerLightHaptic();
                setIsPickerModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.changeExBtnText}>Changer d'exercice ▾</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.currentExCard}
            onPress={() => {
              triggerLightHaptic();
              setIsPickerModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.currentExTop}>
              <View style={[styles.typeBadge, isFinisher ? styles.finisherBadge : styles.machineBadge]}>
                <Text style={[styles.typeBadgeText, isFinisher ? styles.finisherBadgeText : styles.machineBadgeText]}>
                  {isFinisher ? 'BARRE LIBRE' : 'HAMMER STRENGTH'}
                </Text>
              </View>
              <Text style={styles.setCounterText}>Série {currentSetNum}</Text>
            </View>

            <Text style={styles.currentExName} numberOfLines={2}>
              {currentExercise?.name || 'Sélectionner un exercice'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Zone de Saisie de la Série en cours (Charge & Reps) */}
        <View style={styles.setEntrySection}>
          <Text style={styles.sectionLabel}>DONNÉES DE LA SÉRIE {currentSetNum}</Text>

          <View style={styles.steppersRow}>
            {/* Stepper Charge */}
            <View style={styles.stepperCard}>
              <Text style={styles.stepperMiniLabel}>CHARGE (KG)</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(-2.5)} activeOpacity={0.7}>
                  <Text style={styles.stepBtnText}>-2.5</Text>
                </TouchableOpacity>

                <View style={styles.stepperValWrap}>
                  <Text style={styles.stepperValueText}>{currentWeight}</Text>
                  <Text style={styles.stepperUnitText}>kg</Text>
                </View>

                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(2.5)} activeOpacity={0.7}>
                  <Text style={styles.stepBtnText}>+2.5</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stepper Répétitions */}
            <View style={styles.stepperCard}>
              <Text style={styles.stepperMiniLabel}>RÉPÉTITIONS</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustReps(-1)} activeOpacity={0.7}>
                  <Text style={styles.stepBtnText}>-1</Text>
                </TouchableOpacity>

                <View style={styles.stepperValWrap}>
                  <Text style={styles.stepperValueText}>{currentReps}</Text>
                  <Text style={styles.stepperUnitText}>reps</Text>
                </View>

                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustReps(1)} activeOpacity={0.7}>
                  <Text style={styles.stepBtnText}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Calculateur de disques en direct */}
          {currentExercise && (
            <PlateBreakdown
              totalWeight={currentWeight}
              baseWeight={currentExercise.baseWeight}
              category={currentExercise.category}
            />
          )}

          {/* 3 Boutons de validation par Ressenti */}
          <Text style={[styles.sectionLabel, { marginTop: 8, marginBottom: 8 }]}>VALIDER LA SÉRIE</Text>
          <View style={styles.feelingRow}>
            <TouchableOpacity onPress={() => handleCompleteSet('EASY')} activeOpacity={0.85} style={styles.feelBtnFlex}>
              <LinearGradient
                colors={THEME.colors.feelingEasyGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelBtn}
              >
                <Text style={[styles.feelBtnTitle, { color: THEME.colors.feelingEasyText }]}>FACILE</Text>
                <Text style={[styles.feelBtnSub, { color: THEME.colors.feelingEasyText }]}>2+ en réserve</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleCompleteSet('MEDIUM')} activeOpacity={0.85} style={styles.feelBtnFlex}>
              <LinearGradient
                colors={THEME.colors.feelingMediumGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelBtn}
              >
                <Text style={[styles.feelBtnTitle, { color: THEME.colors.feelingMediumText }]}>JUSTE</Text>
                <Text style={[styles.feelBtnSub, { color: THEME.colors.feelingMediumText }]}>0-1 en réserve</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleCompleteSet('HARD')} activeOpacity={0.85} style={styles.feelBtnFlex}>
              <LinearGradient
                colors={THEME.colors.feelingHardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={styles.feelBtn}
              >
                <Text style={[styles.feelBtnTitle, { color: THEME.colors.feelingHardText }]}>ÉCHEC</Text>
                <Text style={[styles.feelBtnSub, { color: THEME.colors.feelingHardText }]}>Atteint</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Récapitulatif en direct de la séance */}
        <View style={styles.liveLogSection}>
          <View style={styles.liveLogHeader}>
            <Text style={styles.sectionLabel}>SÉRIES EFFECTUÉES ({completedExercises.reduce((acc, e) => acc + e.sets.length, 0)})</Text>
            <Text style={styles.liveVolumeText}>{Math.round(liveVolume)} kg vol.</Text>
          </View>

          {completedExercises.length === 0 ? (
            <View style={styles.emptyLogsCard}>
              <Text style={styles.emptyLogsText}>Aucune série validée pour l'instant.</Text>
              <Text style={styles.emptyLogsSubtext}>Renseigne ta charge et valide ta première série ci-dessus !</Text>
            </View>
          ) : (
            <View style={styles.completedList}>
              {completedExercises.map((cEx, cIdx) => (
                <View key={cIdx} style={styles.completedExCard}>
                  <Text style={styles.completedExName}>{cEx.exerciseName}</Text>
                  <View style={styles.completedSetsRow}>
                    {cEx.sets.map((s, sIdx) => (
                      <View key={sIdx} style={styles.setChip}>
                        <Text style={styles.setChipText}>
                          S{s.setNumber}: {s.repsDone} reps @ {s.weight}kg{' '}
                          {s.feeling === 'EASY' ? '🟢' : s.feeling === 'MEDIUM' ? '🟠' : '🔴'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bouton Terminer la séance */}
        <TouchableOpacity
          style={styles.finishBtn}
          onPress={handleFinalizeSession}
          activeOpacity={0.85}
        >
          <Text style={styles.finishBtnText}>TERMINER LA SÉANCE</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Minuteur de Repos */}
      {isResting && (
        <RestTimerOverlay
          initialSeconds={restDuration}
          exerciseName={currentExercise?.name || 'Série suivante'}
          nextSetNumber={currentSetNum}
          nextWeight={currentWeight}
          onSkip={() => setIsResting(false)}
          onFinish={() => setIsResting(false)}
          onUndo={handleUndoFromRest}
        />
      )}

      {/* MODAL : SÉLECTEUR D'EXERCICE DU CATALOGUE */}
      <Modal visible={isPickerModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir un exercice</Text>
            <Text style={styles.modalSubtitle}>Sélectionne ta prochaine machine</Text>

            <ScrollView style={styles.catalogScroll} showsVerticalScrollIndicator={false}>
              {catalogExercises.map((catEx) => {
                const isSelected = currentExercise?.id === catEx.id;
                return (
                  <TouchableOpacity
                    key={catEx.id}
                    style={[styles.catalogItem, isSelected && styles.catalogItemActive]}
                    onPress={() => handleSelectExercise(catEx)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catalogItemName, isSelected && styles.catalogItemNameActive]}>
                        {catEx.name}
                      </Text>
                      <Text style={styles.catalogItemSub}>
                        {catEx.category === 'FREE_WEIGHT' ? 'Barre Libre' : 'Machine Hammer'} • {catEx.plannedWeights?.[0] || 40} kg
                      </Text>
                    </View>
                    <Text style={[styles.catalogItemAction, isSelected && styles.catalogItemActionActive]}>
                      {isSelected ? '✓ Actuel' : 'Choisir'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.createCustomBtn}
              onPress={() => {
                triggerLightHaptic();
                setIsCreateModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.createCustomBtnText}>+ Créer un nouvel exercice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() => setIsPickerModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL : CRÉER UN EXERCICE PERSONNALISÉ */}
      <Modal visible={isCreateModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouvel exercice</Text>
            <Text style={styles.modalSubtitle}>Ajouter au catalogue permanent</Text>

            <Text style={styles.inputMiniLabel}>NOM DE LA MACHINE</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newExName}
              onChangeText={setNewExName}
              placeholder="ex: HS Lateral Raise"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <Text style={styles.inputMiniLabel}>TYPE D'ÉQUIPEMENT</Text>
            <View style={styles.typePillsRow}>
              <TouchableOpacity
                style={[styles.typePill, newExCategory === 'HAMMER_STRENGTH' && styles.typePillActive]}
                onPress={() => setNewExCategory('HAMMER_STRENGTH')}
              >
                <Text style={[styles.typePillText, newExCategory === 'HAMMER_STRENGTH' && styles.typePillTextActive]}>
                  Machine (0kg base)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, newExCategory === 'FREE_WEIGHT' && styles.typePillActive]}
                onPress={() => setNewExCategory('FREE_WEIGHT')}
              >
                <Text style={[styles.typePillText, newExCategory === 'FREE_WEIGHT' && styles.typePillTextActive]}>
                  Barre Libre (20kg base)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputMiniLabel}>CHARGE INITIALE (KG)</Text>
            <TextInput
              style={styles.modalTextInput}
              keyboardType="numeric"
              value={newExWeight}
              onChangeText={setNewExWeight}
              placeholder="40"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <TouchableOpacity
              style={styles.submitCreateBtn}
              onPress={handleCreateCustomExercise}
              activeOpacity={0.85}
            >
              <Text style={styles.submitCreateBtnText}>CRÉER & SÉLECTIONNER</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() => setIsCreateModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelModalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  freeModeBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 3,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
  },
  freeModeBadgeText: {
    color: THEME.colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sessionTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerBox: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  timerText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quitBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(28, 28, 30, 0.08)',
  },
  quitBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseSelectorBox: {
    marginBottom: 16,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  changeExBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changeExBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  currentExCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  currentExTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    letterSpacing: 0.5,
  },
  machineBadge: {
    backgroundColor: THEME.colors.badgeBg,
  },
  machineBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.badgeText,
    fontSize: 9,
    fontWeight: '800',
  },
  finisherBadge: {
    backgroundColor: THEME.colors.finisherBadgeBg,
  },
  finisherBadgeText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.finisherBadgeText,
    fontSize: 9,
    fontWeight: '800',
  },
  setCounterText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  currentExName: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  setEntrySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 18,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  stepperCard: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  stepperMiniLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  stepBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  stepperValWrap: {
    alignItems: 'center',
  },
  stepperValueText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  stepperUnitText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  feelingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feelBtnFlex: {
    flex: 1,
  },
  feelBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#1C1200',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  feelBtnTitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feelBtnSub: {
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  liveLogSection: {
    marginBottom: 20,
  },
  liveLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveVolumeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.accent,
  },
  emptyLogsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  emptyLogsText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  emptyLogsSubtext: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  completedList: {
    gap: 8,
  },
  completedExCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  completedExName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  completedSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  setChip: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setChipText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '700',
  },
  finishBtn: {
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  finishBtnText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  modalTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  catalogScroll: {
    maxHeight: 280,
    marginBottom: 10,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  catalogItemActive: {
    borderColor: THEME.colors.accent,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  catalogItemNameActive: {
    color: THEME.colors.accent,
  },
  catalogItemSub: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  catalogItemAction: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  catalogItemActionActive: {
    color: THEME.colors.accent,
  },
  createCustomBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 8,
  },
  createCustomBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelModalBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  inputMiniLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: THEME.colors.cardInner,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 12,
  },
  typePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  typePillActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  typePillTextActive: {
    color: THEME.colors.accentTextDark,
  },
  submitCreateBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitCreateBtnText: {
    color: THEME.colors.accentTextDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
