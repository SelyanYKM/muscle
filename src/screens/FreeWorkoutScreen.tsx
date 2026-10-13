import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../components/BottomSheet';
import { Dot } from '../components/Dot';
import { Icon } from '../components/Icon';
import { PlateBreakdown } from '../components/PlateBreakdown';
import { RestTimerOverlay } from '../components/RestTimerOverlay';
import { SPLIT_SUBTITLES } from '../constants/splits';
import {
  addCustomExercise,
  formatLocalDate,
  getAllCatalogExercises,
  getLastExercisePerformance,
  LastExercisePerformance,
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
    workoutId: number;
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

const FEELING_CONFIG: Record<
  Feeling,
  { label: string; sub: string; mark: string }
> = {
  EASY: { label: 'Facile', sub: '2+ reps en réserve', mark: '2+' },
  MEDIUM: { label: 'Juste', sub: '0–1 rep en réserve', mark: '0–1' },
  HARD: { label: 'Échec', sub: 'Reps non atteintes', mark: '×' },
};

const FEELING_GRADIENT: Record<Feeling, [string, string]> = {
  EASY: THEME.colors.feelingEasyGradient,
  MEDIUM: THEME.colors.feelingMediumGradient,
  HARD: THEME.colors.feelingHardGradient,
};
const FEELING_INK: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyText,
  MEDIUM: THEME.colors.feelingMediumText,
  HARD: THEME.colors.feelingHardText,
};
const FEELING_BG: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyBg,
  MEDIUM: THEME.colors.feelingMediumBg,
  HARD: THEME.colors.feelingHardBg,
};

const INK_SURFACE = 'rgba(0, 41, 107, 0.07)';

