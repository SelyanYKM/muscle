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
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
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
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  backBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  workoutBadge: {
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  workoutBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.colors.accent,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#8C7060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  guidedCard: {
    borderColor: THEME.colors.accent,
    backgroundColor: '#FFFDFB',
  },
  freeCard: {
    borderColor: THEME.colors.cardBorder,
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
    borderRadius: 10,
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
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
  },
  pillBadgeText: {
    color: THEME.colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  freePillBadge: {
    backgroundColor: THEME.colors.cardInner,
    borderColor: THEME.colors.cardBorder,
  },
  freePillBadgeText: {
    color: THEME.colors.textSecondary,
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
