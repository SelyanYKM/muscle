import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  clearAllWorkoutLogs,
  deleteWorkoutSession,
  getRecentLogs,
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

  // Modal d'édition de séance passée
  const [editingSession, setEditingSession] = useState<GroupedSession | null>(null);
  const [selectedTargetWorkoutId, setSelectedTargetWorkoutId] = useState<number>(1);

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
                        <Text style={styles.exerciseDetailName}>{ex.exerciseName}</Text>

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

      {/* MODAL D'ÉDITION D'UNE SÉANCE PASSÉE (RÉASSIGNER PUSH / PULL / LEGS) */}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
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
    paddingBottom: 6,
  },
  exerciseDetailName: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
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
    marginBottom: 16,
  },
  inputSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
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
  saveEditBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveEditBtnText: {
    color: THEME.colors.accentTextDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deleteSessionBtn: {
    backgroundColor: '#2D1216',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 8,
  },
  deleteSessionBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelModalBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
