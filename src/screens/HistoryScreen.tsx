import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getRecentLogs } from '../database/db';
import { WorkoutLogEntry } from '../types';
import { triggerLightHaptic } from '../utils/haptics';

interface HistoryScreenProps {
  onBack: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<WorkoutLogEntry[]>([]);

  useEffect(() => {
    setLogs(getRecentLogs(100));
  }, []);

  const getFeelingBadge = (feeling: string) => {
    if (feeling === 'EASY') return '🟢 Facile';
    if (feeling === 'MEDIUM') return '🟠 Juste';
    return '🔴 Échec';
  };

  // Grouper les logs par date
  const groupedByDate: Record<string, WorkoutLogEntry[]> = {};
  for (const log of logs) {
    if (!groupedByDate[log.date]) {
      groupedByDate[log.date] = [];
    }
    groupedByDate[log.date].push(log);
  }

  const dates = Object.keys(groupedByDate);

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
        <Text style={styles.title}>Historique des Séries</Text>
      </View>

      {dates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🏋️‍♂️</Text>
          <Text style={styles.emptyTitle}>Aucune séance enregistrée</Text>
          <Text style={styles.emptySub}>Complète ta première séance pour voir tes performances ici.</Text>
        </View>
      ) : (
        dates.map((date) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateHeading}>📅 {date}</Text>

            <View style={styles.logsList}>
              {groupedByDate[date].map((log, idx) => (
                <View key={log.id || idx} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logExerciseName} numberOfLines={1}>
                      {log.exerciseName}
                    </Text>
                    <Text style={styles.logSetBadge}>Série {log.setNumber}</Text>
                  </View>

                  <View style={styles.logDetailsRow}>
                    <Text style={styles.logWeightReps}>
                      {log.weight} kg × {log.repsDone} reps
                    </Text>
                    <Text style={styles.logFeeling}>{getFeelingBadge(log.feeling)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
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
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  logsList: {
    gap: 8,
  },
  logCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logExerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  logSetBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logWeightReps: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  logFeeling: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
});
