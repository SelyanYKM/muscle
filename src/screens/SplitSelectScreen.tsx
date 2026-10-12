import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { DashboardSheet } from '../components/DashboardSheet';
import { clearAllWorkoutLogs, getDashboardSummary, getWorkouts } from '../database/db';
import { THEME } from '../theme';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface SplitSelectScreenProps {
  onSelectWorkout: (workoutId: number, workoutName: string) => void;
  onOpenHistory: () => void;
}

export const SplitSelectScreen: React.FC<SplitSelectScreenProps> = ({
  onSelectWorkout,
  onOpenHistory,
}) => {
  const workouts = getWorkouts();
  const dashboardSummary = getDashboardSummary();

  const handleSelect = (wId: number, wName: string) => {
    triggerMediumHaptic();
    onSelectWorkout(wId, wName);
  };

  const getSplitDetails = (id: number) => {
    if (id === 1) {
      return {
        letter: 'P',
        subtitle: 'Pectoraux • Épaules • Triceps',
        focus: 'Poussée & Développés',
        exercisesCount: '5 exos cibles',
        gradient: ['#F4C3AE', '#E28B72'] as [string, string],
      };
    } else if (id === 2) {
      return {
        letter: 'P',
        subtitle: 'Dos • Arrière d’épaules • Biceps',
        focus: 'Tirages & Épaisseur',
        exercisesCount: '5 exos cibles',
        gradient: ['#E8D3F5', '#C080E0'] as [string, string],
      };
    } else {
      return {
        letter: 'L',
        subtitle: 'Quadriceps • Ischios • Mollets',
        focus: 'Force & Volume bas du corps',
        exercisesCount: '5 exos cibles',
        gradient: ['#DCE9F2', '#8FB9D0'] as [string, string],
      };
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* En-tête officiel mooscles */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/mooscles_logo.jpg')}
              style={styles.brandLogo}
            />
            <View>
              <Text style={styles.brandTitle}>
                mooscles<Text style={styles.brandDot}>.</Text>
              </Text>
              <Text style={styles.brandSubtitle}>Surcharge progressive PPL</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => {
              triggerLightHaptic();
              onOpenHistory();
            }}
            onLongPress={() => {
              triggerWarningHaptic();
              Alert.alert(
                "Effacer l'historique ?",
                "Toutes les séances enregistrées seront définitivement supprimées.",
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Tout effacer',
                    style: 'destructive',
                    onPress: () => {
                      clearAllWorkoutLogs();
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.historyBtnText}>Historique</Text>
          </TouchableOpacity>
        </View>

        {/* Titre de sélection */}
        <View style={styles.stepTitleBox}>
          <Text style={styles.stepHeading}>Choisis ton split</Text>
          <Text style={styles.stepSubheading}>Quelle séance attaques-tu aujourd'hui ?</Text>
        </View>

        {/* 3 Cartes de Split P/P/L */}
        <View style={styles.cardsContainer}>
          {workouts.map((w) => {
            const details = getSplitDetails(w.id);

            return (
              <TouchableOpacity
                key={w.id}
                style={styles.splitCard}
                onPress={() => handleSelect(w.id, w.name)}
                activeOpacity={0.85}
              >
                {/* Badge lettre majuscule P / P / L */}
                <LinearGradient
                  colors={details.gradient}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.letterBadge}
                >
                  <Text style={styles.letterBadgeText}>{details.letter}</Text>
                </LinearGradient>

                {/* Détails du split */}
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>{w.name}</Text>
                    <Text style={styles.chevron}>→</Text>
                  </View>

                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {details.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      </SafeAreaView>

      <DashboardSheet summary={dashboardSummary} />
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
    paddingHorizontal: 16,
    paddingTop: 24,
    // Marge basse suffisante pour que la dernière carte ne soit jamais cachée par la
    // feuille "Ton progrès" repliée (voir PEEK_HEIGHT dans DashboardSheet.tsx).
    paddingBottom: 160,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandDot: {
    color: THEME.colors.accent,
  },
  brandSubtitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  historyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  historyBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitleBox: {
    marginBottom: 14,
  },
  stepHeading: {
    fontFamily: THEME.fonts.serif,
    fontSize: 23,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  stepSubheading: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  cardsContainer: {
    gap: 10,
  },
  splitCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  letterBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBadgeText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  chevron: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.accent,
  },
  cardSubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
});
