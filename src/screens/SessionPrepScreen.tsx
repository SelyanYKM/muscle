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
import { DraggableExerciseList } from '../components/DraggableExerciseList';
import { addCustomExercise, getAllCatalogExercises, getExercisesForWorkout, getWorkouts, updateExerciseCustomSettings } from '../database/db';
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

  // Modal 1 : Liste déroulante / Catalogue des exercices
  const [isPickerModalOpen, setIsPickerModalOpen] = useState<boolean>(false);
  const [catalogExercises, setCatalogExercises] = useState<ConfiguredExercise[]>([]);

  // Modal 2 : Création d'un nouvel exercice personnalisé
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
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

  // Suppression d'un exercice de la séance
  const handleDeleteExercise = (index: number) => {
    const updated = exercises.filter((_, idx) => idx !== index);
    setExercises(updated);
  };

  // Réordonner les exercices via Drag & Drop
  const handleReorder = (reordered: ConfiguredExercise[]) => {
    setExercises(reordered);
  };

  // Ouvrir le sélecteur / liste déroulante du catalogue
  const openCatalogPicker = () => {
    triggerLightHaptic();
    const catalog = getAllCatalogExercises(selectedWorkoutId);
    setCatalogExercises(catalog);
    setIsPickerModalOpen(true);
  };

  // Ajouter un exercice depuis la liste déroulante du catalogue
  const handleSelectFromCatalog = (ex: ConfiguredExercise) => {
    triggerMediumHaptic();
    // Cloner pour éviter les collisions d'ID de séance
    const alreadyExists = exercises.some((e) => e.id === ex.id);
    if (alreadyExists) {
      Alert.alert('Déjà présent', 'Cet exercice est déjà dans la séance.');
      return;
    }

    setExercises([...exercises, ex]);
    setIsPickerModalOpen(false);
  };

  // Ouvrir le modal d'édition
  const openEditModal = (ex: ConfiguredExercise) => {
    triggerLightHaptic();
    setEditingExercise(ex);
    const sets = ex.numSets ?? 3;
    setEditSets(sets);
    setEditReps(ex.targetReps ?? 8);

    const currentWeights = ex.plannedWeights && ex.plannedWeights.length > 0
      ? [...ex.plannedWeights]
      : Array(sets).fill(ex.baseWeight || 40);

    while (currentWeights.length < sets) {
      currentWeights.push(currentWeights[currentWeights.length - 1] || 40);
    }
    setEditWeightsPerSet(currentWeights.slice(0, sets));
  };

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

  const adjustSingleSetWeight = (setIdx: number, delta: number) => {
    triggerLightHaptic();
    setEditWeightsPerSet((prev) => {
      const updated = [...prev];
      updated[setIdx] = Math.max(0, Math.round(((updated[setIdx] || 0) + delta) * 100) / 100);
      return updated;
    });
  };

  const applyPyramidalIncrement = (step: number) => {
    triggerLightHaptic();
    setEditWeightsPerSet((prev) => {
      const base = prev[0] || 40;
      return prev.map((_, idx) => base + idx * step);
    });
  };

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

  // Créer un nouvel exercice personnalisé dans le catalogue
  const handleCreateCustomSubmit = () => {
    if (!newExName.trim()) {
      Alert.alert('Nom requis', 'Merci de renseigner un nom pour l’exercice.');
      return;
    }
    triggerMediumHaptic();
    const weightNum = parseFloat(newExWeight) || 0;
    const repsNum = Math.max(1, newExReps);
    const setsNum = Math.max(1, newExSets);

    const created = addCustomExercise(
      selectedWorkoutId,
      newExName.trim(),
      newExCategory,
      weightNum,
      repsNum,
      setsNum
    );

    setExercises([...exercises, created]);
    setIsCreateModalOpen(false);
    setIsPickerModalOpen(false);
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
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête épuré */}
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <Text style={styles.appSubtitle}>SURCHARGE PROGRESSIVE</Text>
            <Text style={styles.appTitle}>Séance du jour</Text>
          </View>

          <TouchableOpacity style={styles.historyButton} onPress={onOpenHistory} activeOpacity={0.8}>
            <Text style={styles.historyButtonText}>📜 Historique</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Sélecteur de Séance PPL */}
        <View style={styles.workoutTabs}>
          {workouts.map((w) => {
            const isSelected = w.id === selectedWorkoutId;
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.workoutTab, isSelected && styles.workoutTabActive]}
                onPress={() => handleWorkoutSelect(w.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.workoutTabText, isSelected && styles.workoutTabTextActive]}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. Configuration des Temps de Repos (Compact & Net) */}
        <View style={styles.restCard}>
          <View style={styles.restRow}>
            <Text style={styles.restTitle}>⚙️ Repos Machines</Text>
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

          <View style={[styles.restRow, styles.restDivider]}>
            <Text style={styles.restTitle}>🔥 Repos Finisher</Text>
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

        {/* 3. Exercices Prévus : En-tête + Bouton Ajouter via Catalogue */}
        <View style={styles.exerciseHeaderRow}>
          <Text style={styles.sectionHeading}>EXERCICES ({exercises.length})</Text>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCatalogPicker}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Liste Drag & Drop sans débordement */}
        <DraggableExerciseList
          exercises={exercises}
          onReorder={handleReorder}
          onEdit={openEditModal}
          onDelete={handleDeleteExercise}
        />

        {/* Bouton Démarrer la Séance */}
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.startButtonText}>🚀 DÉMARRER LA SÉANCE</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL 1 : LISTE DÉROULANTE / SÉLECTEUR DU CATALOGUE */}
      <Modal visible={isPickerModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.modalTitle}>Catalogue d'exercices</Text>
            <Text style={styles.modalSubtitle}>Choisis un exercice pour ta séance {selectedWorkout.name}</Text>

            <ScrollView style={styles.catalogList} showsVerticalScrollIndicator={false}>
              {catalogExercises.map((catEx) => {
                const isSelectedInSession = exercises.some((e) => e.id === catEx.id);
                const isFinisher = catEx.category === 'FREE_WEIGHT';

                return (
                  <TouchableOpacity
                    key={catEx.id}
                    style={[
                      styles.catalogItem,
                      isSelectedInSession && styles.catalogItemDisabled,
                    ]}
                    disabled={isSelectedInSession}
                    onPress={() => handleSelectFromCatalog(catEx)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.catalogItemInfo}>
                      <Text
                        style={[
                          styles.catalogItemName,
                          isSelectedInSession && styles.catalogItemNameDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {catEx.name}
                      </Text>
                      <Text style={styles.catalogItemSub}>
                        {isFinisher ? '🔥 Finisher Barre (20kg)' : '⚙️ Machine Hammer Strength'} • {catEx.plannedWeights?.[0] || 40} kg
                      </Text>
                    </View>

                    <Text style={styles.catalogItemAction}>
                      {isSelectedInSession ? '✓ Déjà ajouté' : '+ Ajouter'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Bouton Créer un exercice personnalisé */}
            <TouchableOpacity
              style={styles.createCustomBtn}
              onPress={() => {
                triggerLightHaptic();
                setIsCreateModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.createCustomBtnText}>➕ Créer un nouvel exercice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsPickerModalOpen(false)}
            >
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2 : ÉDITION DÉTAILLÉE PAR SÉRIE (CRAYON) */}
      <Modal visible={editingExercise !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier les charges</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {editingExercise?.name}
            </Text>

            {/* Nombre de séries */}
            <Text style={styles.modalSectionLabel}>SÉRIES</Text>
            <View style={styles.pillsGrid}>
              {[2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pillBtn, editSets === s && styles.pillBtnActive]}
                  onPress={() => handleSetsCountChange(s)}
                >
                  <Text style={[styles.pillBtnText, editSets === s && styles.pillBtnTextActive]}>
                    {s} séries
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Répétitions */}
            <Text style={styles.modalSectionLabel}>OBJECTIF REPS</Text>
            <View style={styles.pillsGrid}>
              {[5, 6, 8, 10, 12, 15].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.pillBtn, editReps === r && styles.pillBtnActive]}
                  onPress={() => {
                    triggerLightHaptic();
                    setEditReps(r);
                  }}
                >
                  <Text style={[styles.pillBtnText, editReps === r && styles.pillBtnTextActive]}>
                    {r} reps
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Raccourcis rapides */}
            <View style={styles.shortcutsRow}>
              <TouchableOpacity style={styles.shortcutItem} onPress={() => applyPyramidalIncrement(2.5)}>
                <Text style={styles.shortcutItemText}>+2.5kg / série</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcutItem} onPress={() => applyPyramidalIncrement(5)}>
                <Text style={styles.shortcutItemText}>+5kg / série</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcutItem} onPress={equalizeAllSets}>
                <Text style={styles.shortcutItemText}>= Égaliser</Text>
              </TouchableOpacity>
            </View>

            {/* Lignes de charge par série */}
            <Text style={styles.modalSectionLabel}>CHARGES PAR SÉRIE</Text>
            <View style={styles.perSetContainer}>
              {editWeightsPerSet.map((weight, idx) => (
                <View key={idx} style={styles.setRowBox}>
                  <Text style={styles.setRowTitle}>Série {idx + 1}</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSingleSetWeight(idx, -2.5)}>
                      <Text style={styles.stepBtnText}>-2.5</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{weight} kg</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSingleSetWeight(idx, 2.5)}>
                      <Text style={styles.stepBtnText}>+2.5</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Actions Modal */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingExercise(null)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEditModal}>
                <Text style={styles.saveBtnText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3 : CRÉER UN NOUVEL EXERCICE PERSONNALISÉ */}
      <Modal visible={isCreateModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouvel exercice</Text>
            <Text style={styles.modalSubtitle}>Ajouter au catalogue permanent</Text>

            <Text style={styles.modalSectionLabel}>NOM DE LA MACHINE / EXERCICE</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newExName}
              onChangeText={setNewExName}
              placeholder="ex: HS Lateral Raise"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.modalSectionLabel}>TYPE</Text>
            <View style={styles.pillsGrid}>
              <TouchableOpacity
                style={[styles.pillBtn, newExCategory === 'HAMMER_STRENGTH' && styles.pillBtnActive]}
                onPress={() => setNewExCategory('HAMMER_STRENGTH')}
              >
                <Text style={[styles.pillBtnText, newExCategory === 'HAMMER_STRENGTH' && styles.pillBtnTextActive]}>
                  ⚙️ Machine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, newExCategory === 'FREE_WEIGHT' && styles.pillBtnActive]}
                onPress={() => setNewExCategory('FREE_WEIGHT')}
              >
                <Text style={[styles.pillBtnText, newExCategory === 'FREE_WEIGHT' && styles.pillBtnTextActive]}>
                  🔥 Barre (20kg)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionLabel}>CHARGE INITIALE (KG)</Text>
            <TextInput
              style={styles.modalTextInput}
              keyboardType="numeric"
              value={newExWeight}
              onChangeText={setNewExWeight}
              placeholder="40"
              placeholderTextColor="#64748B"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateCustomSubmit}>
                <Text style={styles.saveBtnText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  appSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  historyButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyButtonText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  workoutTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
  },
  workoutTab: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  workoutTabActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  workoutTabText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
  },
  workoutTabTextActive: {
    color: '#FFFFFF',
  },
  restCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    gap: 10,
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restDivider: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  restTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  timePills: {
    flexDirection: 'row',
    gap: 6,
  },
  timePill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timePillActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  timePillTextActive: {
    color: '#0F172A',
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  addBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  addBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  startButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 16,
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
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catalogList: {
    maxHeight: 260,
    marginVertical: 10,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
  },
  catalogItemDisabled: {
    opacity: 0.4,
    borderColor: '#1E293B',
  },
  catalogItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catalogItemNameDisabled: {
    color: '#64748B',
  },
  catalogItemSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  catalogItemAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  createCustomBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  createCustomBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 8,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pillBtnActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pillBtnTextActive: {
    color: '#0F172A',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  shortcutItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  shortcutItemText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  perSetContainer: {
    gap: 6,
    marginTop: 4,
  },
  setRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  setRowTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  stepValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    minWidth: 48,
    textAlign: 'center',
  },
  modalTextInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
});
