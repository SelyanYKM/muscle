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
import { SwipeableExerciseRow } from '../components/SwipeableExerciseRow';
import { addCustomExercise, getExercisesForWorkout, getWorkouts, updateExerciseCustomSettings } from '../database/db';
import { ConfiguredExercise, EquipmentCategory, SessionConfig } from '../types';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

interface SessionPrepScreenProps {
  onStartSession: (config: SessionConfig) => void;
  onOpenHistory: () => void;
}

export const SessionPrepScreen: React.FC<SessionPrepScreenProps> = ({
  onStartSession,
  onOpenHistory,
}) => {
  const workouts = getWorkouts();
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number>(1);
  const [standardRest, setStandardRest] = useState<number>(90);
  const [finisherRest, setFinisherRest] = useState<number>(180);
  const [exercises, setExercises] = useState<ConfiguredExercise[]>([]);

  // Modal d'édition de l'exercice (Crayon)
  const [editingExercise, setEditingExercise] = useState<ConfiguredExercise | null>(null);
  const [editWeightsPerSet, setEditWeightsPerSet] = useState<number[]>([]);
  const [editReps, setEditReps] = useState<number>(8);
  const [editSets, setEditSets] = useState<number>(3);

  // Modal d'ajout d'exercice
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>('');
  const [newExCategory, setNewExCategory] = useState<EquipmentCategory>('HAMMER_STRENGTH');
  const [newExWeight, setNewExWeight] = useState<string>('40');
  const [newExReps, setNewExReps] = useState<number>(8);
  const [newExSets, setNewExSets] = useState<number>(3);

  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId) || workouts[0];

  useEffect(() => {
    loadExercises(selectedWorkoutId);
  }, [selectedWorkoutId]);

  const loadExercises = (workoutId: number) => {
    const list = getExercisesForWorkout(workoutId);
    setExercises(list);
  };

  const handleWorkoutSelect = (wId: number) => {
    triggerLightHaptic();
    setSelectedWorkoutId(wId);
  };

  // Suppression via glissement vers la gauche
  const handleDeleteExercise = (index: number) => {
    const updated = exercises.filter((_, idx) => idx !== index);
    setExercises(updated);
  };

  // Déplacer vers le haut / bas
  const moveExercise = (index: number, direction: 'UP' | 'DOWN') => {
    const newIdx = direction === 'UP' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= exercises.length) return;

    const updated = [...exercises];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setExercises(updated);
  };

  // Ouvrir le modal d'édition (Crayon)
  const openEditModal = (ex: ConfiguredExercise) => {
    triggerLightHaptic();
    setEditingExercise(ex);
    const sets = ex.numSets ?? 3;
    setEditSets(sets);
    setEditReps(ex.targetReps ?? 8);

    // Initialiser les poids par série
    const currentWeights = ex.plannedWeights && ex.plannedWeights.length > 0
      ? [...ex.plannedWeights]
      : Array(sets).fill(ex.baseWeight || 40);

    // Ajuster la taille du tableau selon le nombre de séries
    while (currentWeights.length < sets) {
      currentWeights.push(currentWeights[currentWeights.length - 1] || 40);
    }
    setEditWeightsPerSet(currentWeights.slice(0, sets));
  };

  // Changer le nombre de séries dans le modal
  const handleSetsCountChange = (newSetsCount: number) => {
    triggerLightHaptic();
    setEditSets(newSetsCount);
    const updatedWeights = [...editWeightsPerSet];
    while (updatedWeights.length < newSetsCount) {
      const lastWeight = updatedWeights[updatedWeights.length - 1] || 40;
      updatedWeights.push(lastWeight);
    }
    setEditWeightsPerSet(updatedWeights.slice(0, newSetsCount));
  };

  // Ajuster le poids d'une série spécifique
  const adjustSingleSetWeight = (setIdx: number, delta: number) => {
    triggerLightHaptic();
    setEditWeightsPerSet((prev) => {
      const updated = [...prev];
      updated[setIdx] = Math.max(0, Math.round(((updated[setIdx] || 0) + delta) * 100) / 100);
      return updated;
    });
  };

  // Incrémentation pyramidale automatique (+2.5kg ou +5kg par série)
  const applyPyramidalIncrement = (step: number) => {
    triggerLightHaptic();
    setEditWeightsPerSet((prev) => {
      const base = prev[0] || 40;
      return prev.map((_, idx) => base + idx * step);
    });
  };

  // Égaliser toutes les séries sur la série 1
  const equalizeAllSets = () => {
    triggerLightHaptic();
    setEditWeightsPerSet((prev) => {
      const base = prev[0] || 40;
      return prev.map(() => base);
    });
  };

  const saveEditModal = () => {
    if (!editingExercise) return;
    triggerMediumHaptic();
    const repsNum = Math.max(1, editReps);
    const setsNum = Math.max(1, editSets);
    const finalWeights = editWeightsPerSet.slice(0, setsNum);

    const updated = exercises.map((e) => {
      if (e.id === editingExercise.id) {
        return {
          ...e,
          targetReps: repsNum,
          numSets: setsNum,
          plannedWeights: finalWeights,
        };
      }
      return e;
    });

    setExercises(updated);
    updateExerciseCustomSettings(editingExercise.id, finalWeights, repsNum, setsNum);
    setEditingExercise(null);
  };

  // Ajouter un nouvel exercice
  const handleAddExerciseSubmit = () => {
    if (!newExName.trim()) {
      Alert.alert('Nom requis', 'Merci de renseigner un nom pour l’exercice.');
      return;
    }
    triggerMediumHaptic();
    const weightNum = parseFloat(newExWeight) || 0;
    const repsNum = Math.max(1, newExReps);
    const setsNum = Math.max(1, newExSets);

    addCustomExercise(
      selectedWorkoutId,
      newExName.trim(),
      newExCategory,
      weightNum,
      repsNum,
      setsNum
    );

    loadExercises(selectedWorkoutId);
    setIsAddModalOpen(false);
    setNewExName('');
    setNewExWeight('40');
  };

  const handleStart = () => {
    if (exercises.length === 0) {
      Alert.alert('Aucun exercice', 'Ajoute au moins un exercice pour démarrer.');
      return;
    }
    triggerLightHaptic();
    onStartSession({
      workoutId: selectedWorkout.id,
      workoutName: selectedWorkout.name,
      standardRestSeconds: standardRest,
      finisherRestSeconds: finisherRest,
      configuredExercises: exercises,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête de l'application */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.appSubtitle}>SURCHARGE PROGRESSIVE PPL</Text>
          <Text style={styles.appTitle}>Préparer la séance</Text>
        </View>

        <TouchableOpacity style={styles.historyButton} onPress={onOpenHistory}>
          <Text style={styles.historyButtonText}>📜 Historique</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Sélecteur de Séance PPL */}
      <Text style={styles.sectionHeading}>1. CHOISIR LE PROGRAMME</Text>
      <View style={styles.workoutTabs}>
        {workouts.map((w) => {
          const isSelected = w.id === selectedWorkoutId;
          return (
            <TouchableOpacity
              key={w.id}
              style={[styles.workoutTab, isSelected && styles.workoutTabActive]}
              onPress={() => handleWorkoutSelect(w.id)}
            >
              <Text style={[styles.workoutTabText, isSelected && styles.workoutTabTextActive]}>
                {w.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.workoutDescription}>{selectedWorkout?.description}</Text>

      {/* 2. Configuration des Temps de Repos */}
      <Text style={styles.sectionHeading}>2. TEMPS DE REPOS AUTOMATIQUE</Text>
      
      <View style={styles.restConfigBox}>
        {/* Repos Machines */}
        <View style={styles.restRow}>
          <View style={styles.restLabelCol}>
            <Text style={styles.restLabelTitle}>⚙️ Machines Hammer Strength</Text>
            <Text style={styles.restLabelSub}>Iso-lateral & guidé</Text>
          </View>

          <View style={styles.timePills}>
            {[60, 90, 120].map((secs) => (
              <TouchableOpacity
                key={secs}
                style={[styles.timePill, standardRest === secs && styles.timePillActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setStandardRest(secs);
                }}
              >
                <Text style={[styles.timePillText, standardRest === secs && styles.timePillTextActive]}>
                  {secs}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Repos Finisher Barre */}
        <View style={[styles.restRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 14 }]}>
          <View style={styles.restLabelCol}>
            <Text style={styles.restLabelTitle}>🔥 Finisher Poly-articulaire</Text>
            <Text style={styles.restLabelSub}>Barre libre lourde</Text>
          </View>

          <View style={styles.timePills}>
            {[120, 180, 240].map((secs) => (
              <TouchableOpacity
                key={secs}
                style={[styles.timePill, finisherRest === secs && styles.timePillActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setFinisherRest(secs);
                }}
              >
                <Text style={[styles.timePillText, finisherRest === secs && styles.timePillTextActive]}>
                  {secs / 60} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* 3. Exercices Prévus : Liste épurée avec Swipe-to-delete et Crayon */}
      <View style={styles.exerciseSectionHeader}>
        <Text style={styles.sectionHeading}>3. EXERCICES PRÉVUS ({exercises.length})</Text>
        <TouchableOpacity
          style={styles.addExerciseSmallBtn}
          onPress={() => {
            triggerLightHaptic();
            setIsAddModalOpen(true);
          }}
        >
          <Text style={styles.addExerciseSmallBtnText}>➕ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hintText}>
        👈 Glisse pour retirer • Utilise ▲/▼ pour l'ordre • Clique sur ✏️ pour définir tes charges par série
      </Text>

      <View style={styles.exercisesList}>
        {exercises.map((ex, index) => (
          <SwipeableExerciseRow
            key={ex.id || index}
            exercise={ex}
            index={index}
            totalCount={exercises.length}
            onEdit={openEditModal}
            onDelete={handleDeleteExercise}
            onMoveUp={(idx) => moveExercise(idx, 'UP')}
            onMoveDown={(idx) => moveExercise(idx, 'DOWN')}
          />
        ))}
      </View>

      {/* Gros Bouton de Démarrage */}
      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startButtonText}>🚀 DÉMARRER LA SÉANCE</Text>
      </TouchableOpacity>

      {/* MODAL 1 : ÉDITION DÉTAILLÉE PAR SÉRIE (CRAYON) */}
      <Modal visible={editingExercise !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Charges & Séries</Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {editingExercise?.name}
              </Text>

              {/* Nombre de séries */}
              <Text style={styles.modalFieldLabel}>NOMBRE DE SÉRIES :</Text>
              <View style={styles.modalPillsRow}>
                {[2, 3, 4, 5].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.modalPill, editSets === s && styles.modalPillActive]}
                    onPress={() => handleSetsCountChange(s)}
                  >
                    <Text style={[styles.modalPillText, editSets === s && styles.modalPillTextActive]}>
                      {s} séries
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Répétitions cibles */}
              <Text style={styles.modalFieldLabel}>OBJECTIF DE RÉPÉTITIONS :</Text>
              <View style={styles.modalPillsRow}>
                {[5, 6, 8, 10, 12, 15].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.modalPill, editReps === r && styles.modalPillActive]}
                    onPress={() => {
                      triggerLightHaptic();
                      setEditReps(r);
                    }}
                  >
                    <Text style={[styles.modalPillText, editReps === r && styles.modalPillTextActive]}>
                      {r} reps
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Raccourcis pyramidaux rapides */}
              <View style={styles.quickShortcutsRow}>
                <TouchableOpacity
                  style={styles.shortcutBtn}
                  onPress={() => applyPyramidalIncrement(2.5)}
                >
                  <Text style={styles.shortcutBtnText}>⚡ +2.5kg / série</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shortcutBtn}
                  onPress={() => applyPyramidalIncrement(5)}
                >
                  <Text style={styles.shortcutBtnText}>⚡ +5kg / série</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shortcutBtn} onPress={equalizeAllSets}>
                  <Text style={styles.shortcutBtnText}>= Même charge</Text>
                </TouchableOpacity>
              </View>

              {/* Charges individuelles par série */}
              <Text style={styles.modalFieldLabel}>CHARGES PAR SÉRIE (KG) :</Text>
              <View style={styles.perSetList}>
                {editWeightsPerSet.map((weight, setIdx) => (
                  <View key={setIdx} style={styles.setWeightRow}>
                    <Text style={styles.setRowLabel}>Série {setIdx + 1} :</Text>

                    <View style={styles.setStepperBox}>
                      <TouchableOpacity
                        style={styles.setStepBtn}
                        onPress={() => adjustSingleSetWeight(setIdx, -2.5)}
                      >
                        <Text style={styles.setStepBtnText}>-2.5</Text>
                      </TouchableOpacity>

                      <Text style={styles.setWeightNumber}>{weight} kg</Text>

                      <TouchableOpacity
                        style={styles.setStepBtn}
                        onPress={() => adjustSingleSetWeight(setIdx, 2.5)}
                      >
                        <Text style={styles.setStepBtnText}>+2.5</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Actions modal */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingExercise(null)}
                >
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEditModal}>
                  <Text style={styles.modalSaveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL 2 : AJOUTER UN EXERCICE */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter un exercice</Text>

            {/* Nom */}
            <Text style={styles.modalFieldLabel}>NOM DE L'EXERCICE :</Text>
            <TextInput
              style={styles.modalInput}
              value={newExName}
              onChangeText={setNewExName}
              placeholder="ex: HS Lateral Raise"
              placeholderTextColor="#64748B"
            />

            {/* Type */}
            <Text style={styles.modalFieldLabel}>TYPE D'ÉQUIPEMENT :</Text>
            <View style={styles.modalPillsRow}>
              <TouchableOpacity
                style={[
                  styles.modalPill,
                  newExCategory === 'HAMMER_STRENGTH' && styles.modalPillActive,
                ]}
                onPress={() => setNewExCategory('HAMMER_STRENGTH')}
              >
                <Text style={[styles.modalPillText, newExCategory === 'HAMMER_STRENGTH' && styles.modalPillTextActive]}>
                  ⚙️ Machine
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalPill,
                  newExCategory === 'FREE_WEIGHT' && styles.modalPillActive,
                ]}
                onPress={() => setNewExCategory('FREE_WEIGHT')}
              >
                <Text style={[styles.modalPillText, newExCategory === 'FREE_WEIGHT' && styles.modalPillTextActive]}>
                  🔥 Barre Libre (20kg)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Poids */}
            <Text style={styles.modalFieldLabel}>CHARGE DE DÉPART (KG) :</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={newExWeight}
              onChangeText={setNewExWeight}
              placeholder="ex: 40"
              placeholderTextColor="#64748B"
            />

            {/* Reps */}
            <Text style={styles.modalFieldLabel}>OBJECTIF DE RÉPÉTITIONS :</Text>
            <View style={styles.modalPillsRow}>
              {[6, 8, 10, 12].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.modalPill, newExReps === r && styles.modalPillActive]}
                  onPress={() => setNewExReps(r)}
                >
                  <Text style={[styles.modalPillText, newExReps === r && styles.modalPillTextActive]}>
                    {r} reps
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddExerciseSubmit}>
                <Text style={styles.modalSaveBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  appSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  historyButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  workoutTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  workoutTab: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  workoutTabActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  workoutTabText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
  },
  workoutTabTextActive: {
    color: '#FFFFFF',
  },
  workoutDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
    lineHeight: 18,
  },
  restConfigBox: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    gap: 14,
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restLabelCol: {
    flex: 1,
    marginRight: 10,
  },
  restLabelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  restLabelSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  timePills: {
    flexDirection: 'row',
    gap: 6,
  },
  timePill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timePillActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  timePillTextActive: {
    color: '#0F172A',
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  addExerciseSmallBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  addExerciseSmallBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  exercisesList: {
    marginBottom: 26,
  },
  startButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '700',
    marginBottom: 14,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  modalPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  modalPillActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  modalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modalPillTextActive: {
    color: '#0F172A',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  shortcutBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shortcutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  perSetList: {
    gap: 8,
    marginTop: 4,
  },
  setWeightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  setRowLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  setStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setStepBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  setStepBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  setWeightNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 56,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
});
