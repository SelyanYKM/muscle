import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { THEME } from '../theme';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

interface WorkoutModeSelectScreenProps {
  workoutId: number;
  workoutName: string;
  onSelectMode: (mode: 'GUIDED' | 'FREE') => void;
  onBack: () => void;
}

export const WorkoutModeSelectScreen: React.FC<WorkoutModeSelectScreenProps> = ({
  workoutId,
  workoutName,
  onSelectMode,
  onBack,
}) => {
  const handlePickMode = (mode: 'GUIDED' | 'FREE') => {
    triggerMediumHaptic();
    onSelectMode(mode);
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
        {/* Bouton retour vers choix de split */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              triggerLightHaptic();
              onBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>← Changer de split</Text>
          </TouchableOpacity>

          <View style={styles.workoutBadge}>
            <Text style={styles.workoutBadgeText}>{workoutName.toUpperCase()}</Text>
          </View>
        </View>

        {/* Titre Étape 2 */}
        <View style={styles.stepTitleBox}>
          <Text style={styles.stepNumberBadge}>ÉTAPE 2 SUR 2</Text>
          <Text style={styles.stepHeading}>Mode de séance</Text>
          <Text style={styles.stepSubheading}>Comment souhaites-tu t'entraîner aujourd'hui ?</Text>
        </View>

        {/* Cartes Mode Guidé vs Mode Libre */}
        <View style={styles.cardsList}>
          {/* CARTE 1 : MODE GUIDÉ */}
          <TouchableOpacity
            style={[styles.modeCard, styles.guidedCard]}
            onPress={() => handlePickMode('GUIDED')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={styles.modeIconCircle}>
                <Text style={styles.modeIcon}>🎯</Text>
              </View>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>RECOMMANDÉ</Text>
              </View>
            </View>

            <Text style={styles.modeTitle}>Mode Guidé</Text>
            <Text style={styles.modeDesc}>
              Séance planifiée avec ordre d'exercices calibré, chronomètres automatiques et calcul de surcharge progressive à la fin.
            </Text>

            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Surcharge calculée</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Chrono calibré</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Ordre pré-établi</Text>
              </View>
            </View>

            <View style={styles.cardCta}>
              <Text style={styles.ctaTextGuided}>Sélectionner & Ajuster →</Text>
            </View>
          </TouchableOpacity>

          {/* CARTE 2 : MODE LIBRE */}
          <TouchableOpacity
            style={[styles.modeCard, styles.freeCard]}
            onPress={() => handlePickMode('FREE')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={styles.modeIconCircle}>
                <Text style={styles.modeIcon}>⚡</Text>
              </View>
              <View style={[styles.pillBadge, styles.freePillBadge]}>
                <Text style={[styles.pillBadgeText, styles.freePillBadgeText]}>FLEXIBILITÉ</Text>
              </View>
            </View>

            <Text style={styles.modeTitle}>Mode Libre</Text>
            <Text style={styles.modeDesc}>
              Saisie en direct à la sensation. Choisis tes exercices et renseigne tes charges et répétitions à la volée selon les machines libres.
            </Text>

            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Choix à la volée</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Saisie en début de série</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>Enregistré en historique</Text>
              </View>
            </View>

            <View style={styles.cardCta}>
              <Text style={styles.ctaTextFree}>Démarrer en direct →</Text>
            </View>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  backBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  workoutBadge: {
    backgroundColor: THEME.colors.badgeBg,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  workoutBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.accentStrong,
    letterSpacing: 0.8,
  },
  stepTitleBox: {
    marginBottom: 20,
  },
  stepNumberBadge: {
    fontFamily: THEME.fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accent,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  stepHeading: {
    fontFamily: THEME.fonts.serif,
    fontSize: 27,
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
  cardsList: {
    gap: 16,
  },
  modeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(28, 28, 30, 0.08)',
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  guidedCard: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  freeCard: {
    borderColor: 'rgba(28, 28, 30, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: THEME.colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  modeIcon: {
    fontSize: 20,
  },
  pillBadge: {
    backgroundColor: 'rgba(226, 139, 114, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(226, 139, 114, 0.4)',
  },
  pillBadgeText: {
    color: THEME.colors.accentDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  freePillBadge: {
    backgroundColor: THEME.colors.badgeBg,
    borderColor: 'transparent',
  },
  freePillBadgeText: {
    color: THEME.colors.badgeText,
  },
  modeTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  modeDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    marginBottom: 14,
  },
  featuresRow: {
    gap: 6,
    marginBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardInner,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureBullet: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.colors.accent,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  cardCta: {
    alignItems: 'flex-end',
  },
  ctaTextGuided: {
    color: THEME.colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  ctaTextFree: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
});
