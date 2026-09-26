import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Petrona_600SemiBold } from '@expo-google-fonts/petrona';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAppMetadata, getExercisesForRelaunch, initDatabase, setAppMetadata } from './src/database/db';
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
import {
  configureRestTimerChannel,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  requestRestTimerPermission,
} from './src/utils/restTimerService';

const BATTERY_TIP_METADATA_KEY = 'battery_optimization_tip_shown';
// Clé distincte (et affichée même chez les personnes ayant déjà vu le conseil batterie) :
// c'est un réglage Android différent, découvert après coup comme cause du "ça sonne parfois,
// avec du retard" (throttling Doze faute d'alarme exacte autorisée).
const EXACT_ALARM_TIP_METADATA_KEY = 'exact_alarm_tip_shown_v2';

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
    Petrona_600SemiBold,
    Manrope_700Bold,
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
        await configureRestTimerChannel();
        // Demandée ici, avant tout écran en <Modal> (le minuteur de repos inclus) :
        // le popup système Android pour autoriser les notifications peut ne jamais
        // s'afficher correctement s'il est demandé pendant qu'une Modal RN est ouverte.
        await requestRestTimerPermission();
      } catch (e) {
        console.error('Erreur init database / audio:', e);
      } finally {
        setIsDbReady(true);
      }
    }
    setup();
  }, []);

  // Conseils ponctuels (une seule fois chacun, au premier lancement où ils n'ont pas encore
  // été vus) : deux réglages Android distincts qui limitent la fiabilité du minuteur en
  // arrière-plan. La batterie ("optimisation") peut carrément empêcher l'alerte de sonner ;
  // les alarmes exactes, si non autorisées, ne l'empêchent pas mais la retardent et la
  // regroupent avec d'autres alarmes (mode Doze) — exactement le "ça sonne parfois, avec du
  // retard" observé. Affichés l'un après l'autre pour ne pas les superposer.
  useEffect(() => {
    if (!isDbReady || Platform.OS !== 'android') return;

    async function showReliabilityTips() {
      if (getAppMetadata(BATTERY_TIP_METADATA_KEY) !== '1') {
        setAppMetadata(BATTERY_TIP_METADATA_KEY, '1');
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Minuteur fiable en arrière-plan',
            "Pour que l'alerte de fin de repos sonne même écran verrouillé ou app fermée, autorise mooscles à ignorer l'optimisation de la batterie dans les réglages Android.",
            [
              { text: 'Plus tard', style: 'cancel', onPress: () => resolve() },
              {
                text: 'Ouvrir les réglages',
                onPress: () => {
                  openBatteryOptimizationSettings();
                  resolve();
                },
              },
            ],
            { onDismiss: () => resolve() }
          );
        });
      }

      if (getAppMetadata(EXACT_ALARM_TIP_METADATA_KEY) !== '1') {
        setAppMetadata(EXACT_ALARM_TIP_METADATA_KEY, '1');
        Alert.alert(
          'Alarmes exactes',
          "Pour que le minuteur sonne pile à l'heure (et pas avec quelques minutes de retard) une fois l'app quittée, autorise aussi mooscles à programmer des alarmes exactes.",
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => openExactAlarmSettings() },
          ]
        );
      }
    }

    showReliabilityTips();
  }, [isDbReady]);

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

  // Reprise rapide depuis le bandeau "Reprendre" (accueil) ou "Relancer" (historique) :
  // reconstruit directement une séance guidée avec les MÊMES exercices que la séance reprise,
  // mais avec les charges ACTUELLES (déjà progressées) — et saute directement dans la séance en
  // direct, sans repasser par l'écran de préparation/reconfiguration.
  const handleRelaunchWorkout = (wId: number, wName: string, exerciseIds: number[]) => {
    const configuredExercises = getExercisesForRelaunch(wId, exerciseIds);

    if (configuredExercises.length === 0) {
      // Repli si aucun de ces exercices n'existe plus dans le catalogue : flux normal.
      setSelectedWorkout({ id: wId, name: wName });
      setCurrentScreen('MODE_SELECT');
      return;
    }

    setSelectedWorkout({ id: wId, name: wName });
    setActiveSessionConfig({
      workoutId: wId,
      workoutName: wName,
      standardRestSeconds: 90,
      finisherRestSeconds: 180,
      configuredExercises,
    });
    setCurrentScreen('LIVE');
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
            onResumeWorkout={handleRelaunchWorkout}
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
          <HistoryScreen onBack={handleResetToHome} onRelaunchSession={handleRelaunchWorkout} />
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
