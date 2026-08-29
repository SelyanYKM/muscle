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
import { addCustomExercise, deleteExercise, getExercisesForWorkout, getWorkouts, updateExerciseCustomSettings } from '../database/db';
import { ConfiguredExercise, EquipmentCategory, SessionConfig } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

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
  const [standardRest, setStandardRest] = useState<number>(90); // 90s par défaut
  const [finisherRest, setFinisherRest] = useState<number>(180); // 180s (3min) par défaut
  const [exercises, setExercises] = useState<ConfiguredExercise[]>([]);

  // Modal d'édition détaillée de charge/reps/séries
  const [editingExercise, setEditingExercise] = useState<ConfiguredExercise | null>(null);
  const [editWeight, setEditWeight] = useState<string>('40');
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

  // Réordonner les exercices (Monter / Descendre)
  const moveExercise = (index: number, direction: 'UP' | 'DOWN') => {
    triggerLightHaptic();
    const newIdx = direction === 'UP' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= exercises.length) return;

    const updated = [...exercises];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setExercises(updated);
  };

  // Retirer un exercice de la séance
  const handleRemoveExercise = (index: number) => {
    triggerWarningHaptic();
    const ex = exercises[index];
    Alert.alert(
      'Retirer cet exercice ?',
      `Retirer "${ex.name}" de cette séance ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer de la séance',
          style: 'destructive',
          onPress: () => {
            const updated = exercises.filter((_, idx) => idx !== index);
            setExercises(updated);
          },
        },
      ]
    );
  };

  // Ajustement rapide du poids (+/- 2.5 kg) directement sur la carte
  const handleQuickWeightAdjust = (index: number, delta: number) => {
    triggerLightHaptic();
    const updated = [...exercises];
    const current = updated[index];
    const currentWeight = current.plannedWeights?.[0] ?? current.baseWeight ?? 40;
    const newWeight = Math.max(0, currentWeight + delta);
    current.plannedWeights = Array(current.numSets).fill(newWeight);
    setExercises(updated);
    updateExerciseCustomSettings(current.id, newWeight, current.targetReps, current.numSets);
  };

  // Ouvrir l'éditeur complet
  const openEditModal = (ex: ConfiguredExercise) => {
    triggerLightHaptic();
    setEditingExercise(ex);
    setEditWeight(String(ex.plannedWeights?.[0] ?? 40));
    setEditReps(ex.targetReps ?? 8);
    setEditSets(ex.numSets ?? 3);
  };

  const saveEditModal = () => {
    if (!editingExercise) return;
    triggerMediumHaptic();
    const weightNum = parseFloat(editWeight) || 0;
    const repsNum = Math.max(1, editReps);
    const setsNum = Math.max(1, editSets);

    const updated = exercises.map((e) => {
      if (e.id === editingExercise.id) {
        return {
          ...e,
          targetReps: repsNum,
          numSets: setsNum,
          plannedWeights: Array(setsNum).fill(weightNum),
        };
      }
      return e;
    });

    setExercises(updated);
    updateExerciseCustomSettings(editingExercise.id, weightNum, repsNum, setsNum);
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

      {/* 3. Exercices Prévus avec Modularité Complète */}
      <View style={styles.exerciseSectionHeader}>
        <Text style={styles.sectionHeading}>3. EXERCICES PRÉVUS ({exercises.length})</Text>
        <TouchableOpacity
          style={styles.addExerciseSmallBtn}
          onPress={() => {
            triggerLightHaptic();
            setIsAddModalOpen(true);
          }}
        >
          <Text style={styles.addExerciseSmallBtnText}>➕ Ajouter un exo</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hintText}>
        💡 Ajuste tes charges de base, l'ordre et le nombre d'exercices avant de lancer ta séance.
      </Text>

      <View style={styles.exercisesList}>
        {exercises.map((ex, index) => {
          const isFinisher = ex.category === 'FREE_WEIGHT';
          const currentWeight = ex.plannedWeights?.[0] ?? 40;

          return (
            <View key={ex.id || index} style={[styles.exerciseCard, isFinisher && styles.exerciseCardFinisher]}>
              {/* Ligne du haut : Ordre, Titre, Catégorie, Bouton Supprimer */}
              <View style={styles.cardTopRow}>
                <View style={styles.orderControls}>
                  <TouchableOpacity
                    style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => moveExercise(index, 'UP')}
                  >
                    <Text style={styles.orderBtnText}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.orderIndexText}>{index + 1}</Text>
                  <TouchableOpacity
                    style={[styles.orderBtn, index === exercises.length - 1 && styles.orderBtnDisabled]}
                    disabled={index === exercises.length - 1}
                    onPress={() => moveExercise(index, 'DOWN')}
                  >
                    <Text style={styles.orderBtnText}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.titleCol}>
                  <Text style={styles.exerciseCardName} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <View style={styles.metaBadgeRow}>
                    <View style={[styles.categoryPill, isFinisher ? styles.finisherPill : styles.machinePill]}>
                      <Text style={[styles.categoryPillText, isFinisher ? styles.finisherPillText : styles.machinePillText]}>
                        {isFinisher ? '🔥 FINISHER' : '⚙️ HAMMER'}
                      </Text>
                    </View>
                    <Text style={styles.cardSubDetails}>
                      {ex.numSets} séries • {ex.targetReps} reps
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleRemoveExercise(index)}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Ligne du bas : Réglage rapide de la charge & bouton éditer */}
              <View style={styles.cardBottomRow}>
                <View style={styles.weightAdjustContainer}>
                  <Text style={styles.adjustLabel}>CHARGE DE DÉPART :</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuickWeightAdjust(index, -2.5)}
                    >
                      <Text style={styles.stepperBtnText}>-2.5</Text>
                    </TouchableOpacity>

                    <Text style={styles.weightValueText}>{currentWeight} kg</Text>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuickWeightAdjust(index, 2.5)}
                    >
                      <Text style={styles.stepperBtnText}>+2.5</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.editConfigBtn}
                  onPress={() => openEditModal(ex)}
                >
                  <Text style={styles.editConfigBtnText}>✏️ Modifier</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Gros Bouton de Démarrage */}
      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startButtonText}>🚀 DÉMARRER LA SÉANCE</Text>
      </TouchableOpacity>

      {/* MODAL 1 : ÉDITION DÉTAILLÉE D'UN EXERCICE */}
      <Modal visible={editingExercise !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier l'exercice</Text>
            <Text style={styles.modalSub}>{editingExercise?.name}</Text>

            {/* Poids de départ */}
            <Text style={styles.modalFieldLabel}>CHARGE DE BASE (KG) :</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editWeight}
              onChangeText={setEditWeight}
              placeholder="ex: 40"
              placeholderTextColor="#64748B"
            />

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

            {/* Nombre de séries */}
            <Text style={styles.modalFieldLabel}>NOMBRE DE SÉRIES :</Text>
            <View style={styles.modalPillsRow}>
              {[2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.modalPill, editSets === s && styles.modalPillActive]}
                  onPress={() => {
                    triggerLightHaptic();
                    setEditSets(s);
                  }}
                >
                  <Text style={[styles.modalPillText, editSets === s && styles.modalPillTextActive]}>
                    {s} séries
                  </Text>
                </TouchableOpacity>
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
                  ⚙️ Machine Hammer
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
    gap: 10,
    marginBottom: 26,
  },
  exerciseCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exerciseCardFinisher: {
    borderColor: '#7F1D1D',
    backgroundColor: '#1C1924',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  orderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  orderBtnDisabled: {
    opacity: 0.2,
  },
  orderBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
  },
  orderIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  exerciseCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  machinePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  machinePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
  },
  finisherPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  finisherPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F87171',
  },
  categoryPillText: {
    letterSpacing: 0.5,
  },
  cardSubDetails: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A374A',
    paddingTop: 10,
  },
  weightAdjustContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  stepperBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  weightValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  editConfigBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editConfigBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
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
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
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
    paddingVertical: 8,
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