function fmtKg(w: number): string {
  return w % 1 === 0 ? String(w) : String(w).replace('.', ',');
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

  // Dernière performance connue par exercice (repère affiché pendant la séance), indexée par id.
  const [lastPerfByExerciseId, setLastPerfByExerciseId] = useState<Record<number, LastExercisePerformance | null>>({});

  // État de la série en cours
  const [currentWeight, setCurrentWeight] = useState<number>(40);
  const [currentReps, setCurrentReps] = useState<number>(8);

  // Minuteur de repos
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restDuration, setRestDuration] = useState<number>(90);

  // Logs déjà effectués dans la séance
  const [completedExercises, setCompletedExercises] = useState<CompletedExerciseLog[]>([]);

  // Feuilles basses
  const [isPickerSheetOpen, setIsPickerSheetOpen] = useState<boolean>(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState<boolean>(false);
  const [isQuitSheetOpen, setIsQuitSheetOpen] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>('');
  const [newExCategory, setNewExCategory] = useState<EquipmentCategory>('HAMMER_STRENGTH');
  const [newExWeight, setNewExWeight] = useState<string>('40');

  // Toast "séance vide" (remplace Alert.alert)
  const [emptyToastVisible, setEmptyToastVisible] = useState<boolean>(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const split = THEME.splits[workoutId];

  // Chronomètre global de séance
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Chargement du catalogue, et de la dernière performance connue pour chacun de ses exercices
  // (repère affiché pendant la séance, en plus du poids déjà conseillé par la progression).
  useEffect(() => {
    const list = getAllCatalogExercises(workoutId);
    setCatalogExercises(list);
    if (list.length > 0 && !currentExercise) {
      setCurrentExercise(list[0]);
      setCurrentWeight(list[0].plannedWeights?.[0] || 40);
      setCurrentReps(list[0].targetReps || 8);
    }

    const perfMap: Record<number, LastExercisePerformance | null> = {};
    for (const ex of list) {
      perfMap[ex.id] = getLastExercisePerformance(ex.id);
    }
    setLastPerfByExerciseId(perfMap);
  }, [workoutId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const formatElapsedTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatLastPerfDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase();
    } catch {
      return dateStr;
    }
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
    setIsPickerSheetOpen(false);
  };

  const handleCreateCustomExercise = () => {
    if (!newExName.trim()) {
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
    setIsCreateSheetOpen(false);
    setIsPickerSheetOpen(false);
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

    const isFinisherSet = currentExercise.category === 'FREE_WEIGHT';
    setRestDuration(isFinisherSet ? 150 : 90);
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

  const showEmptyToast = () => {
    setEmptyToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setEmptyToastVisible(false), 2200);
  };

  // Finaliser la séance libre
  const handleFinalizeSession = () => {
    if (completedExercises.length === 0) {
      triggerWarningHaptic();
      showEmptyToast();
      return;
    }

    triggerSuccessHaptic();
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const todayStr = formatLocalDate(new Date());

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
          mode: 'FREE',
        });
      }

      // Applique le même moteur de surcharge progressive qu'en mode guidé, pour que les
      // charges proposées la prochaine fois tiennent compte de cette séance.
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
      workoutId,
      workoutName,
      durationMinutes,
      totalVolume,
      exerciseSummaries,
    });
  };

  const isFinisher = currentExercise?.category === 'FREE_WEIGHT';
  const currentSetNum = getCurrentSetNumber();
  const currentLastPerf = currentExercise ? lastPerfByExerciseId[currentExercise.id] : null;
  const activeIndex = currentExercise ? catalogExercises.findIndex((e) => e.id === currentExercise.id) : -1;

  // Volume total accumulé en direct
  const liveVolume = completedExercises.reduce((total, ex) => {
    return total + ex.sets.reduce((exVol, s) => exVol + s.weight * s.repsDone, 0);
  }, 0);
  const liveSetCount = completedExercises.reduce((acc, e) => acc + e.sets.length, 0);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[split.tint, THEME.colors.bg]}
        locations={[0, 0.42]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* En-tête de la séance */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={split.gradient} style={styles.headerBadge} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
              <Text style={[styles.headerBadgeText, { color: split.fg }]}>{workoutName.charAt(0)}</Text>
            </LinearGradient>
            <View>
              <Text style={styles.sessionTitle}>{workoutName}</Text>
              <Text style={styles.sessionSubtitle} numberOfLines={1}>{SPLIT_SUBTITLES[workoutId]}</Text>
            </View>
          </View>

          <View style={styles.headerRightBox}>
            <View style={styles.timerBox}>
              <Dot color={THEME.colors.accent} size={7} />
              <Text style={styles.timerText}>{formatElapsedTime(elapsedSeconds)}</Text>
            </View>
            <TouchableOpacity
              style={styles.quitBtn}
              onPress={() => setIsQuitSheetOpen(true)}
              activeOpacity={0.8}
            >
              <Icon name="x" size={18} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de progression des exercices */}
        {catalogExercises.length > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarRow}>
              {catalogExercises.map((ex, idx) => {
                const isDone = completedExercises.some((c) => c.exerciseId === ex.id) && idx !== activeIndex;
                const isActive = idx === activeIndex;
                return (
                  <View
                    key={ex.id}
                    style={[
                      styles.progressSegment,
                      { backgroundColor: isActive ? THEME.colors.textPrimary : isDone ? split.gradient[1] : 'rgba(0, 41, 107, 0.12)' },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMetaText}>
                Exercice {activeIndex + 1} sur {catalogExercises.length}
              </Text>
              <TouchableOpacity
                style={styles.changeExBtn}
                onPress={() => {
                  triggerLightHaptic();
                  setIsPickerSheetOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.changeExBtnText}>Changer d'exercice</Text>
                <Icon name="chevron-down" size={15} color={THEME.colors.accentStrong} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Carte héro : exercice actuel, dernière fois, charge/reps, disques */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {isFinisher ? 'BARRE LIBRE · FINISHER' : 'HAMMER STRENGTH'}
              </Text>
            </View>
            <Text style={styles.setCounterText}>Série {currentSetNum}</Text>
          </View>

          <TouchableOpacity onPress={() => setIsPickerSheetOpen(true)} activeOpacity={0.8}>
            <Text style={styles.currentExName} numberOfLines={2}>
              {currentExercise?.name || 'Sélectionner un exercice'}
            </Text>
          </TouchableOpacity>

          {currentLastPerf && currentLastPerf.sets.length > 0 && (
            <View style={styles.lastPerfBlock}>
              <Text style={styles.lastPerfLabel}>DERNIÈRE FOIS · {formatLastPerfDate(currentLastPerf.date)}</Text>
              <View style={styles.lastPerfChipsRow}>
                {currentLastPerf.sets.map((s, idx) => (
                  <View key={idx} style={styles.lastPerfChip}>
                    <Dot color={FEELING_INK[s.feeling]} size={8} />
                    <Text style={styles.lastPerfChipText}>{fmtKg(s.weight)} × {s.repsDone}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Steppers pleine largeur */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepperFullRow}>
              <TouchableOpacity style={styles.stepperBtnLg} onPress={() => adjustWeight(-2.5)} activeOpacity={0.7}>
                <Text style={styles.stepperBtnLgText}>−2,5</Text>
              </TouchableOpacity>
              <View style={styles.stepperCenterCol}>
                <Text style={styles.stepperRowLabel}>CHARGE</Text>
                <View style={styles.stepperValueRow}>
                  <Text style={styles.stepperBigValue}>{fmtKg(currentWeight)}</Text>
                  <Text style={styles.stepperUnit}>kg</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stepperBtnLg} onPress={() => adjustWeight(2.5)} activeOpacity={0.7}>
                <Text style={styles.stepperBtnLgText}>+2,5</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepperFullRow}>
              <TouchableOpacity style={styles.stepperBtnLg} onPress={() => adjustReps(-1)} activeOpacity={0.7}>
                <Text style={styles.stepperBtnLgText}>−1</Text>
              </TouchableOpacity>
              <View style={styles.stepperCenterCol}>
                <Text style={styles.stepperRowLabel}>RÉPÉTITIONS</Text>
                <View style={styles.stepperValueRow}>
                  <Text style={styles.stepperBigValue}>{currentReps}</Text>
                  <Text style={styles.stepperUnit}>reps</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stepperBtnLg} onPress={() => adjustReps(1)} activeOpacity={0.7}>
                <Text style={styles.stepperBtnLgText}>+1</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Disques */}
          {currentExercise && (
            <PlateBreakdown
              totalWeight={currentWeight}
              baseWeight={currentExercise.baseWeight}
              category={currentExercise.category}
            />
          )}
        </View>

        {/* Validation par ressenti */}
        <Text style={styles.sectionLabel}>VALIDER LA SÉRIE {currentSetNum}</Text>
        <View style={styles.feelingRow}>
          {(['EASY', 'MEDIUM', 'HARD'] as Feeling[]).map((feeling) => {
            const cfg = FEELING_CONFIG[feeling];
            return (
              <Pressable
                key={feeling}
                onPress={() => handleCompleteSet(feeling)}
                style={({ pressed }) => [styles.feelTileFlex, pressed && styles.feelTilePressed]}
              >
                <LinearGradient
                  colors={FEELING_GRADIENT[feeling]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.6, y: 1 }}
                  style={styles.feelTile}
                >
                  <View style={styles.feelTileTopRow}>
                    <Text style={[styles.feelTileMark, { color: FEELING_INK[feeling] }]}>{cfg.mark}</Text>
                    <Dot color={FEELING_INK[feeling]} size={10} />
                  </View>
                  <View>
                    <Text style={[styles.feelTileTitle, { color: FEELING_INK[feeling] }]}>{cfg.label}</Text>
                    <Text style={[styles.feelTileSub, { color: FEELING_INK[feeling] }]}>{cfg.sub}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {/* Récapitulatif en direct de la séance */}
        <View style={styles.liveLogSection}>
          <View style={styles.liveLogHeader}>
            <Text style={styles.sectionLabel}>SÉRIES EFFECTUÉES · {liveSetCount}</Text>
            <Text style={styles.liveVolumeText}>{Math.round(liveVolume).toLocaleString('fr-FR')} kg</Text>
          </View>

          {completedExercises.length === 0 ? (
            <View style={styles.emptyLogsCard}>
              <Text style={styles.emptyLogsText}>Aucune série validée pour l'instant.</Text>
              <Text style={styles.emptyLogsSubtext}>Renseigne ta charge et valide ta première série ci-dessus !</Text>
            </View>
          ) : (
            <View style={styles.completedList}>
              {completedExercises.map((cEx, cIdx) => (
                <View key={cIdx} style={[styles.completedExRow, cIdx > 0 && styles.completedExRowDivider]}>
                  <Text style={styles.completedExName}>{cEx.exerciseName}</Text>
                  <View style={styles.completedSetsRow}>
                    {cEx.sets.map((s, sIdx) => (
                      <View key={sIdx} style={[styles.setChip, { backgroundColor: FEELING_BG[s.feeling] }]}>
                        <Dot color={FEELING_INK[s.feeling]} size={7} />
                        <Text style={[styles.setChipText, { color: FEELING_INK[s.feeling] }]}>
                          S{s.setNumber} · {s.repsDone} × {fmtKg(s.weight)}kg
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
          <Text style={styles.finishBtnText}>Terminer la séance</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Toast "séance vide" */}
      {emptyToastVisible && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>Valide au moins une série avant de terminer.</Text>
        </View>
      )}

      {/* Modal Minuteur de Repos */}
      {isResting && (
        <RestTimerOverlay
          initialSeconds={restDuration}
          exerciseName={currentExercise?.name || 'Série suivante'}
          nextSetNumber={currentSetNum}
          nextWeight={currentWeight}
          nextReps={currentReps}
          onSkip={() => setIsResting(false)}
          onFinish={() => setIsResting(false)}
          onUndo={handleUndoFromRest}
        />
      )}

      {/* FEUILLE : QUITTER LA SÉANCE */}
      <BottomSheet visible={isQuitSheetOpen} onClose={() => setIsQuitSheetOpen(false)} maxHeightPercent={50}>
        <Text style={styles.sheetTitle}>Quitter la séance ?</Text>
        <Text style={styles.sheetBody}>Les séries effectuées pendant cette séance ne seront pas enregistrées.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsQuitSheetOpen(false)} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Continuer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.destructiveBtn} onPress={onQuitSession} activeOpacity={0.85}>
          <Text style={styles.destructiveBtnText}>Quitter</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* FEUILLE : SÉLECTEUR D'EXERCICE DU CATALOGUE */}
      <BottomSheet visible={isPickerSheetOpen} onClose={() => setIsPickerSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Choisir un exercice</Text>
        <Text style={styles.sheetSubtitle}>{workoutName} · {catalogExercises.length} exercices</Text>

        <ScrollView style={styles.catalogScroll} showsVerticalScrollIndicator={false}>
          {catalogExercises.map((catEx, idx) => {
            const isSelected = currentExercise?.id === catEx.id;
            const doneSets = completedExercises.find((c) => c.exerciseId === catEx.id)?.sets || [];
            return (
              <TouchableOpacity
                key={catEx.id}
                style={[styles.catalogItem, isSelected && { backgroundColor: split.tint }]}
                onPress={() => handleSelectExercise(catEx)}
                activeOpacity={0.7}
              >
                <View style={[styles.catalogIndexBadge, isSelected && styles.catalogIndexBadgeActive]}>
                  <Text style={[styles.catalogIndexText, isSelected && styles.catalogIndexTextActive]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catalogItemName}>{catEx.name}</Text>
                  <Text style={styles.catalogItemSub}>
                    {catEx.category === 'FREE_WEIGHT' ? 'Barre Libre' : 'Hammer Strength'} · conseillé {fmtKg(catEx.plannedWeights?.[0] || 40)} kg
                  </Text>
                </View>
                {doneSets.length > 0 && (
                  <View style={styles.catalogDoneDots}>
                    {doneSets.map((s, sIdx) => (
                      <Dot key={sIdx} color={FEELING_INK[s.feeling]} size={7} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            triggerLightHaptic();
            setIsCreateSheetOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>+ Nouvel exercice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => setIsPickerSheetOpen(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineBtnText}>Fermer</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* FEUILLE : CRÉER UN EXERCICE PERSONNALISÉ */}
      <BottomSheet visible={isCreateSheetOpen} onClose={() => setIsCreateSheetOpen(false)} maxHeightPercent={70}>
        <Text style={styles.sheetTitle}>Nouvel exercice</Text>
        <Text style={styles.sheetSubtitle}>Ajouter au catalogue permanent</Text>

        <Text style={styles.inputMiniLabel}>NOM DE LA MACHINE</Text>
        <TextInput
          style={styles.modalTextInput}
          value={newExName}
          onChangeText={setNewExName}
          placeholder="ex: HS Lateral Raise"
          placeholderTextColor={THEME.colors.textMuted}
        />

        <Text style={styles.inputMiniLabel}>TYPE D'ÉQUIPEMENT</Text>
        <View style={styles.typeSegmentRow}>
          <TouchableOpacity
            style={[styles.typeSegment, newExCategory === 'HAMMER_STRENGTH' && styles.typeSegmentActive]}
            onPress={() => setNewExCategory('HAMMER_STRENGTH')}
          >
            <Text style={[styles.typeSegmentText, newExCategory === 'HAMMER_STRENGTH' && styles.typeSegmentTextActive]}>
              Machine · 0 kg
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeSegment, newExCategory === 'FREE_WEIGHT' && styles.typeSegmentActive]}
            onPress={() => setNewExCategory('FREE_WEIGHT')}
          >
            <Text style={[styles.typeSegmentText, newExCategory === 'FREE_WEIGHT' && styles.typeSegmentTextActive]}>
              Barre libre · 20 kg
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

        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateCustomExercise} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Créer & sélectionner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => setIsCreateSheetOpen(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineBtnText}>Annuler</Text>
        </TouchableOpacity>
      </BottomSheet>
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
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 36,
    gap: 18,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  sessionTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sessionSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 12,
    borderRadius: THEME.radius.pill,
  },
  timerText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  quitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    gap: 8,
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressMetaText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  changeExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeExBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accentStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: THEME.radius.hero,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 20,
    gap: 16,
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: INK_SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  typeBadgeText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.4,
  },
  setCounterText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  currentExName: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  lastPerfBlock: {
    gap: 6,
  },
  lastPerfLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    opacity: 0.7,
  },
  lastPerfChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lastPerfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: INK_SURFACE,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  lastPerfChipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  stepperContainer: {
    backgroundColor: INK_SURFACE,
    borderRadius: THEME.radius.card,
    padding: 8,
    gap: 6,
  },
  stepperFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtnLg: {
    width: 64,
    height: 56,
    borderRadius: THEME.radius.inner,
    backgroundColor: THEME.colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnLgText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  stepperCenterCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepperRowLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.4,
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperBigValue: {
    fontFamily: THEME.fonts.sans,
    fontSize: 40,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  stepperUnit: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
  },
  feelingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feelTileFlex: {
    flex: 1,
  },
  feelTilePressed: {
    transform: [{ scale: 0.95 }],
  },
  feelTile: {
    height: 108,
    borderRadius: THEME.radius.card,
    padding: 14,
    justifyContent: 'space-between',
  },
  feelTileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  feelTileMark: {
    fontFamily: THEME.fonts.sans,
    fontSize: 24,
    fontWeight: '800',
  },
  feelTileTitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 16,
    fontWeight: '800',
  },
  feelTileSub: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  liveLogSection: {
    gap: 8,
  },
  liveLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveVolumeText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
  },
  emptyLogsCard: {
    borderRadius: THEME.radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 41, 107, 0.14)',
    padding: 16,
    alignItems: 'center',
  },
  emptyLogsText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  emptyLogsSubtext: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  completedList: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
  },
  completedExRow: {
    paddingVertical: 11,
  },
  completedExRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  completedExName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  completedSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  setChipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '700',
  },
  finishBtn: {
    height: 56,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  finishBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accentTextDark,
    fontSize: 15,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  sheetBody: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    fontFamily: THEME.fonts.sans,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  destructiveBtn: {
    backgroundColor: THEME.colors.feelingHardBg,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  destructiveBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.feelingHardText,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    height: 52,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  outlineBtn: {
    paddingVertical: 13,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  outlineBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  catalogScroll: {
    maxHeight: 340,
    marginBottom: 10,
  },
  catalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    marginBottom: 6,
  },
  catalogIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catalogIndexBadgeActive: {
    backgroundColor: THEME.colors.textPrimary,
  },
  catalogIndexText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  catalogIndexTextActive: {
    color: '#FFFFFF',
  },
  catalogItemName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  catalogItemSub: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  catalogDoneDots: {
    flexDirection: 'row',
    gap: 3,
  },
  inputMiniLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  modalTextInput: {
    height: 52,
    backgroundColor: THEME.colors.bg,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    borderRadius: THEME.radius.inner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 14,
  },
  typeSegmentRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.pill,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  typeSegment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  typeSegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  typeSegmentText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  typeSegmentTextActive: {
    color: THEME.colors.textPrimary,
  },
});
