import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getExercisesForWorkout, getWorkouts } from '../database/db';
import { SessionConfig, Workout } from '../types';
import { triggerLightHaptic } from '../utils/haptics';

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

  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId) || workouts[0];
  const exercises = getExercisesForWorkout(selectedWorkoutId);

  const handleWorkoutSelect = (wId: number) => {
    triggerLightHaptic();
    setSelectedWorkoutId(wId);
  };

  const handleStart = () => {
    triggerLightHaptic();
    onStartSession({
      workoutId: selectedWorkout.id,
      workoutName: selectedWorkout.name,
      standardRestSeconds: standardRest,
      finisherRestSeconds: finisherRest,
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

      {/* 3. Aperçu des exercices de la séance */}
      <Text style={styles.sectionHeading}>3. EXERCICES PRÉVUS ({exercises.length})</Text>
      <View style={styles.exercisesList}>
        {exercises.map((ex, index) => {
          const isFinisher = ex.category === 'FREE_WEIGHT';
          const plannedStr = ex.plannedWeights ? ex.plannedWeights.join(' / ') : `${ex.defaultStartingWeight} kg`;

          return (
            <View key={ex.id} style={[styles.exerciseItem, isFinisher && styles.exerciseItemFinisher]}>
              <View style={styles.exerciseIndexBadge}>
                <Text style={styles.exerciseIndexText}>{index + 1}</Text>
              </View>

              <View style={styles.exerciseDetails}>
                <Text style={styles.exerciseNameText} numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text style={styles.exerciseMetaText}>
                  3 séries • Objectif {ex.defaultTargetReps} reps • Prévu : {plannedStr} kg
                </Text>
              </View>

              <View style={[styles.categoryTag, isFinisher ? styles.finisherTag : styles.machineTag]}>
                <Text style={[styles.categoryTagText, isFinisher ? styles.finisherTagText : styles.machineTagText]}>
                  {isFinisher ? 'FINISHER' : 'HAMMER'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Gros Bouton de Démarrage */}
      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startButtonText}>🚀 DÉMARRER LA SÉANCE</Text>
      </TouchableOpacity>
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
  exercisesList: {
    gap: 8,
    marginBottom: 26,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exerciseItemFinisher: {
    borderColor: '#7F1D1D',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
  },
  exerciseIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  exerciseMetaText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  machineTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  machineTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  finisherTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  finisherTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F87171',
  },
  categoryTagText: {
    letterSpacing: 0.5,
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
});
