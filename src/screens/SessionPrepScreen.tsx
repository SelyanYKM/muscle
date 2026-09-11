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
import {
  addCustomExercise,
  getAllCatalogExercises,
  getExercisesForWorkout,
  updateExerciseCustomSettings,
  updateExerciseFullDetails,
} from '../database/db';
import { THEME } from '../theme';
import { ConfiguredExercise, EquipmentCategory, SessionConfig } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface SessionPrepScreenProps {
  workoutId: number;
  workoutName: string;
  onStartSession: (config: SessionConfig) => void;
  onOpenHistory: () => void;
  onBack: () => void;
}

export const SessionPrepScreen: React.FC<SessionPrepScreenProps> = ({
  workoutId,
  workoutName,
  onStartSession,
  onOpenHistory,
  onBack,
}) => {
  const [standardRest, setStandardRest] = useState<number>(90);
  const [finisherRest, setFinisherRest] = useState<number>(180);
  const [exercises, setExercises] = useState<ConfiguredExercise[]>([]);

  // Modal d'édition de l'exercice (Crayon)
  const [editingExercise, setEditingExercise] = useState<ConfiguredExercise | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<EquipmentCategory>('HAMMER_STRENGTH');
  const [editWorkoutId, setEditWorkoutId] = useState<number>(1);
  const [editWeightsPerSet, setEditWeightsPerSet] = useState<number[]>([]);
  const [editReps, setEditReps] = useState<number>(8);
  const [editSets, setEditSets] = useState<number>(3);

  // Modal 1 : Catalogue d'exercices
  const [isPickerModalOpen, setIsPickerModalOpen] = useState<boolean>(false);
  const [catalogExercises, setCatalogExercises] = useState<ConfiguredExercise[]>([]);

  // Modal 2 : Création d'un exercice personnalisé
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>('');
  const [newExCategory, setNewExCategory] = useState<EquipmentCategory>('HAMMER_STRENGTH');
  const [newExWeight, setNewExWeight] = useState<string>('40');
  const [newExReps, setNewExReps] = useState<number>(8);
  const [newExSets, setNewExSets] = useState<number>(3);

  useEffect(() => {
    loadExercises(workoutId);
  }, [workoutId]);

  const loadExercises = (id: number) => {
    const list = getExercisesForWorkout(id);
    setExercises(list);
  };

  const handleDeleteExercise = (index: number) => {
    const updated = exercises.filter((_, idx) => idx !== index);
    setExercises(updated);
  };

  const handleReorder = (reordered: ConfiguredExercise[]) => {
    setExercises(reordered);
  };

  const openCatalogPicker = () => {
    triggerLightHaptic();
    const catalog = getAllCatalogExercises(workoutId);
    setCatalogExercises(catalog);
    setIsPickerModalOpen(true);
  };

  const handleSelectFromCatalog = (ex: ConfiguredExercise) => {
    triggerMediumHaptic();
    const alreadyExists = exercises.some((e) => e.id === ex.id);
    if (alreadyExists) {
      Alert.alert('Déjà présent', 'Cet exercice est déjà dans la séance.');
      return;
    }

    setExercises([...exercises, ex]);
    setIsPickerModalOpen(false);
  };

  const openEditModal = (ex: ConfiguredExercise) => {
    triggerLightHaptic();
    setEditingExercise(ex);
    setEditName(ex.name);
    setEditCategory(ex.category);
    setEditWorkoutId(ex.workoutId);
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
    const cleanName = editName.trim() || editingExercise.name;
    const repsNum = Math.max(1, editReps);
    const setsNum = Math.max(1, editSets);
    const finalWeights = editWeightsPerSet.slice(0, setsNum);

    updateExerciseFullDetails(
      editingExercise.id,
      editWorkoutId,
      cleanName,
      editCategory,
      finalWeights,
      repsNum,
      setsNum
    );

    if (editWorkoutId !== workoutId) {
      // Déplacé vers un autre programme (ex: Push vers Legs) -> Retirer de la vue courante
      setExercises(exercises.filter((e) => e.id !== editingExercise.id));
    } else {
      const updated = exercises.map((e) => {
        if (e.id === editingExercise.id) {
          return {
            ...e,
            name: cleanName,
            category: editCategory,
            workoutId: editWorkoutId,
            targetReps: repsNum,
            numSets: setsNum,
            plannedWeights: finalWeights,
            baseWeight: editCategory === 'FREE_WEIGHT' ? 20 : 0,
          };
        }
        return e;
      });
      setExercises(updated);
    }

    setEditingExercise(null);
  };

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
      workoutId,
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
      workoutId,
      workoutName,
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
        {/* Barre de navigation sobre avec Retour et Split sélectionné */}
        <View style={styles.topNavBar}>
          <TouchableOpacity
            style={styles.backNavBtn}
            onPress={() => {
              triggerLightHaptic();
              onBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.backNavBtnText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>{workoutName.toUpperCase()} (GUIDÉ)</Text>
          </View>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={onOpenHistory}
            activeOpacity={0.8}
          >
            <Text style={styles.historyButtonText}>Historique</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Repos Automatique (Sobre & Épuré) */}
        <View style={styles.restCard}>
          <View style={styles.restRow}>
            <Text style={styles.restTitle}>Repos Machines</Text>
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
            <Text style={styles.restTitle}>Repos Finisher Barre</Text>
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

        {/* 3. Exercices Prévus */}
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

        {/* Liste Drag & Drop */}
        <DraggableExerciseList
          exercises={exercises}
          onReorder={handleReorder}
          onEdit={openEditModal}
          onDelete={handleDeleteExercise}
        />

        {/* Bouton CTA Volt */}
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.startButtonText}>DÉMARRER LA SÉANCE</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL 1 : CATALOGUE D'EXERCICES */}
      <Modal visible={isPickerModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.modalTitle}>Catalogue d'exercices</Text>
            <Text style={styles.modalSubtitle}>Sélectionne pour ta séance {workoutName}</Text>

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
                        {isFinisher ? 'Finisher Barre' : 'Machine Hammer'} • {catEx.plannedWeights?.[0] || 40} kg
                      </Text>
                    </View>

                    <Text style={[styles.catalogItemAction, isSelectedInSession && styles.catalogItemActionDisabled]}>
                      {isSelectedInSession ? 'Ajouté' : '+ Ajouter'}
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
              style={styles.cancelBtn}
              onPress={() => setIsPickerModalOpen(false)}
            >
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2 : ÉDITION DÉTAILLÉE DE L'EXERCICE */}
      <Modal visible={editingExercise !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier l'exercice</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              Personnalisation & progression
            </Text>

            {/* Nom de l'exercice */}
            <Text style={styles.modalSectionLabel}>NOM DE L'EXERCICE</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nom de l'exercice"
              placeholderTextColor={THEME.colors.textMuted}
            />

            {/* Programme associé (Push / Pull / Legs) */}
            <Text style={styles.modalSectionLabel}>PROGRAMME ASSOCIÉ</Text>
            <View style={styles.pillsGrid}>
              <TouchableOpacity
                style={[styles.pillBtn, editWorkoutId === 1 && styles.pillBtnActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setEditWorkoutId(1);
                }}
              >
                <Text style={[styles.pillBtnText, editWorkoutId === 1 && styles.pillBtnTextActive]}>
                  Push
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, editWorkoutId === 2 && styles.pillBtnActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setEditWorkoutId(2);
                }}
              >
                <Text style={[styles.pillBtnText, editWorkoutId === 2 && styles.pillBtnTextActive]}>
                  Pull
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, editWorkoutId === 3 && styles.pillBtnActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setEditWorkoutId(3);
                }}
              >
                <Text style={[styles.pillBtnText, editWorkoutId === 3 && styles.pillBtnTextActive]}>
                  Legs
                </Text>
              </TouchableOpacity>
            </View>

            {/* Type d'équipement */}
            <Text style={styles.modalSectionLabel}>TYPE D'ÉQUIPEMENT</Text>
            <View style={styles.pillsGrid}>
              <TouchableOpacity
                style={[styles.pillBtn, editCategory === 'HAMMER_STRENGTH' && styles.pillBtnActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setEditCategory('HAMMER_STRENGTH');
                }}
              >
                <Text style={[styles.pillBtnText, editCategory === 'HAMMER_STRENGTH' && styles.pillBtnTextActive]}>
                  Machine (0kg base)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, editCategory === 'FREE_WEIGHT' && styles.pillBtnActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setEditCategory('FREE_WEIGHT');
                }}
              >
                <Text style={[styles.pillBtnText, editCategory === 'FREE_WEIGHT' && styles.pillBtnTextActive]}>
                  Barre Libre (20kg base)
                </Text>
              </TouchableOpacity>
            </View>

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

      {/* MODAL 3 : CRÉER UN NOUVEL EXERCICE */}
      <Modal visible={isCreateModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouvel exercice</Text>
            <Text style={styles.modalSubtitle}>Ajouter au catalogue permanent</Text>

            <Text style={styles.modalSectionLabel}>NOM DE LA MACHINE</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newExName}
              onChangeText={setNewExName}
              placeholder="ex: HS Lateral Raise"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <Text style={styles.modalSectionLabel}>TYPE</Text>
            <View style={styles.pillsGrid}>
              <TouchableOpacity
                style={[styles.pillBtn, newExCategory === 'HAMMER_STRENGTH' && styles.pillBtnActive]}
                onPress={() => setNewExCategory('HAMMER_STRENGTH')}
              >
                <Text style={[styles.pillBtnText, newExCategory === 'HAMMER_STRENGTH' && styles.pillBtnTextActive]}>
                  Machine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, newExCategory === 'FREE_WEIGHT' && styles.pillBtnActive]}
                onPress={() => setNewExCategory('FREE_WEIGHT')}
              >
                <Text style={[styles.pillBtnText, newExCategory === 'FREE_WEIGHT' && styles.pillBtnTextActive]}>
                  Barre Libre (20kg)
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
              placeholderTextColor={THEME.colors.textMuted}
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
    backgroundColor: THEME.colors.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 36,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backNavBtn: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  backNavBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionBadge: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.colors.accent,
    letterSpacing: 0.8,
  },
  historyButton: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  historyButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  restCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    borderTopColor: THEME.colors.cardBorder,
    paddingTop: 10,
  },
  restTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  timePills: {
    flexDirection: 'row',
    gap: 6,
  },
  timePill: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  timePillActive: {
    backgroundColor: THEME.colors.textPrimary,
    borderColor: THEME.colors.textPrimary,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  timePillTextActive: {
    color: THEME.colors.accentTextDark,
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
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  addBtn: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  addBtnText: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  startButton: {
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  startButtonText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  catalogList: {
    maxHeight: 260,
    marginVertical: 10,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 6,
  },
  catalogItemDisabled: {
    opacity: 0.35,
    borderColor: THEME.colors.cardBorder,
  },
  catalogItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  catalogItemNameDisabled: {
    color: THEME.colors.textMuted,
  },
  catalogItemSub: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  catalogItemAction: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.accent,
  },
  catalogItemActionDisabled: {
    color: THEME.colors.textMuted,
  },
  createCustomBtn: {
    backgroundColor: THEME.colors.cardInner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  createCustomBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
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
    backgroundColor: THEME.colors.cardInner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pillBtnActive: {
    backgroundColor: THEME.colors.textPrimary,
    borderColor: THEME.colors.textPrimary,
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  pillBtnTextActive: {
    color: THEME.colors.accentTextDark,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  shortcutItem: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  shortcutItemText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  perSetContainer: {
    gap: 6,
    marginTop: 4,
  },
  setRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  stepBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  stepValue: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 48,
    textAlign: 'center',
  },
  modalTextInput: {
    backgroundColor: THEME.colors.cardInner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: THEME.colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.colors.accentTextDark,
  },
});
