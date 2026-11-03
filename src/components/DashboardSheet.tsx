import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { File } from 'expo-file-system';
import {
  DashboardSummary,
  deleteBodyWeightEntry,
  formatLocalDate,
  getBodyWeightLogs,
  saveBodyWeightEntry,
  setWeeklyGoal,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
} from '../database/db';
import { THEME } from '../theme';
import { BodyWeightEntry } from '../types';
import { pickBodyWeightPhoto } from '../utils/bodyPhoto';
import { fmtKg, parseLocalDate } from '../utils/format';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { daysBetween } from '../utils/progressStats';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { EnergySparkline, GoalRing, ProgressionBlocks, RecoveryGauges, TrainingCalendar, WeekStrip, weekStripA11y } from './ProgressWidgets';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 108;
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.82);
const COLLAPSED_TRANSLATE = EXPANDED_HEIGHT - PEEK_HEIGHT;


interface DashboardSheetProps {
  summary: DashboardSummary;
  /** Prévient l'écran parent quand le tiroir s'ouvre ou se ferme (pour masquer ce qu'il y a
   * derrière au lecteur d'écran pendant que le tiroir est déplié). */
  onExpandedChange?: (expanded: boolean) => void;
  /** Un réglage du tiroir a changé (objectif de la semaine) : l'écran parent recalcule `summary`. */
  onDataChange?: () => void;
}

/** "27/10" : version courte pour l'axe des graphiques. */
function formatShortDate(dateISO: string): string {
  try {
    const d = parseLocalDate(dateISO);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return dateISO;
  }
}

function formatWeekLabel(weekStartISO: string): string {
  try {
    return parseLocalDate(weekStartISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return weekStartISO;
  }
}

/** Arrondi au dixième, pour les poids calculés (bornes d'axe, écarts) : 0,1 + 0,2 ≠ 0,3. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** "4 520" : séparateur de milliers français. */
function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('fr-FR');
}

/** "3,6" : une décimale, virgule française. */
function fmtDec(v: number): string {
  return (Math.round(v * 10) / 10).toLocaleString('fr-FR');
}

/** Dernier jour de repos : "hier", "mer." cette semaine, sinon "21/10" (et sa version lue). */
function formatRestDay(dateISO: string | null): { short: string; long: string } {
  if (!dateISO) return { short: '—', long: 'aucun' };
  const ago = daysBetween(dateISO, formatLocalDate(new Date()));
  const d = parseLocalDate(dateISO);
  if (ago <= 1) return { short: 'hier', long: 'hier' };
  if (ago <= 6) {
    return {
      short: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      long: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
    };
  }
  return { short: formatShortDate(dateISO), long: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) };
}

