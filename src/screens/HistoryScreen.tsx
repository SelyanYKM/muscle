import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
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
import {
  clearAllWorkoutLogs,
  deleteExerciseFromSession,
  deleteWorkoutSession,
  getRecentLogs,
  updateExerciseLogsForSession,
  updateWorkoutSessionType,
} from '../database/db';
import { THEME } from '../theme';
import { Feeling, WorkoutLogEntry } from '../types';
import { exportHistoryAsText } from '../utils/exportHistory';
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

interface MonthGroup {
  label: string;
  sessions: GroupedSession[];
}

const FEELING_LABEL: Record<Feeling, string> = { EASY: 'Facile', MEDIUM: 'Juste', HARD: 'Échec' };
const FEELING_BG: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyBg,
  MEDIUM: THEME.colors.feelingMediumBg,
  HARD: THEME.colors.feelingHardBg,
};
const FEELING_INK: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyText,
  MEDIUM: THEME.colors.feelingMediumText,
  HARD: THEME.colors.feelingHardText,
};

function fmtKg(w: number): string {
  return w % 1 === 0 ? String(w) : String(w).replace('.', ',');
}

function groupByMonth(sessions: GroupedSession[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const indexByLabel = new Map<string, number>();

  for (const session of sessions) {
    const [y, m] = session.date.split('-').map(Number);
    const label = new Date(y, m - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      .toUpperCase();

    if (!indexByLabel.has(label)) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, sessions: [] });
    }
    groups[indexByLabel.get(label)!].sessions.push(session);
  }

  return groups;
}

