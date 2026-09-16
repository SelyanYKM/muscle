import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Petrona_700Bold } from '@expo-google-fonts/petrona';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { FreeWorkoutScreen } from './src/screens/FreeWorkoutScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LiveWorkoutScreen } from './src/screens/LiveWorkoutScreen';
import { SessionPrepScreen } from './src/screens/SessionPrepScreen';
import { SplitSelectScreen } from './src/screens/SplitSelectScreen';
import { WorkoutModeSelectScreen } from './src/screens/WorkoutModeSelectScreen';
import { WorkoutSummaryScreen } from './src/screens/WorkoutSummaryScreen';
import { THEME } from './src/theme';
import { NextSessionPlan, SessionConfig, SetResult } from './src/types';
import { configureAppAudio } from './src/utils/audio';
import { configureNotifications } from './src/utils/notifications';

type ScreenState =
  | 'SPLIT_SELECT'
  | 'MODE_SELECT'
  | 'PREP'
  | 'LIVE'
  | 'LIVE_FREE'
  | 'SUMMARY'
  | 'HISTORY';

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
  const [fontsLoaded] = useFonts({
    Petrona_700Bold,
    Manrope_800ExtraBold,
  });
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('SPLIT_SELECT');

  // Split choisi (Étape 1)
  const [selectedWorkout, setSelectedWorkout] = useState<{ id: number; name: string } | null>(null);

  // Configuration de la séance guidée
  const [activeSessionConfig, setActiveSessionConfig] = useState<SessionConfig | null>(null);

  // Données du bilan
  const [lastSummaryData, setLastSummaryData] = useState<WorkoutSummaryData | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        await configureAppAudio();
        await configureNotifications();
      } catch (e) {
        console.error('Erreur init database / audio:', e);
      } finally {
        setIsDbReady(true);
      }
    }
    setup();
  }, []);

  // Gestion du bouton retour physique / geste Android pour naviguer entre les écrans
  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'MODE_SELECT') {
        setCurrentScreen('SPLIT_SELECT');
        return true;
      }
      if (currentScreen === 'PREP') {
        setCurrentScreen('MODE_SELECT');
        return true;
      }
      if (currentScreen === 'LIVE' || currentScreen === 'LIVE_FREE') {
        Alert.alert(
          'Quitter la séance ?',
          'La séance en cours sera interrompue.',
          [
            { text: 'Continuer', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: handleResetToHome },
          ]
        );
        return true;
      }
      if (currentScreen === 'SUMMARY' || currentScreen === 'HISTORY') {
        handleResetToHome();
        return true;
      }
      // Sur 'SPLIT_SELECT', retour au comportement OS par défaut (quitte l'app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [currentScreen]);

  if (!isDbReady || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.accent} />
        <Text style={styles.loadingText}>mooscles initialisation...</Text>
        <StatusBar style={THEME.statusBarStyle} />
      </View>
    );
  }

  // Étape 1 : Sélection du Split (Push / Pull / Legs)
  const handleSelectSplit = (wId: number, wName: string) => {
    setSelectedWorkout({ id: wId, name: wName });
    setCurrentScreen('MODE_SELECT');
  };

  // Reprise rapide depuis le bandeau "Reprendre" : va directement à la préparation
  // de la séance guidée (mode le plus courant pour relancer un programme déjà fait),
  // les charges proposées reflètent déjà la progression calculée après la dernière séance.
  const handleResumeWorkout = (wId: number, wName: string) => {
    setSelectedWorkout({ id: wId, name: wName });
    setCurrentScreen('PREP');
  };

  // Étape 2 : Sélection du Mode (Guidé vs Libre)
  const handleSelectMode = (mode: 'GUIDED' | 'FREE') => {
    if (mode === 'GUIDED') {
      setCurrentScreen('PREP');
    } else {
      setCurrentScreen('LIVE_FREE');
    }
  };

  // Démarrage séance guidée
  const handleStartGuidedSession = (config: SessionConfig) => {
    setActiveSessionConfig(config);
    setCurrentScreen('LIVE');
  };

  // Fin de séance (Guidée ou Libre)
  const handleFinishSession = (summary: WorkoutSummaryData) => {
    setLastSummaryData(summary);
    setCurrentScreen('SUMMARY');
  };

  // Quitter ou réinitialiser
  const handleResetToHome = () => {
    setActiveSessionConfig(null);
    setSelectedWorkout(null);
    setCurrentScreen('SPLIT_SELECT');
  };

  return (
    <SafeAreaProvider>
      <View style={styles.appContainer}>
        <StatusBar style={THEME.statusBarStyle} />

        {/* ÉTAPE 1 : CHOIX DU SPLIT (PUSH / PULL / LEGS) */}
        {currentScreen === 'SPLIT_SELECT' && (
          <SplitSelectScreen
            onSelectWorkout={handleSelectSplit}
            onResumeWorkout={handleResumeWorkout}
            onOpenHistory={() => setCurrentScreen('HISTORY')}
          />
        )}

        {/* ÉTAPE 2 : CHOIX DU MODE (GUIDÉ VS LIBRE) */}
        {currentScreen === 'MODE_SELECT' && selectedWorkout && (
          <WorkoutModeSelectScreen
            workoutId={selectedWorkout.id}
            workoutName={selectedWorkout.name}
            onSelectMode={handleSelectMode}
            onBack={() => setCurrentScreen('SPLIT_SELECT')}
          />
        )}

        {/* ÉTAPE 3A : PRÉPARATION SÉANCE GUIDÉE */}
        {currentScreen === 'PREP' && selectedWorkout && (
          <SessionPrepScreen
            workoutId={selectedWorkout.id}
            workoutName={selectedWorkout.name}
            onStartSession={handleStartGuidedSession}
            onOpenHistory={() => setCurrentScreen('HISTORY')}
            onBack={() => setCurrentScreen('MODE_SELECT')}
          />
        )}

        {/* SÉANCE GUIDÉE EN DIRECT */}
        {currentScreen === 'LIVE' && activeSessionConfig && (
          <LiveWorkoutScreen
            sessionConfig={activeSessionConfig}
            onFinishSession={handleFinishSession}
            onQuitSession={handleResetToHome}
          />
        )}

        {/* ÉTAPE 3B : SÉANCE LIBRE EN DIRECT */}
        {currentScreen === 'LIVE_FREE' && selectedWorkout && (
          <FreeWorkoutScreen
            workoutId={selectedWorkout.id}
            workoutName={selectedWorkout.name}
            onFinishSession={handleFinishSession}
            onQuitSession={handleResetToHome}
          />
        )}

        {/* BILAN DE SÉANCE */}
        {currentScreen === 'SUMMARY' && lastSummaryData && (
          <WorkoutSummaryScreen
            summary={lastSummaryData}
            onClose={() => {
              setLastSummaryData(null);
              handleResetToHome();
            }}
          />
        )}

        {/* HISTORIQUE */}
        {currentScreen === 'HISTORY' && (
          <HistoryScreen onBack={handleResetToHome} />
        )}
      </View>
    </SafeAreaProvider>
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