export const DashboardSheet: React.FC<DashboardSheetProps> = ({ summary, onExpandedChange, onDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE)).current;
  const isExpandedRef = useRef(false);
  const dragStartRef = useRef(0);

  // Suivi du poids de corps : chargé une fois au montage, indépendant de `summary` (recalculé à
  // chaque ouverture du split-select — pas besoin d'y mêler ce qui n'en fait pas partie).
  const [bodyWeightLogs, setBodyWeightLogs] = useState<BodyWeightEntry[]>([]);
  const [isAddWeightOpen, setIsAddWeightOpen] = useState(false);
  const [newWeightText, setNewWeightText] = useState('');
  const [newWeightPhotoUri, setNewWeightPhotoUri] = useState<string | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isGoalOpen, setIsGoalOpen] = useState(false);

  const changeGoal = (step: number) => {
    const next = Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, summary.weeklyGoal + step));
    if (next === summary.weeklyGoal) return;
    triggerLightHaptic();
    setWeeklyGoal(next);
    onDataChange?.();
  };

  useEffect(() => {
    setBodyWeightLogs(getBodyWeightLogs());
  }, []);

  const openAddWeightSheet = () => {
    triggerLightHaptic();
    const lastEntry = bodyWeightLogs[bodyWeightLogs.length - 1];
    setNewWeightText(lastEntry ? fmtKg(lastEntry.weight) : '');
    setNewWeightPhotoUri(null);
    setIsAddWeightOpen(true);
  };

  const handlePickWeightPhoto = async (source: 'camera' | 'library') => {
    if (isPickingPhoto) return;
    setIsPickingPhoto(true);
    try {
      const uri = await pickBodyWeightPhoto(source, formatLocalDate(new Date()));
      if (uri) setNewWeightPhotoUri(uri);
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleSaveWeight = () => {
    const weight = parseFloat(newWeightText.replace(',', '.'));
    if (!weight || weight <= 0) {
      Alert.alert('Poids invalide', 'Renseigne un poids valide.');
      return;
    }
    triggerMediumHaptic();
    const date = formatLocalDate(new Date());
    saveBodyWeightEntry(date, weight, newWeightPhotoUri);
    setBodyWeightLogs(getBodyWeightLogs());
    setIsAddWeightOpen(false);
  };

  const confirmDeleteWeightEntry = (entry: BodyWeightEntry) => {
    Alert.alert(
      'Supprimer cette pesée ?',
      `La pesée du ${formatWeekLabel(entry.date)} (${fmtKg(entry.weight)} kg) sera supprimée${entry.photoUri ? ', photo comprise' : ''}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            triggerLightHaptic();
            deleteBodyWeightEntry(entry.date);
            if (entry.photoUri) {
              try {
                new File(entry.photoUri).delete();
              } catch (error) {
                console.error('Erreur suppression photo poids de corps:', error);
              }
            }
            setBodyWeightLogs(getBodyWeightLogs());
          },
        },
      ]
    );
  };

  const snapTo = (expand: boolean) => {
    triggerLightHaptic();
    isExpandedRef.current = expand;
    setIsExpanded(expand);
    onExpandedChange?.(expand);
    Animated.spring(translateY, {
      toValue: expand ? 0 : COLLAPSED_TRANSLATE,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        dragStartRef.current = isExpandedRef.current ? 0 : COLLAPSED_TRANSLATE;
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(COLLAPSED_TRANSLATE, Math.max(0, dragStartRef.current + g.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const current = dragStartRef.current + g.dy;
        const shouldExpand = current < COLLAPSED_TRANSLATE / 2 || g.vy < -0.5;
        snapTo(g.vy > 0.5 ? false : shouldExpand);
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, COLLAPSED_TRANSLATE],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  const volumeChartData = summary.weeklyStats.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    axisLabel: formatShortDate(w.weekStart),
    value: w.totalVolume,
  }));
  const currentWeek = summary.calendar[summary.calendar.length - 1];
  const goal = summary.weeklyGoal;
  const lastRest = formatRestDay(summary.lastRestDate);
  const { up, flat, down } = summary.progression;
  const volumeTrend = summary.volumeTrendPercent;
  const bodyWeightChartData = bodyWeightLogs.map((e) => ({
    label: formatWeekLabel(e.date),
    axisLabel: formatShortDate(e.date),
    value: e.weight,
  }));
  // Légende de la dernière pesée : l'écart depuis la première pesée affichée.
  const bodyWeightCaption = (() => {
    if (bodyWeightLogs.length < 2) return 'dernière pesée';
    const first = bodyWeightLogs[0];
    const delta = round1(bodyWeightLogs[bodyWeightLogs.length - 1].weight - first.weight);
    const since = `depuis le ${formatShortDate(first.date)}`;
    if (delta === 0) return `stable ${since}`;
    return `${delta > 0 ? '+' : '−'}${fmtKg(Math.abs(delta))} kg ${since}`;
  })();

  return (
    <>
      {/* Fond assombri derrière la feuille, uniquement cliquable (pour refermer) une fois dépliée */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => snapTo(false)}
          accessible={false}
          importantForAccessibility="no"
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { height: EXPANDED_HEIGHT, transform: [{ translateY }] }]}
        accessibilityViewIsModal={isExpanded}
      >
        {/* Zone de poignée : seule cette zone capte le glissement, pour ne pas gêner le scroll/tap du contenu */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handleBar} />

          {!isExpanded ? (
            <TouchableOpacity
              onPress={() => snapTo(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Ton progrès. Cette semaine : ${summary.thisWeekCount} séance${summary.thisWeekCount > 1 ? 's' : ''} sur ${goal}. ${currentWeek ? weekStripA11y(currentWeek) : ''}`}
              accessibilityHint="Déplie le tableau de bord"
              accessibilityState={{ expanded: false }}
            >
              <Text style={styles.peekLabel}>TON PROGRÈS · CETTE SEMAINE</Text>
              <View style={styles.peekRow}>
                <Text style={styles.peekValue}>
                  {summary.thisWeekCount}
                  <Text style={styles.peekGoal}>/{goal} séances</Text>
                </Text>
                {currentWeek && <WeekStrip week={currentWeek} />}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.expandedHeaderRow}>
              <Text style={styles.sheetTitle} accessibilityRole="header">Ton progrès</Text>
              <TouchableOpacity
                style={styles.reduceBtn}
                onPress={() => snapTo(false)}
                activeOpacity={0.8}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Réduire le tableau de bord"
                accessibilityState={{ expanded: true }}
              >
                <Icon name="chevron-down" size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.closeHint}>Réduire</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          scrollEnabled={isExpanded}
          showsVerticalScrollIndicator={false}
          // Replié, le contenu est seulement décalé hors écran : on le retire de l'arbre
          // d'accessibilité pour que TalkBack ne s'y promène pas à l'aveugle.
          importantForAccessibility={isExpanded ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!isExpanded}
        >
          {/* RÉGULARITÉ : objectif de la semaine + calendrier des 8 dernières semaines */}
          <Text style={styles.sectionLabel} accessibilityRole="header">RÉGULARITÉ · CETTE SEMAINE</Text>
          <View style={styles.goalRow}>
            <GoalRing done={summary.thisWeekCount} goal={goal} onPress={() => setIsGoalOpen(true)} />
            <View style={styles.kpiCol}>
              <View
                style={styles.kpiRow}
                accessible
                accessibilityLabel={`${summary.goalStreakWeeks} semaine${summary.goalStreakWeeks > 1 ? 's' : ''} de suite à l’objectif`}
              >
                <Text style={styles.kpiValue}>{summary.goalStreakWeeks}</Text>
                <Text style={styles.kpiLabel}>sem. de suite à l’objectif</Text>
              </View>
              {summary.avgSessionsPerWeek !== null && (
                <View style={styles.kpiRow} accessible accessibilityLabel={`${fmtDec(summary.avgSessionsPerWeek)} séances par semaine en moyenne`}>
                  <Text style={styles.kpiValue}>{fmtDec(summary.avgSessionsPerWeek)}</Text>
                  <Text style={styles.kpiLabel}>séances / sem. en moyenne</Text>
                </View>
              )}
            </View>
          </View>
          <TrainingCalendar weeks={summary.calendar} goal={goal} />

          {/* REPOS */}
          <Text style={[styles.sectionLabel, styles.sectionGap]} accessibilityRole="header">REPOS</Text>
          <View style={styles.tilesRow}>
            <View
              style={styles.tile}
              accessible
              accessibilityLabel={`${summary.consecutiveDays} jour${summary.consecutiveDays > 1 ? 's' : ''} d’entraînement d’affilée`}
            >
              <Text style={styles.tileValue}>{summary.consecutiveDays}</Text>
              <Text style={styles.tileLabel}>{summary.consecutiveDays > 1 ? 'JOURS' : 'JOUR'} D’AFFILÉE</Text>
            </View>
            <View style={styles.tile} accessible accessibilityLabel={`Dernier jour de repos : ${lastRest.long}`}>
              <Text style={styles.tileValue}>{lastRest.short}</Text>
              <Text style={styles.tileLabel}>DERNIER REPOS</Text>
            </View>
          </View>
          <Text style={styles.subLabel} accessibilityRole="header">RÉCUPÉRATION PAR SPLIT</Text>
          <RecoveryGauges recovery={summary.recovery} />
          <Text style={[styles.subLabel, { marginTop: 14 }]} accessibilityRole="header">
            ÉNERGIE AU BILAN · {summary.energy.length > 1 ? `${summary.energy.length} DERNIÈRES SÉANCES` : 'FIN DE SÉANCE'}
          </Text>
          {summary.energy.length >= 2 ? (
            <EnergySparkline values={summary.energy} trend={summary.energyTrend} />
          ) : (
            <Text style={styles.hintText}>Note ton énergie au bilan de fin de séance pour suivre ta forme ici.</Text>
          )}

          {/* PERF GLOBALE */}
          <View style={[styles.sectionHeaderRow, styles.sectionGap]}>
            <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">VOLUME PAR SEMAINE</Text>
            {volumeTrend !== null && (
              <View
                style={[styles.trendPill, volumeTrend < 0 && styles.trendPillDown]}
                accessible
                accessibilityLabel={`Volume des 4 dernières semaines : ${volumeTrend >= 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(volumeTrend)} % par rapport aux 4 précédentes`}
              >
                <Icon
                  name={volumeTrend >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={volumeTrend >= 0 ? THEME.colors.accentStrong : THEME.colors.textSecondary}
                  strokeWidth={2.6}
                />
                <Text style={[styles.trendPillText, volumeTrend < 0 && styles.trendPillTextDown]}>
                  {volumeTrend > 0 ? '+' : volumeTrend < 0 ? '−' : ''}
                  {Math.abs(volumeTrend)}{'\u202F'}% · 4 sem.
                </Text>
              </View>
            )}
          </View>
          <BarChart data={volumeChartData} formatValue={(v) => `${fmtInt(v)} kg`} lastCaption="semaine en cours" />

          <Text style={[styles.sectionLabel, { marginTop: 20 }]} accessibilityRole="header">EXERCICES EN PROGRESSION · 4 SEM.</Text>
          {up + flat + down > 0 ? (
            <ProgressionBlocks up={up} flat={flat} down={down} />
          ) : (
            <Text style={styles.hintText}>Il faut au moins deux séances d’un exercice pour voir sa tendance.</Text>
          )}

          {summary.records.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
                <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">RECORDS</Text>
                {summary.recordsBeaten > 0 && (
                  <Text style={styles.headerAside}>
                    <Text style={styles.headerAsideCount}>{summary.recordsBeaten}</Text> battu{summary.recordsBeaten > 1 ? 's' : ''} en 4 sem.
                  </Text>
                )}
              </View>
              <View style={styles.prList}>
                {summary.records.map((r, idx) => (
                  <View
                    key={r.exerciseName}
                    style={[styles.prRow, idx > 0 && styles.prRowDivider]}
                    accessible
                    accessibilityLabel={`${r.exerciseName} : ${fmtKg(r.maxWeight)} kilos${r.delta !== null ? `, record battu de ${fmtKg(r.delta)} kilos` : ''}`}
                  >
                    <Text style={styles.prName} numberOfLines={1}>
                      {r.exerciseName}
                    </Text>
                    {r.delta !== null && (
                      <View style={styles.prDeltaPill}>
                        <Text style={styles.prDeltaText}>+{fmtKg(r.delta)}</Text>
                      </View>
                    )}
                    <Text style={styles.prWeight}>{fmtKg(r.maxWeight)} kg</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Répartition du volume par groupe musculaire (4 dernières semaines), en lignes compactes */}
          {summary.volumeByMuscleGroup.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 22 }]} accessibilityRole="header">RÉPARTITION PAR GROUPE · 4 SEM.</Text>
              {(() => {
                const maxVolume = Math.max(1, ...summary.volumeByMuscleGroup.map((g) => g.volume));
                return summary.volumeByMuscleGroup.map((g) => (
                  <View key={g.muscleGroup} style={styles.groupRow} accessible accessibilityLabel={`${g.label} : ${fmtInt(g.volume)} kilos`}>
                    <Text style={styles.groupLabel} numberOfLines={1}>
                      {g.label}
                    </Text>
                    <View style={styles.groupTrack}>
                      <View style={[styles.groupFill, { width: `${Math.max(4, (g.volume / maxVolume) * 100)}%` }]} />
                    </View>
                    <Text style={styles.groupValue}>{fmtDec(g.volume / 1000)} t</Text>
                  </View>
                ));
              })()}
            </>
          )}

          {/* Poids de corps (optionnellement accompagné d'une photo) */}
          <View style={styles.sectionGap}>
            <View style={styles.bwHeaderRow}>
              <Text style={styles.sectionLabel} accessibilityRole="header">POIDS DE CORPS</Text>
              <TouchableOpacity
                onPress={openAddWeightSheet}
                activeOpacity={0.8}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une pesée"
              >
                <Text style={styles.bwAddLink}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {bodyWeightLogs.length === 0 ? (
              <Text style={styles.bwEmptyText}>Pas encore de pesée enregistrée.</Text>
            ) : (
              <>
                {/* Courbe à axe resserré : en barres partant de 0, quelques centaines de grammes
                    d'écart restaient invisibles. */}
                <LineChart
                  data={bodyWeightChartData}
                  padding={0.3}
                  formatValue={(v) => `${fmtKg(round1(v))} kg`}
                  formatAxis={(v) => fmtKg(round1(v))}
                  lastCaption={bodyWeightCaption}
                />
                {/* Dernières pesées : chacune supprimable (photo comprise), pas seulement
                    celles avec photo — sinon impossible de corriger une pesée sans photo. */}
                <View style={styles.bwEntriesList}>
                  {bodyWeightLogs
                    .slice(-8)
                    .reverse()
                    .map((e, idx) => (
                      <View key={e.date} style={[styles.bwEntryRow, idx > 0 && styles.bwEntryRowDivider]}>
                        {e.photoUri ? (
                          <Image source={{ uri: e.photoUri }} style={styles.bwEntryThumb} />
                        ) : (
                          <View style={styles.bwEntryThumb} />
                        )}
                        <View style={styles.bwEntryTextCol}>
                          <Text style={styles.bwEntryWeight}>{fmtKg(e.weight)} kg</Text>
                          <Text style={styles.bwEntryDate}>{formatWeekLabel(e.date)}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => confirmDeleteWeightEntry(e)}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                          activeOpacity={0.6}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer la pesée du ${formatWeekLabel(e.date)}, ${fmtKg(e.weight)} kilos`}
                        >
                          <Icon name="x" size={14} color={THEME.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              </>
            )}
          </View>

        </ScrollView>
      </Animated.View>

      {/* FEUILLE : OBJECTIF DE LA SEMAINE */}
      <BottomSheet visible={isGoalOpen} onClose={() => setIsGoalOpen(false)} maxHeightPercent={60}>
        <Text style={styles.bwSheetTitle} accessibilityRole="header">Objectif de la semaine</Text>
        <Text style={styles.bwSheetSubtitle}>Séances visées par semaine. Une fois atteint, l’accueil te conseille du repos.</Text>
        <View style={styles.goalStepper}>
          <TouchableOpacity
            style={[styles.goalStepBtn, goal <= WEEKLY_GOAL_MIN && styles.goalStepBtnDisabled]}
            onPress={() => changeGoal(-1)}
            disabled={goal <= WEEKLY_GOAL_MIN}
            activeOpacity={0.7}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text style={styles.goalStepBtnText}>−</Text>
          </TouchableOpacity>
          <View
            style={styles.goalValueBox}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Objectif de la semaine"
            accessibilityValue={{ text: `${goal} séance${goal > 1 ? 's' : ''}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => changeGoal(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          >
            <Text style={styles.goalValue}>{goal}</Text>
            <Text style={styles.goalValueUnit}>séance{goal > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={[styles.goalStepBtn, goal >= WEEKLY_GOAL_MAX && styles.goalStepBtnDisabled]}
            onPress={() => changeGoal(1)}
            disabled={goal >= WEEKLY_GOAL_MAX}
            activeOpacity={0.7}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text style={styles.goalStepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.bwSaveBtn} onPress={() => setIsGoalOpen(false)} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.bwSaveBtnText}>OK</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* FEUILLE : AJOUTER UNE PESÉE (poids du jour + photo optionnelle) */}
      <BottomSheet visible={isAddWeightOpen} onClose={() => setIsAddWeightOpen(false)} maxHeightPercent={65} avoidKeyboard>
        <Text style={styles.bwSheetTitle} accessibilityRole="header">Ajouter une pesée</Text>
        <Text style={styles.bwSheetSubtitle}>Aujourd'hui</Text>

        <Text style={styles.sectionLabel} accessibilityRole="header">POIDS (KG)</Text>
        <TextInput
          style={styles.bwWeightInput}
          value={newWeightText}
          onChangeText={setNewWeightText}
          keyboardType="decimal-pad"
          placeholder="72,5"
          placeholderTextColor={THEME.colors.textMuted}
          accessibilityLabel="Poids en kilos"
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]} accessibilityRole="header">PHOTO (OPTIONNEL)</Text>
        {newWeightPhotoUri ? (
          <View style={styles.bwPhotoPreviewRow}>
            <Image source={{ uri: newWeightPhotoUri }} style={styles.bwPhotoPreview} />
            <TouchableOpacity
              onPress={() => setNewWeightPhotoUri(null)}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Retirer la photo"
            >
              <Text style={styles.bwRemovePhotoText}>Retirer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bwPhotoBtnRow}>
            <TouchableOpacity
              style={styles.bwPhotoBtn}
              onPress={() => handlePickWeightPhoto('camera')}
              disabled={isPickingPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Prendre une photo"
              accessibilityState={{ disabled: isPickingPhoto, busy: isPickingPhoto }}
            >
              <Text style={styles.bwPhotoBtnText}>{isPickingPhoto ? '...' : 'Appareil photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bwPhotoBtn}
              onPress={() => handlePickWeightPhoto('library')}
              disabled={isPickingPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Choisir une photo dans la galerie"
              accessibilityState={{ disabled: isPickingPhoto, busy: isPickingPhoto }}
            >
              <Text style={styles.bwPhotoBtnText}>{isPickingPhoto ? '...' : 'Galerie'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.bwSaveBtn} onPress={handleSaveWeight} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.bwSaveBtnText}>Enregistrer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bwCancelBtn} onPress={() => setIsAddWeightOpen(false)} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.bwCancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.colors.shadow,
    zIndex: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Opaque : à 97 %, les cartes Push / Pull / Legs transparaissaient derrière les graphiques.
    backgroundColor: THEME.colors.cardBg,
    borderTopLeftRadius: THEME.radius.sheet,
    borderTopRightRadius: THEME.radius.sheet,
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    zIndex: 6,
  },
  handleArea: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 41, 107, 0.15)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  peekValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  peekGoal: {
    fontSize: 17,
    color: THEME.colors.textSecondary,
  },
  peekLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accentStrong,
    letterSpacing: 1,
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  reduceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.pill,
  },
  closeHint: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionGap: {
    marginTop: 26,
  },
  noMargin: {
    marginBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  hintText: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  // Régularité
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginBottom: 16,
  },
  kpiCol: {
    flex: 1,
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  kpiLabel: {
    flexShrink: 1,
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  // Repos
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    backgroundColor: THEME.colors.cardInner,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tileValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  tileLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    letterSpacing: 0.5,
    color: THEME.colors.textSecondary,
  },
  // Perf globale
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
    backgroundColor: '#DCE8F5',
  },
  trendPillDown: {
    backgroundColor: THEME.colors.cardInner,
  },
  trendPillText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accentStrong,
  },
  trendPillTextDown: {
    color: THEME.colors.textSecondary,
  },
  headerAside: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  headerAsideCount: {
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.textPrimary,
  },
  prDeltaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.accent,
    marginRight: 10,
  },
  prDeltaText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accentTextDark,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 26,
  },
  groupLabel: {
    width: 82,
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  groupTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.cardInner,
    overflow: 'hidden',
  },
  groupFill: {
    height: 8,
    borderRadius: 4,
    // Bleu acier plutôt qu'or : l'or pâle sur le rail clair passait sous 3:1.
    backgroundColor: THEME.colors.accentStrong,
  },
  groupValue: {
    width: 52,
    textAlign: 'right',
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.accentStrong,
  },
  // Feuille objectif
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginVertical: 18,
  },
  goalStepBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: THEME.colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStepBtnDisabled: {
    opacity: 0.35,
  },
  goalStepBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 24,
    lineHeight: 28,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  goalValueBox: {
    alignItems: 'center',
    minWidth: 90,
  },
  goalValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 44,
    lineHeight: 50,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  goalValueUnit: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  prList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  prRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  prName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  prWeight: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 15,
    color: THEME.colors.accentStrong,
  },
  bwHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bwAddLink: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.accentStrong,
  },
  bwEmptyText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  bwEntriesList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  bwEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  bwEntryRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  bwEntryThumb: {
    width: 34,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.cardBg,
  },
  bwEntryTextCol: {
    flex: 1,
  },
  bwEntryWeight: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  bwEntryDate: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  bwSheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  bwSheetSubtitle: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  bwWeightInput: {
    height: 52,
    backgroundColor: THEME.colors.bg,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.sans,
    fontSize: 16,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.inner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginTop: 6,
  },
  bwPhotoBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bwPhotoBtn: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.inner,
  },
  bwPhotoBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  bwPhotoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  bwPhotoPreview: {
    width: 64,
    height: 84,
    borderRadius: THEME.radius.inner,
    backgroundColor: THEME.colors.cardInner,
  },
  bwRemovePhotoText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.feelingHardText,
  },
  bwSaveBtn: {
    height: 54,
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  bwSaveBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: '#FFFFFF',
    fontSize: 14,
  },
  bwCancelBtn: {
    paddingVertical: 13,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  bwCancelBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
});