// Flèche pivotante (200ms) pour le chevron de chaque séance : un Animated.Value par
// sessionKey, créé à la demande et conservé dans un ref pour survivre aux re-renders.
function useChevronAnim() {
  const animsRef = useRef<Map<string, Animated.Value>>(new Map());

  const get = (key: string, expanded: boolean) => {
    if (!animsRef.current.has(key)) {
      animsRef.current.set(key, new Animated.Value(expanded ? 1 : 0));
    }
    return animsRef.current.get(key)!;
  };

  const animateTo = (key: string, expanded: boolean) => {
    Animated.timing(get(key, expanded), {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return { get, animateTo };
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<{ [sessionKey: string]: boolean }>({});
  const [isExporting, setIsExporting] = useState(false);
  const chevronAnim = useChevronAnim();

  // Feuille 1 : Édition globale de la séance (Programme Push / Pull / Legs)
  const [editingSession, setEditingSession] = useState<GroupedSession | null>(null);
  const [selectedTargetWorkoutId, setSelectedTargetWorkoutId] = useState<number>(1);

  // Feuille 2 : Édition détaillée d'un exercice dans une séance passée
  const [editingExSession, setEditingExSession] = useState<{ session: GroupedSession; ex: GroupedExerciseLogs } | null>(null);
  const [editExName, setEditExName] = useState<string>('');
  const [editExSets, setEditExSets] = useState<{ setNumber: number; weight: number; repsTarget: number; repsDone: number; feeling: Feeling }[]>([]);

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
    setExpandedSessions((prev) => {
      const nextExpanded = !prev[sessionKey];
      chevronAnim.animateTo(sessionKey, nextExpanded);
      return { ...prev, [sessionKey]: nextExpanded };
    });
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

  const handleExport = async () => {
    if (isExporting) return;
    triggerLightHaptic();
    setIsExporting(true);
    try {
      await exportHistoryAsText();
    } finally {
      setIsExporting(false);
    }
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

  // Ouvrir la feuille d'édition d'un exercice dans l'historique
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
        feeling: s.feeling as Feeling,
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

  const setSetFeeling = (setIdx: number, feeling: Feeling) => {
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
      const last = prev[prev.length - 1] || { weight: 40, repsTarget: 8, repsDone: 8, feeling: 'MEDIUM' as Feeling };
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

  const monthGroups = groupByMonth(sessions);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête avec bouton Retour & Option Clear au clic long */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Icon name="arrow-left" size={18} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleWrapper}
          onLongPress={promptClearHistory}
          activeOpacity={0.8}
        >
          <Text style={styles.title}>Historique</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={isExporting || sessions.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.exportButtonText}>{isExporting ? '...' : 'Exporter'}</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune séance enregistrée.</Text>
          <Text style={styles.emptySubtext}>
            Complète ton premier entraînement pour voir tes charges évoluer !
          </Text>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {monthGroups.map((group) => {
            const monthVolume = group.sessions.reduce((acc, s) => acc + s.totalVolume, 0);

            return (
              <View key={group.label} style={{ gap: 10 }}>
                <View style={styles.monthHeaderRow}>
                  <Text style={styles.monthLabel}>{group.label}</Text>
                  <Text style={styles.monthSummary}>
                    {group.sessions.length} séance{group.sessions.length > 1 ? 's' : ''} · {Math.round(monthVolume).toLocaleString('fr-FR')} kg
                  </Text>
                </View>

                <View style={styles.monthContainer}>
                  {group.sessions.map((session, sIdx) => {
                    const sessionKey = `${session.date}_${session.workoutId}`;
                    const isExpanded = !!expandedSessions[sessionKey];
                    const split = THEME.splits[session.workoutId];
                    const rotation = chevronAnim.get(sessionKey, isExpanded).interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    });

                    return (
                      <View key={sIdx} style={[styles.sessionRow, sIdx > 0 && styles.sessionRowDivider]}>
                        <TouchableOpacity
                          style={styles.sessionHeader}
                          onPress={() => toggleSessionExpand(sessionKey)}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={split.gradient}
                            start={{ x: 0.1, y: 0 }}
                            end={{ x: 0.9, y: 1 }}
                            style={styles.letterBadge}
                          >
                            <Text style={[styles.letterBadgeText, { color: split.fg }]}>
                              {session.workoutName.charAt(0)}
                            </Text>
                          </LinearGradient>

                          <View style={styles.sessionHeaderLeft}>
                            <Text style={styles.dateText}>{formatDate(session.date)}</Text>
                            <Text style={styles.sessionWorkoutTitle} numberOfLines={1}>
                              {session.workoutName.split(' (')[0]}
                            </Text>
                            <Text style={styles.sessionMetricsSummary}>
                              {session.exercises.length} exos · {session.totalSets} séries ·{' '}
                              <Text style={styles.volumeHighlight}>{Math.round(session.totalVolume).toLocaleString('fr-FR')} kg</Text>
                            </Text>
                          </View>

                          <Animated.View style={[styles.chevronCircle, { transform: [{ rotate: rotation }] }]}>
                            <Icon name="chevron-down" size={16} color={THEME.colors.textSecondary} />
                          </Animated.View>
                        </TouchableOpacity>

                        {/* Contenu détaillé */}
                        {isExpanded && (
                          <View style={styles.sessionDetailsBox}>
                            {session.exercises.map((ex, exIdx) => (
                              <View key={exIdx} style={styles.exerciseDetailRow}>
                                <View style={styles.exerciseHeaderRow}>
                                  <Text style={styles.exerciseDetailName}>{ex.exerciseName}</Text>
                                  <TouchableOpacity
                                    onPress={() => openEditExerciseModal(session, ex)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.editExLink}>Modifier</Text>
                                  </TouchableOpacity>
                                </View>

                                <View style={styles.setsChipsRow}>
                                  {ex.sets.map((set, setIdx) => (
                                    <View key={setIdx} style={styles.setChip}>
                                      <Dot color={FEELING_INK[set.feeling as Feeling]} size={7} />
                                      <Text style={styles.setChipText}>
                                        S{set.setNumber} · {set.repsDone} × {fmtKg(set.weight)}kg
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            ))}

                            <TouchableOpacity
                              style={styles.editSessionFooterBtn}
                              onPress={() => openEditSessionModal(session)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.editSessionFooterText}>Modifier la séance</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Légende des pastilles */}
          <View style={styles.legendRow}>
            {(['EASY', 'MEDIUM', 'HARD'] as Feeling[]).map((f) => (
              <View key={f} style={styles.legendItem}>
                <Dot color={FEELING_INK[f]} size={8} />
                <Text style={styles.legendText}>{FEELING_LABEL[f]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* FEUILLE : MODIFIER LE PROGRAMME DE LA SÉANCE (PUSH / PULL / LEGS) */}
      <BottomSheet visible={!!editingSession} onClose={() => setEditingSession(null)} maxHeightPercent={60}>
        <Text style={styles.sheetTitle}>Modifier la séance</Text>
        <Text style={styles.sheetSubtitle}>
          Séance du {editingSession ? formatDate(editingSession.date) : ''}
        </Text>

        <Text style={styles.inputSectionLabel}>PROGRAMME ASSOCIÉ</Text>
        <View style={styles.programToggleRow}>
          {[{ id: 1, label: 'Push' }, { id: 2, label: 'Pull' }, { id: 3, label: 'Legs' }].map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.programBtn, selectedTargetWorkoutId === p.id && styles.programBtnActive]}
              onPress={() => setSelectedTargetWorkoutId(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.programBtnText, selectedTargetWorkoutId === p.id && styles.programBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveEditedSessionType} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Enregistrer la modification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.destructiveBtn} onPress={confirmDeleteSession} activeOpacity={0.8}>
          <Text style={styles.destructiveBtnText}>Supprimer cette séance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditingSession(null)} activeOpacity={0.8}>
          <Text style={styles.outlineBtnText}>Fermer</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* FEUILLE : MODIFIER L'EXERCICE & LES SÉRIES DANS L'HISTORIQUE */}
      <BottomSheet visible={!!editingExSession} onClose={() => setEditingExSession(null)}>
        <Text style={styles.sheetTitle}>Modifier l'exercice</Text>
        <Text style={styles.sheetSubtitle}>
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
                    <Text style={styles.deleteSetLink}>Retirer</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Ligne Poids & Reps */}
              <View style={styles.steppersRow}>
                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>POIDS</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetWeight(idx, -2.5)}>
                      <Text style={styles.stepBtnText}>−2,5</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValText}>{fmtKg(s.weight)}kg</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetWeight(idx, 2.5)}>
                      <Text style={styles.stepBtnText}>+2,5</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>REPS</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => adjustSetReps(idx, -1)}>
                      <Text style={styles.stepBtnText}>−1</Text>
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
                {(['EASY', 'MEDIUM', 'HARD'] as Feeling[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.feelBtn, s.feeling === f && { backgroundColor: FEELING_BG[f] }]}
                    onPress={() => setSetFeeling(idx, f)}
                  >
                    <Dot color={FEELING_INK[f]} size={7} />
                    <Text style={[styles.feelBtnText, s.feeling === f && { color: FEELING_INK[f] }]}>
                      {FEELING_LABEL[f]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.addSetBtn} onPress={addSetToEx} activeOpacity={0.8}>
          <Text style={styles.addSetBtnText}>+ Ajouter une série</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveEditedExercise} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Enregistrer l'exercice</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.destructiveBtn} onPress={confirmDeleteExerciseFromSession} activeOpacity={0.8}>
          <Text style={styles.destructiveBtnText}>Retirer cet exercice de la séance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditingExSession(null)} activeOpacity={0.8}>
          <Text style={styles.outlineBtnText}>Fermer</Text>
        </TouchableOpacity>
      </BottomSheet>
      </ScrollView>
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
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 28,
    color: THEME.colors.textPrimary,
  },
  exportButton: {
    height: 40,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 16,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  exportButtonText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
  },
  monthLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  monthSummary: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  monthContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: THEME.radius.card,
  },
  sessionRow: {},
  sessionRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  letterBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBadgeText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
  },
  sessionHeaderLeft: {
    flex: 1,
  },
  dateText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 1,
  },
  sessionWorkoutTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    color: THEME.colors.textPrimary,
  },
  sessionMetricsSummary: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  volumeHighlight: {
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionDetailsBox: {
    backgroundColor: '#F2F5FA',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  exerciseDetailRow: {
    gap: 6,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseDetailName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  editExLink: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accentStrong,
  },
  setsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  setChipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  editSessionFooterBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  editSessionFooterText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accentStrong,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
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
  inputSectionLabel: {
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
  programToggleRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.pill,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  programBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  programBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  programBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  programBtnTextActive: {
    color: THEME.colors.textPrimary,
  },
  setsEditScroll: {
    maxHeight: 220,
    marginBottom: 8,
  },
  setEditCard: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.inner,
    padding: 10,
    marginBottom: 8,
  },
  setEditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumberBadge: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  deleteSetLink: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.feelingHardText,
    fontSize: 11,
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
    fontFamily: THEME.fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 3,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.radius.inner,
    padding: 2,
  },
  stepBtn: {
    width: 36,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  stepValText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.accentStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  feelingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feelBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.cardBg,
    paddingVertical: 7,
    borderRadius: THEME.radius.inner,
  },
  feelBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  addSetBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  addSetBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  destructiveBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.feelingHardText,
    fontSize: 13,
    fontWeight: '800',
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
});
