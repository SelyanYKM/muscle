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
import {
  clearAllWorkoutLogs,
  deleteExerciseFromSession,
  deleteWorkoutSession,
  getRecentLogs,
  updateExerciseLogsForSession,
  updateWorkoutSessionType,
} from '../database/db';
import { THEME } from '../theme';
import { WorkoutLogEntry } from '../types';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface HistoryScreenProps {
  onBack: () => void;
}

interface GroupedExerciseLogs {
  exerciseName: string;
  sets: WorkoutLogEntry[];
}

interface GroupedSession {
  date: string;
  workoutId: number;
  workoutName: string;
  totalVolume: number;
  totalSets: number;
  exercises: GroupedExerciseLogs[];
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<{ [sessionKey: string]: boolean }>({});

  // Modal 1 : Édition globale de la séance (Programme Push / Pull / Legs)
  const [editingSession, setEditingSession] = useState<GroupedSession | null>(null);
  const [selectedTargetWorkoutId, setSelectedTargetWorkoutId] = useState<number>(1);

  // Modal 2 : Édition détaillée d'un exercice dans une séance passée
  const [editingExSession, setEditingExSession] = useState<{ session: GroupedSession; ex: GroupedExerciseLogs } | null>(null);
  const [editExName, setEditExName] = useState<string>('');
  const [editExSets, setEditExSets] = useState<{ setNumber: number; weight: number; repsTarget: number; repsDone: number; feeling: 'EASY' | 'MEDIUM' | 'HARD' }[]>([]);

  useEffect(() => {
    loadHierarchicalLogs();
  }, []);

