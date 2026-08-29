import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getRecentLogs, getWorkouts } from '../database/db';
import { WorkoutLogEntry } from '../types';
import { triggerLightHaptic } from '../utils/haptics';

interface HistoryScreenProps {
  onBack: () => void;
}

interface GroupedExercise {
  exerciseId: number;
  exerciseName: string;
  sets: WorkoutLogEntry[];
  totalVolume: number;
}

interface GroupedSession {
  sessionKey: string; // e.g. "2026-08-30_1"
  date: string;
  workoutId: number;
  workoutName: string;
  exercises: GroupedExercise[];
  totalVolume: number;
  totalSets: number;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const rawLogs = getRecentLogs(200);
    const workouts = getWorkouts();
    const workoutNameMap: Record<number, string> = {};
    for (const w of workouts) {
      workoutNameMap[w.id] = w.name;
    }

    // Regrouper par Séance (Date + WorkoutId)
    const sessionMap: Record<string, GroupedSession> = {};

    for (const log of rawLogs) {
      const key = `${log.date}_${log.workoutId}`;
      const workoutName = workoutNameMap[log.workoutId] || `Séance #${log.workoutId}`;

      if (!sessionMap[key]) {
        sessionMap[key] = {
          sessionKey: key,
          date: log.date,
          workoutId: log.workoutId,
          workoutName,
          exercises: [],
          totalVolume: 0,
          totalSets: 0,
        };
      }

      const session = sessionMap[key];
      session.totalVolume += log.weight * log.repsDone;
      session.totalSets += 1;

      // Trouver ou créer le groupe d'exercice dans la séance
      let exGroup = session.exercises.find((e) => e.exerciseId === log.exerciseId);
      if (!exGroup) {
        exGroup = {
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          sets: [],
          totalVolume: 0,
        };
        session.exercises.push(exGroup);
      }

      exGroup.sets.push(log);
      exGroup.totalVolume += log.weight * log.repsDone;
    }

    // Trier les séries par numéro de série croissant
    for (const session of Object.values(sessionMap)) {
      for (const ex of session.exercises) {
        ex.sets.sort((a, b) => a.setNumber - b.setNumber);
      }
    }

    const sessionList = Object.values(sessionMap);
    setSessions(sessionList);

    // Par défaut, ouvrir la séance la plus récente
    if (sessionList.length > 0) {
      setExpandedSessions({ [sessionList[0].sessionKey]: true });
    }
  }, []);

  const toggleSession = (key: string) => {
    triggerLightHaptic();
    setExpandedSessions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getFeelingBadge = (feeling: string) => {
    switch (feeling) {
      case 'EASY':
        return { emoji: '🟢', label: 'Facile', color: '#10B981' };
      case 'MEDIUM':
        return { emoji: '🟠', label: 'Juste', color: '#F59E0B' };
      default:
        return { emoji: '🔴', label: 'Échec', color: '#EF4444' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            triggerLightHaptic();
            onBack();
          }}
        >
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historique des Séances</Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🏋️‍♂️</Text>
          <Text style={styles.emptyTitle}>Aucune séance enregistrée</Text>
          <Text style={styles.emptySub}>
            Complète ta première séance pour voir tes performances regroupées ici.
          </Text>
        </View>
      ) : (
        <View style={styles.sessionsList}>
          {sessions.map((session) => {
            const isExpanded = expandedSessions[session.sessionKey] ?? false;

            return (
              <View key={session.sessionKey} style={styles.sessionCard}>
                {/* En-tête de la séance (Cliquable pour déplier/replier) */}
                <TouchableOpacity
                  style={styles.sessionHeader}
                  onPress={() => toggleSession(session.sessionKey)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionHeaderLeft}>
                    <View style={styles.workoutBadge}>
                      <Text style={styles.workoutBadgeText}>{session.workoutName.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.sessionDate}>📅 {session.date}</Text>
                  </View>

                  <View style={styles.sessionHeaderRight}>
                    <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Métriques globales de la séance */}
                <View style={styles.sessionSummaryRow}>
                  <View style={styles.miniStat}>
                    <Text style={styles.miniStatLabel}>EXERCICES</Text>
                    <Text style={styles.miniStatValue}>{session.exercises.length}</Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Text style={styles.miniStatLabel}>SÉRIES</Text>
                    <Text style={styles.miniStatValue}>{session.totalSets}</Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Text style={styles.miniStatLabel}>VOLUME TOTAL</Text>
                    <Text style={styles.miniStatValue}>
                      {session.totalVolume.toLocaleString('fr-FR')} kg
                    </Text>
                  </View>
                </View>

                {/* Détail des exercices (Affiché si déplié) */}
                {isExpanded && (
                  <View style={styles.exercisesContainer}>
                    {session.exercises.map((ex, exIdx) => (
                      <View key={ex.exerciseId || exIdx} style={styles.exerciseBox}>
                        <View style={styles.exerciseBoxHeader}>
                          <Text style={styles.exerciseBoxTitle} numberOfLines={1}>
                            {ex.exerciseName}
                          </Text>
                          <Text style={styles.exerciseBoxVolume}>
                            {ex.totalVolume.toLocaleString('fr-FR')} kg
                          </Text>
                        </View>

                        {/* Liste des séries de cet exercice */}
                        <View style={styles.setsList}>
                          {ex.sets.map((set, sIdx) => {
                            const badge = getFeelingBadge(set.feeling);
                            return (
                              <View key={set.id || sIdx} style={styles.setRow}>
                                <View style={styles.setColNum}>
                                  <Text style={styles.setColNumText}>S{set.setNumber}</Text>
                                </View>

                                <View style={styles.setColWeightReps}>
                                  <Text style={styles.setWeightText}>{set.weight} kg</Text>
                                  <Text style={styles.setRepsText}>× {set.repsDone} reps</Text>
                                  {set.repsDone < set.repsTarget && (
                                    <Text style={styles.setTargetSub}>(obj: {set.repsTarget})</Text>
                                  )}
                                </View>

                                <View style={[styles.feelingTag, { borderColor: badge.color }]}>
                                  <Text style={styles.feelingEmojiText}>{badge.emoji}</Text>
                                  <Text style={[styles.feelingLabelText, { color: badge.color }]}>
                                    {badge.label}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
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
    backgroundColor: '#0B0F19',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  backButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    padding: 20,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  sessionsList: {
    gap: 16,
  },
  sessionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#162032',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sessionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workoutBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  workoutBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sessionHeaderRight: {
    paddingHorizontal: 6,
  },
  expandIcon: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sessionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#283548',
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  miniStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  exercisesContainer: {
    padding: 14,
    gap: 12,
  },
  exerciseBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#283548',
  },
  exerciseBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 6,
  },
  exerciseBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  exerciseBoxVolume: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  setsList: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#162032',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  setColNum: {
    width: 32,
  },
  setColNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  setColWeightReps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  setWeightText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  setRepsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  setTargetSub: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  feelingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#0F172A',
  },
  feelingEmojiText: {
    fontSize: 11,
  },
  feelingLabelText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
