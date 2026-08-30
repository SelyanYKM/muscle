import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { initDatabase } from './src/database/db';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LiveWorkoutScreen } from './src/screens/LiveWorkoutScreen';
import { SessionPrepScreen } from './src/screens/SessionPrepScreen';
import { WorkoutSummaryScreen } from './src/screens/WorkoutSummaryScreen';
import { THEME } from './src/theme';
import { NextSessionPlan, SessionConfig, SetResult } from './src/types';

type ScreenState = 'PREP' | 'LIVE' | 'SUMMARY' | 'HISTORY';

interface WorkoutSummaryData {
  workoutName: string;
  durationMinutes: number;
  totalVolume: number;
  exerciseSummaries: {
    exerciseName: string;
    plan: NextSessionPlan;
    results: SetResult[];
  }[];
}

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('PREP');
  const [activeSessionConfig, setActiveSessionConfig] = useState<SessionConfig | null>(null);
  const [lastSummaryData, setLastSummaryData] = useState<WorkoutSummaryData | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
      } catch (e) {
        console.error('Erreur init database:', e);
      } finally {
        setIsDbReady(true);
      }
    }
    setup();
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.limeCream} />
        <Text style={styles.loadingText}>mooscles initialisation...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  const handleStartSession = (config: SessionConfig) => {
    setActiveSessionConfig(config);
    setCurrentScreen('LIVE');
  };

  const handleFinishSession = (summary: WorkoutSummaryData) => {
    setLastSummaryData(summary);
    setCurrentScreen('SUMMARY');
  };

  const handleQuitSession = () => {
    setActiveSessionConfig(null);
    setCurrentScreen('PREP');
  };

  return (
    <View style={styles.appContainer}>
      <StatusBar style="light" />

      {currentScreen === 'PREP' && (
        <SessionPrepScreen
          onStartSession={handleStartSession}
          onOpenHistory={() => setCurrentScreen('HISTORY')}
        />
      )}

      {currentScreen === 'LIVE' && activeSessionConfig && (
        <LiveWorkoutScreen
          sessionConfig={activeSessionConfig}
          onFinishSession={handleFinishSession}
          onQuitSession={handleQuitSession}
        />
      )}

      {currentScreen === 'SUMMARY' && lastSummaryData && (
        <WorkoutSummaryScreen
          summary={lastSummaryData}
          onClose={() => {
            setLastSummaryData(null);
            setActiveSessionConfig(null);
            setCurrentScreen('PREP');
          }}
        />
      )}

      {currentScreen === 'HISTORY' && (
        <HistoryScreen onBack={() => setCurrentScreen('PREP')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
