import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { clearAllWorkoutLogs, getRecentLogs } from '../database/db';
import { THEME } from '../theme';
import { WorkoutLogEntry } from '../types';
import { triggerLightHaptic, triggerWarningHaptic } from '../utils/haptics';

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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleWrapper}
          onLongPress={promptClearHistory}
          activeOpacity={0.8}
        >
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.subHint}>Maintien long pour effacer</Text>
        </TouchableOpacity>

        {sessions.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={promptClearHistory}
            activeOpacity={0.7}
          >
            <Text style={styles.clearBtnText}>Purger</Text>
          </TouchableOpacity>
        )}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📜</Text>
          <Text style={styles.emptyText}>Aucune séance enregistrée.</Text>
          <Text style={styles.emptySubtext}>Complète ton premier entraînement pour voir tes charges évoluer !</Text>
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

                  <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
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
    justifyContent: 'space-between',
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
  subHint: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  clearBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  clearBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
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
});