  const loadHierarchicalLogs = () => {
    const rawLogs = getRecentLogs(300);

    const sessionMap = new Map<string, GroupedSession>();

    for (const log of rawLogs) {
      const sessionKey = `${log.date}_${log.workoutId}`;
      const workoutName =
        log.workoutId === 1
          ? 'Push (Pecs / Épaules / Triceps)'
          : log.workoutId === 2
          ? 'Pull (Dos / Arrière d’épaules / Biceps)'
          : 'Legs (Quadriceps / Ischios / Mollets)';

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          date: log.date,
          workoutId: log.workoutId,
          workoutName,
          totalVolume: 0,
          totalSets: 0,
          exercises: [],
        });
      }

      const session = sessionMap.get(sessionKey)!;
      session.totalVolume += log.weight * log.repsDone;
      session.totalSets += 1;

      let exGroup = session.exercises.find((e) => e.exerciseName === log.exerciseName);
      if (!exGroup) {
        exGroup = {
          exerciseName: log.exerciseName,
          sets: [],
        };
        session.exercises.push(exGroup);
      }

      exGroup.sets.push(log);
    }

    const sessionList = Array.from(sessionMap.values());
    setSessions(sessionList);

    if (sessionList.length > 0) {
      const firstKey = `${sessionList[0].date}_${sessionList[0].workoutId}`;
      setExpandedSessions({ [firstKey]: true });
    }
  };

  const toggleSessionExpand = (sessionKey: string) => {
    triggerLightHaptic();
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionKey]: !prev[sessionKey],
    }));
  };

  const promptClearHistory = () => {
    triggerWarningHaptic();
    Alert.alert(
      "Effacer l'historique ?",
      "Toutes les séances et performances enregistrées seront définitivement supprimées.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: () => {
            clearAllWorkoutLogs();
            setSessions([]);
            setExpandedSessions({});
          },
        },
      ]
    );
  };

  const openEditSessionModal = (session: GroupedSession) => {
    triggerLightHaptic();
    setEditingSession(session);
    setSelectedTargetWorkoutId(session.workoutId);
  };

  const saveEditedSessionType = () => {
    if (!editingSession) return;
    triggerMediumHaptic();

    if (selectedTargetWorkoutId !== editingSession.workoutId) {
      updateWorkoutSessionType(
        editingSession.date,
        editingSession.workoutId,
        selectedTargetWorkoutId
      );
      loadHierarchicalLogs();
    }
    setEditingSession(null);
  };

  const confirmDeleteSession = () => {
    if (!editingSession) return;
    triggerWarningHaptic();

    Alert.alert(
      'Supprimer cette séance ?',
      `La séance du ${formatDate(editingSession.date)} sera supprimée de l'historique.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteWorkoutSession(editingSession.date, editingSession.workoutId);
            setEditingSession(null);
            loadHierarchicalLogs();
          },
        },
      ]
    );
  };

  // Ouvrir le modal d'édition d'un exercice dans l'historique
  const openEditExerciseModal = (session: GroupedSession, ex: GroupedExerciseLogs) => {
    triggerLightHaptic();
    setEditingExSession({ session, ex });
    setEditExName(ex.exerciseName);
    setEditExSets(
      ex.sets.map((s, idx) => ({
        setNumber: idx + 1,
        weight: s.weight,
        repsTarget: s.repsTarget || 8,
        repsDone: s.repsDone,
        feeling: s.feeling as 'EASY' | 'MEDIUM' | 'HARD',
      }))
    );
  };

  const adjustSetWeight = (setIdx: number, delta: number) => {
    triggerLightHaptic();
    setEditExSets((prev) => {
      const updated = [...prev];
      updated[setIdx] = {
        ...updated[setIdx],
        weight: Math.max(0, Math.round(((updated[setIdx].weight || 0) + delta) * 100) / 100),
      };
      return updated;
    });
  };

  const adjustSetReps = (setIdx: number, delta: number) => {
    triggerLightHaptic();
    setEditExSets((prev) => {
      const updated = [...prev];
      updated[setIdx] = {
        ...updated[setIdx],
        repsDone: Math.max(0, (updated[setIdx].repsDone || 0) + delta),
      };
      return updated;
    });
  };

  const setSetFeeling = (setIdx: number, feeling: 'EASY' | 'MEDIUM' | 'HARD') => {
    triggerLightHaptic();
    setEditExSets((prev) => {
      const updated = [...prev];
      updated[setIdx] = { ...updated[setIdx], feeling };
      return updated;
    });
  };

  const addSetToEx = () => {
    triggerLightHaptic();
    setEditExSets((prev) => {
      const last = prev[prev.length - 1] || { weight: 40, repsTarget: 8, repsDone: 8, feeling: 'MEDIUM' };
      return [
        ...prev,
        {
          setNumber: prev.length + 1,
          weight: last.weight,
          repsTarget: last.repsTarget,
          repsDone: last.repsDone,
          feeling: last.feeling,
        },
      ];
    });
  };

  const removeSetFromEx = (setIdx: number) => {
    triggerLightHaptic();
    if (editExSets.length <= 1) {
      Alert.alert('Action impossible', 'Un exercice doit comporter au moins 1 série.');
      return;
    }
    const updated = editExSets.filter((_, idx) => idx !== setIdx).map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    setEditExSets(updated);
  };

  const saveEditedExercise = () => {
    if (!editingExSession) return;
    if (!editExName.trim()) {
      Alert.alert('Nom requis', 'Renseigne un nom pour l’exercice.');
      return;
    }
    triggerMediumHaptic();

    updateExerciseLogsForSession(
      editingExSession.session.date,
      editingExSession.session.workoutId,
      editingExSession.ex.exerciseName,
      editExName.trim(),
      editExSets
    );

    setEditingExSession(null);
    loadHierarchicalLogs();
  };

  const confirmDeleteExerciseFromSession = () => {
    if (!editingExSession) return;
    triggerWarningHaptic();

    Alert.alert(
      'Supprimer cet exercice ?',
      `L'exercice "${editingExSession.ex.exerciseName}" sera retiré de la séance du ${formatDate(editingExSession.session.date)}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteExerciseFromSession(
              editingExSession.session.date,
              editingExSession.session.workoutId,
              editingExSession.ex.exerciseName
            );
            setEditingExSession(null);
            loadHierarchicalLogs();
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return d.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête avec bouton Retour & Option Clear au clic long */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleWrapper}
          onLongPress={promptClearHistory}
          activeOpacity={0.8}
        >
          <Text style={styles.title}>Historique</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📜</Text>
          <Text style={styles.emptyText}>Aucune séance enregistrée.</Text>
          <Text style={styles.emptySubtext}>
            Complète ton premier entraînement pour voir tes charges évoluer !
          </Text>
        </View>
      ) : (
        <View style={styles.sessionList}>
          {sessions.map((session, sIdx) => {
            const sessionKey = `${session.date}_${session.workoutId}`;
            const isExpanded = !!expandedSessions[sessionKey];

            return (
              <View key={sIdx} style={styles.sessionCard}>
                {/* En-tête de la séance */}
                <TouchableOpacity
                  style={styles.sessionHeader}
                  onPress={() => toggleSessionExpand(sessionKey)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionHeaderLeft}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{formatDate(session.date)}</Text>
                    </View>
                    <Text style={styles.sessionWorkoutTitle} numberOfLines={1}>
                      {session.workoutName}
                    </Text>
                    <Text style={styles.sessionMetricsSummary}>
                      {session.exercises.length} exos • {session.totalSets} séries •{' '}
                      <Text style={styles.volumeHighlight}>{Math.round(session.totalVolume)} kg vol.</Text>
                    </Text>
                  </View>

                  <View style={styles.sessionHeaderActions}>
                    <TouchableOpacity
                      style={styles.editSessionBtn}
                      onPress={() => openEditSessionModal(session)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editSessionIcon}>✏️</Text>
                    </TouchableOpacity>
                    <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Contenu détaillé */}
                {isExpanded && (
                  <View style={styles.sessionDetailsBox}>
                    {session.exercises.map((ex, exIdx) => (
                      <View key={exIdx} style={styles.exerciseDetailRow}>
                        <View style={styles.exerciseHeaderRow}>
                          <Text style={styles.exerciseDetailName}>{ex.exerciseName}</Text>
                          <TouchableOpacity
                            style={styles.editExBtn}
                            onPress={() => openEditExerciseModal(session, ex)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.editExIcon}>✏️ Modifier</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.setsChipsRow}>
                          {ex.sets.map((set, setIdx) => (
                            <View key={setIdx} style={styles.setChip}>
                              <Text style={styles.setChipText}>
                                S{set.setNumber}: {set.repsDone} reps @ {set.weight}kg{' '}
                                {set.feeling === 'EASY' ? '🟢' : set.feeling === 'MEDIUM' ? '🟠' : '🔴'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* MODAL 1 : MODIFIER LE PROGRAMME DE LA SÉANCE (PUSH / PULL / LEGS) */}
      <Modal visible={!!editingSession} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.editModalCard}>
            <Text style={styles.modalTitle}>Modifier la séance</Text>
            <Text style={styles.modalSubtitle}>
              Séance du {editingSession ? formatDate(editingSession.date) : ''}
            </Text>

            <Text style={styles.inputSectionLabel}>PROGRAMME ASSOCIÉ</Text>
            <View style={styles.programToggleRow}>
              <TouchableOpacity
                style={[
                  styles.programBtn,
                  selectedTargetWorkoutId === 1 && styles.programBtnActive,
                ]}
                onPress={() => setSelectedTargetWorkoutId(1)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.programBtnText,
                    selectedTargetWorkoutId === 1 && styles.programBtnTextActive,
                  ]}
                >
                  Push
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.programBtn,
                  selectedTargetWorkoutId === 2 && styles.programBtnActive,
                ]}
                onPress={() => setSelectedTargetWorkoutId(2)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.programBtnText,
                    selectedTargetWorkoutId === 2 && styles.programBtnTextActive,
                  ]}
                >
                  Pull
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.programBtn,
                  selectedTargetWorkoutId === 3 && styles.programBtnActive,
                ]}
                onPress={() => setSelectedTargetWorkoutId(3)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.programBtnText,
                    selectedTargetWorkoutId === 3 && styles.programBtnTextActive,
                  ]}
                >
                  Legs
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.saveEditBtn}
              onPress={saveEditedSessionType}
              activeOpacity={0.85}
            >
              <Text style={styles.saveEditBtnText}>ENREGISTRER LA MODIFICATION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteSessionBtn}
              onPress={confirmDeleteSession}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteSessionBtnText}>Supprimer cette séance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() => setEditingSession(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2 : MODIFIER L'EXERCICE & LES SÉRIES DANS L'HISTORIQUE */}
      <Modal visible={!!editingExSession} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.editExModalCard}>
            <Text style={styles.modalTitle}>Modifier l'exercice</Text>
            <Text style={styles.modalSubtitle}>
              Séance du {editingExSession ? formatDate(editingExSession.session.date) : ''}
            </Text>

            <Text style={styles.inputSectionLabel}>NOM DE L'EXERCICE</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editExName}
              onChangeText={setEditExName}
              placeholder="Nom de l'exercice"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <Text style={styles.inputSectionLabel}>SÉRIES EFFECTUÉES</Text>
            <ScrollView style={styles.setsEditScroll} showsVerticalScrollIndicator={false}>
              {editExSets.map((s, idx) => (
                <View key={idx} style={styles.setEditCard}>
                  <View style={styles.setEditTop}>
                    <Text style={styles.setNumberBadge}>Série {s.setNumber}</Text>
                    {editExSets.length > 1 && (
                      <TouchableOpacity onPress={() => removeSetFromEx(idx)}>
                        <Text style={styles.deleteSetBtn}>✕ Suppr</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Ligne Poids & Reps */}
                  <View style={styles.steppersRow}>
                    <View style={styles.stepperBlock}>
                      <Text style={styles.stepperLabel}>POIDS</Text>
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetWeight(idx, -2.5)}>
                          <Text style={styles.stepBtnText}>-2.5</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValText}>{s.weight}kg</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetWeight(idx, 2.5)}>
                          <Text style={styles.stepBtnText}>+2.5</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.stepperBlock}>
                      <Text style={styles.stepperLabel}>REPS</Text>
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetReps(idx, -1)}>
                          <Text style={styles.stepBtnText}>-1</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValText}>{s.repsDone}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetReps(idx, 1)}>
                          <Text style={styles.stepBtnText}>+1</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Ressenti */}
                  <View style={styles.feelingRow}>
                    <TouchableOpacity
                      style={[styles.feelBtn, s.feeling === 'EASY' && styles.feelBtnEasy]}
                      onPress={() => setSetFeeling(idx, 'EASY')}
                    >
                      <Text style={styles.feelBtnText}>🟢 Facile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.feelBtn, s.feeling === 'MEDIUM' && styles.feelBtnMedium]}
                      onPress={() => setSetFeeling(idx, 'MEDIUM')}
                    >
                      <Text style={styles.feelBtnText}>🟠 Juste</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.feelBtn, s.feeling === 'HARD' && styles.feelBtnHard]}
                      onPress={() => setSetFeeling(idx, 'HARD')}
                    >
                      <Text style={styles.feelBtnText}>🔴 Échec</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.addSetBtn} onPress={addSetToEx} activeOpacity={0.8}>
              <Text style={styles.addSetBtnText}>+ Ajouter une série</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveEditBtn} onPress={saveEditedExercise} activeOpacity={0.85}>
              <Text style={styles.saveEditBtnText}>ENREGISTRER L'EXERCICE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteSessionBtn} onPress={confirmDeleteExerciseFromSession} activeOpacity={0.8}>
              <Text style={styles.deleteSessionBtnText}>Retirer cet exercice de la séance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setEditingExSession(null)} activeOpacity={0.8}>
              <Text style={styles.cancelModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  backButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  titleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: 'hidden',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  sessionHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  sessionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editSessionBtn: {
    backgroundColor: THEME.colors.cardInner,
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  editSessionIcon: {
    fontSize: 11,
  },
  dateBadge: {
    backgroundColor: THEME.colors.cardInner,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  dateBadgeText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sessionWorkoutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  sessionMetricsSummary: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  volumeHighlight: {
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  expandChevron: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  sessionDetailsBox: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
    backgroundColor: THEME.colors.cardInner,
    padding: 10,
    gap: 8,
  },
  exerciseDetailRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 8,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseDetailName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  editExBtn: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  editExIcon: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accent,
  },
  setsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  setChip: {
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  editExModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
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
  inputSectionLabel: {
    fontSize: 10,
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
  programToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  programBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  programBtnActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  programBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  programBtnTextActive: {
    color: THEME.colors.accentTextDark,
  },
  setsEditScroll: {
    maxHeight: 220,
    marginBottom: 8,
  },
  setEditCard: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setEditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumberBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  deleteSetBtn: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stepperBlock: {
    flex: 1,
  },
  stepperLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 3,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  stepBtn: {
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  stepValText: {
    flex: 1,
    textAlign: 'center',
    color: THEME.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  feelingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feelBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  feelBtnEasy: {
    backgroundColor: THEME.colors.feelingEasyBg,
    borderColor: THEME.colors.feelingEasyBorder,
  },
  feelBtnMedium: {
    backgroundColor: THEME.colors.feelingMediumBg,
    borderColor: THEME.colors.feelingMediumBorder,
  },
  feelBtnHard: {
    backgroundColor: THEME.colors.feelingHardBg,
    borderColor: THEME.colors.feelingHardBorder,
  },
  feelBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addSetBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 8,
  },
  addSetBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  saveEditBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  saveEditBtnText: {
    color: THEME.colors.accentTextDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deleteSessionBtn: {
    backgroundColor: '#2D1216',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 6,
  },
  deleteSessionBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  cancelModalBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});
