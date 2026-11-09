import React, { useEffect, useRef, useState } from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  DashboardSummary,
  deleteBodyWeightEntry,
  ExerciseDetail,
  formatLocalDate,
  getBodyWeightLogs,
  getExerciseDetail,
  saveBodyWeightEntry,
  setWeeklyGoal,
  WatchItem,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
} from '../database/db';
import { THEME } from '../theme';
import { BodyWeightEntry } from '../types';
import { pickBodyWeightPhoto } from '../utils/bodyPhoto';
import { fmtKg, parseLocalDate } from '../utils/format';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';
import { CalendarWeek, daysBetween, exerciseKey, ExerciseTrend, fanSelection, TopSet } from '../utils/progressStats';
import { ExerciseDetailSheet, SessionMarks } from './ExerciseDetailSheet';
import { LineChart } from './LineChart';
import { Barbell, FluidBarbell, RecordStairs, RestartFan } from './ProgressCharts';
import {
  EnergySparkline,
  ProgressionBlocks,
  RecoveryGauges,
  splitName,
  TrainingCalendar,
  TrendSquare,
  weekStripA11y,
} from './ProgressWidgets';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { showDialog } from '../utils/dialog';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 108;
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.82);
const COLLAPSED_TRANSLATE = EXPANDED_HEIGHT - PEEK_HEIGHT;
// Poids de corps masqué au lot 8 (le code reste en place, prêt à revenir).
const SHOW_BODY_WEIGHT = false;


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

/** "22,5 kg × 8", ou "12 reps" au poids du corps. */
function fmtTopSet(t: TopSet): string {
  return t.weight > 0 ? `${fmtKg(t.weight)} kg × ${t.reps}` : `${t.reps} reps`;
}

function topSetA11y(t: TopSet): string {
  return t.weight > 0 ? `${fmtKg(t.weight)} kilos, ${t.reps} répétitions` : `${t.reps} répétitions`;
}

const TREND_LABEL: Record<ExerciseTrend['trend'], string> = { up: 'en hausse', flat: 'stable', down: 'en baisse' };

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

/** Message sous le compte de la semaine : la barre à charger, puis l'invitation au repos. */
function weekMessage(done: number, goal: number): string {
  if (done < goal) {
    const left = goal - done;
    return `Encore ${left === 1 ? 'une séance' : `${left} séances`} pour charger la barre.`;
  }
  if (done === goal) return 'Barre chargée. Place au repos.';
  const over = done - goal;
  return `${over === 1 ? 'Une' : over} de plus que prévu. Pense au repos.`;
}

/** Splits de la semaine dans l'ordre où ils ont été faits (un disque chacun). */
function weekSessions(week: CalendarWeek | undefined): number[] {
  return week ? week.days.flatMap((d) => d.workoutIds) : [];
}

/** Haut du tiroir : la semaine, en barre qu'on charge séance après séance. */
const WeekHero: React.FC<{ week: CalendarWeek | undefined; goal: number; streak: number; onSetGoal: () => void }> = ({
  week,
  goal,
  streak,
  onSetGoal,
}) => {
  const sessions = weekSessions(week);
  const done = sessions.length;
  const message = weekMessage(done, goal);
  const label = week
    ? `Semaine du ${parseLocalDate(week.weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : 'Cette semaine';
  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>{label}</Text>
        <TouchableOpacity
          onPress={onSetGoal}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Régler l’objectif de la semaine, actuellement ${goal} séance${goal > 1 ? 's' : ''}`}
        >
          <Text style={styles.linkText}>Régler</Text>
        </TouchableOpacity>
      </View>
      <View
        accessible
        accessibilityLabel={`${done} séance${done > 1 ? 's' : ''} sur ${goal}${sessions.length > 0 ? ` : ${sessions.map(splitName).join(', ')}` : ''}. ${message}`}
      >
        <Text style={styles.heroValue}>
          {done}
          <Text style={styles.heroGoal}>/{goal} séances</Text>
        </Text>
        <Text style={styles.heroMessage}>{message}</Text>
        <View style={styles.heroBar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <FluidBarbell sessions={sessions} goal={goal} height={96} />
        </View>
      </View>
      {streak > 0 && (
        <View style={styles.streakChip} accessible accessibilityLabel={`${streak} semaine${streak > 1 ? 's' : ''} de suite à l’objectif`}>
          <View style={styles.streakDisc}>
            <Text style={styles.streakDiscText}>{streak}</Text>
          </View>
          <Text style={styles.streakText}>{streak > 1 ? 'semaines de suite à l’objectif' : 'semaine à l’objectif'}</Text>
        </View>
      )}
    </View>
  );
};

/** Pastille d'un point « à surveiller » sans séances à montrer (« 16 j »). */
const WatchChip: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.watchChip}>
    <Icon name="clock" size={12} color={THEME.colors.textPrimary} strokeWidth={2.4} />
    <Text style={styles.watchChipText}>{text}</Text>
  </View>
);

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
  const [isProgressionOpen, setIsProgressionOpen] = useState(false);
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);

  const openDetail = (exerciseName: string) => {
    triggerLightHaptic();
    setDetail(getExerciseDetail(exerciseName));
  };

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
      showDialog('Poids invalide', 'Renseigne un poids valide.');
      return;
    }
    triggerMediumHaptic();
    const date = formatLocalDate(new Date());
    saveBodyWeightEntry(date, weight, newWeightPhotoUri);
    setBodyWeightLogs(getBodyWeightLogs());
    setIsAddWeightOpen(false);
  };

  const confirmDeleteWeightEntry = (entry: BodyWeightEntry) => {
    showDialog(
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

  const contentOpacity = translateY.interpolate({
    inputRange: [COLLAPSED_TRANSLATE - 80, COLLAPSED_TRANSLATE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, COLLAPSED_TRANSLATE],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  const currentWeek = summary.calendar[summary.calendar.length - 1];
  const goal = summary.weeklyGoal;
  const lastRest = formatRestDay(summary.lastRestDate);
  const { up, flat, down } = summary.progression;
  const today = formatLocalDate(new Date());
  // Début commun des escaliers : la toute première marche des records affichés.
  const recordsStart = summary.records.reduce((min, r) => (r.steps[0] && r.steps[0].date < min ? r.steps[0].date : min), today);
  const watchCount = summary.watch.length;
  const detailWatch = detail ? summary.watch.find((w) => w.exerciseName && exerciseKey(w.exerciseName) === exerciseKey(detail.exerciseName)) : undefined;
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
              accessibilityLabel={`Ton progrès. Cette semaine : ${summary.thisWeekCount} séance${summary.thisWeekCount > 1 ? 's' : ''} sur ${goal}. ${currentWeek ? weekStripA11y(currentWeek) : ''}${summary.recordsBeaten > 0 ? ` ${summary.recordsBeaten} record${summary.recordsBeaten > 1 ? 's' : ''} battu${summary.recordsBeaten > 1 ? 's' : ''} en 4 semaines.` : ''}${watchCount > 0 ? ` ${watchCount} point${watchCount > 1 ? 's' : ''} à surveiller.` : ''}`}
              accessibilityHint="Déplie le tableau de bord"
              accessibilityState={{ expanded: false }}
            >
              <View style={styles.peekTopRow}>
                <Text style={styles.peekLabel}>TON PROGRÈS</Text>
                <View style={styles.peekChips}>
                  {summary.recordsBeaten > 0 && (
                    <View style={styles.recordChip}>
                      <View style={styles.recordChipDisc} />
                      <Text style={styles.recordChipText}>
                        {summary.recordsBeaten} record{summary.recordsBeaten > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {watchCount > 0 && (
                    <View style={styles.watchCount}>
                      <View style={styles.watchCountBadge}>
                        <Text style={styles.watchCountBadgeText}>{watchCount}</Text>
                      </View>
                      <Text style={styles.watchCountText}>à surveiller</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.peekRow}>
                <Text style={styles.peekValue}>
                  {summary.thisWeekCount}
                  <Text style={styles.peekGoal}>/{goal} séances</Text>
                </Text>
                <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Barbell sessions={weekSessions(currentWeek)} goal={goal} width={168} height={38} mini />
                </View>
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

        {/* Le contenu s'efface quand le tiroir se replie : sinon son premier titre dépassait
            sous la semaine en cours. */}
        <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
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
          {/* LA SEMAINE : la barre qu'on charge séance après séance */}
          <WeekHero week={currentWeek} goal={goal} streak={summary.goalStreakWeeks} onSetGoal={() => setIsGoalOpen(true)} />

          {/* RECORDS : chaque ligne ouvre la fiche de l'exercice ; l'escalier n'est qu'un aperçu */}
          {summary.records.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, styles.sectionGap]}>
                <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">RECORDS</Text>
                {summary.recordsBeaten > 0 && (
                  <Text style={styles.headerAside}>
                    <Text style={styles.headerAsideCount}>{summary.recordsBeaten}</Text> battu{summary.recordsBeaten > 1 ? 's' : ''} en 4 sem.
                  </Text>
                )}
              </View>
              <View style={styles.recordList}>
                {summary.records.map((r, idx) => (
                  <TouchableOpacity
                    key={r.exerciseName}
                    style={[styles.recordRow, idx > 0 && styles.prRowDivider]}
                    onPress={() => openDetail(r.exerciseName)}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.exerciseName} : record de ${fmtKg(r.maxWeight)} kilos${r.delta !== null ? `, battu de ${fmtKg(r.delta)} kilos ces 4 dernières semaines` : ''}, ${r.steps.length} palier${r.steps.length > 1 ? 's' : ''} depuis la reprise`}
                    accessibilityHint="Ouvre la fiche de l’exercice"
                  >
                    <View style={styles.recordMain}>
                      <View style={styles.recordTop}>
                        <Text style={styles.prName} numberOfLines={1}>
                          {r.exerciseName}
                        </Text>
                        {r.delta !== null && (
                          <View style={styles.prDeltaPill}>
                            <Text style={styles.prDeltaText}>+{fmtKg(r.delta)}</Text>
                          </View>
                        )}
                        <Text style={styles.recordValue}>
                          {fmtKg(r.maxWeight)}
                          <Text style={styles.recordUnit}> kg</Text>
                        </Text>
                      </View>
                      <RecordStairs steps={r.steps} start={recordsStart} today={today} windowStart={summary.recordsWindowStart} />
                    </View>
                    <View style={styles.chevronBox}>
                      <Icon name="chevron-right" size={16} color={THEME.colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.stairsLegend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Text style={styles.stairsLegendText}>reprise</Text>
                <Text style={styles.stairsLegendText}>4 dernières sem.</Text>
              </View>
            </>
          )}

          {/* À SURVEILLER : ce que la prochaine séance peut déclencher, pauses, muscles délaissés */}
          {watchCount > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, styles.sectionGap]}>
                <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">À SURVEILLER</Text>
                <Text style={styles.headerAside}>
                  <Text style={styles.headerAsideCount}>{watchCount}</Text> point{watchCount > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.watchList}>
                {summary.watch.map((w: WatchItem, idx) => {
                  const content = (
                    <View style={styles.watchMain}>
                      <Text style={styles.watchTitle} numberOfLines={1}>
                        {w.title}
                      </Text>
                      <View style={styles.watchDetailRow}>
                        {w.kind === 'deload' ? <SessionMarks sessions={w.sessions} /> : w.chip ? <WatchChip text={w.chip} /> : null}
                        <Text style={styles.watchDetail}>{w.text}</Text>
                      </View>
                    </View>
                  );
                  const label = `${w.title}${w.chip ? `, ${w.chip.replace(' j', ' jours')}` : ''} : ${w.text}`;
                  return w.exerciseName ? (
                    <TouchableOpacity
                      key={`${w.kind}${w.title}`}
                      style={[styles.watchRow, idx > 0 && styles.prRowDivider]}
                      onPress={() => openDetail(w.exerciseName!)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityHint="Ouvre la fiche de l’exercice"
                    >
                      {content}
                      <View style={styles.chevronBox}>
                        <Icon name="chevron-right" size={16} color={THEME.colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View key={`${w.kind}${w.title}`} style={[styles.watchRow, idx > 0 && styles.prRowDivider]} accessible accessibilityLabel={label}>
                      {content}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* DEPUIS TA REPRISE : l'éventail */}
          {summary.restart && (
            <>
              <View style={[styles.sectionHeaderRow, styles.sectionGap]}>
                <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">DEPUIS TA REPRISE</Text>
                {summary.restart.averagePercent !== null && (
                  <Text style={styles.headerAside}>
                    moyenne{' '}
                    <Text style={styles.headerAsideCount}>
                      {summary.restart.averagePercent >= 0 ? '+' : '−'}
                      {Math.abs(Math.round(summary.restart.averagePercent))}{'\u202F'}%
                    </Text>
                  </Text>
                )}
              </View>
              <RestartFan items={fanSelection(summary.restart.items)} restartDateISO={summary.restart.date} />
            </>
          )}

          <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
            <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">EXERCICES EN PROGRESSION · 4 SEM.</Text>
            {up + flat + down > 0 && (
              <TouchableOpacity
                onPress={() => setIsProgressionOpen(true)}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Détail des exercices en progression"
              >
                <Text style={styles.bwAddLink}>Détail</Text>
              </TouchableOpacity>
            )}
          </View>
          {up + flat + down > 0 ? (
            <ProgressionBlocks up={up} flat={flat} down={down} onPress={() => setIsProgressionOpen(true)} />
          ) : (
            <Text style={styles.hintText}>Il faut au moins deux séances d’un exercice pour voir sa tendance.</Text>
          )}

          {/* MUSCLES : séries de la semaine en cours par groupe du programme */}
          {summary.muscleSets.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, styles.sectionGap]} accessibilityRole="header">MUSCLES CETTE SEMAINE · SÉRIES</Text>
              {(() => {
                const maxSets = Math.max(1, ...summary.muscleSets.map((m) => m.sets));
                return summary.muscleSets.map((m) => (
                  <View key={m.muscleGroup} style={styles.groupRow} accessible accessibilityLabel={`${m.label} : ${m.sets} série${m.sets > 1 ? 's' : ''} cette semaine`}>
                    <Text style={styles.groupLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <View style={styles.groupTrack}>
                      {m.sets > 0 && <View style={[styles.groupFill, { width: `${(m.sets / maxSets) * 100}%` }]} />}
                    </View>
                    <Text style={[styles.groupValue, m.sets === 0 && styles.groupValueZero]}>
                      {m.sets} série{m.sets > 1 ? 's' : ''}
                    </Text>
                  </View>
                ));
              })()}
            </>
          )}

          {/* RÉGULARITÉ : les 8 dernières semaines */}
          <View style={[styles.sectionHeaderRow, styles.sectionGap]}>
            <Text style={[styles.sectionLabel, styles.noMargin]} accessibilityRole="header">TES 8 DERNIÈRES SEMAINES</Text>
            {summary.avgSessionsPerWeek !== null && (
              <Text style={styles.headerAside} accessibilityLabel={`${fmtDec(summary.avgSessionsPerWeek)} séances par semaine en moyenne`}>
                <Text style={styles.headerAsideCount}>{fmtDec(summary.avgSessionsPerWeek)}</Text> séances / sem.
              </Text>
            )}
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

          {/* Poids de corps (optionnellement accompagné d'une photo), masqué depuis le lot 8 */}
          {SHOW_BODY_WEIGHT && (
          <View style={styles.sectionGap}>
            <View style={styles.bwHeaderRow}>
              <Text style={styles.sectionLabel} accessibilityRole="header">POIDS DE CORPS</Text>
              <TouchableOpacity
                style={styles.bwAddBtn}
                onPress={openAddWeightSheet}
                activeOpacity={0.8}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une pesée"
              >
                <Icon name="plus" size={13} color={THEME.colors.accentStrong} strokeWidth={2.4} />
                <Text style={styles.bwAddLink}>Ajouter</Text>
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
          )}

        </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* FEUILLE : FICHE D'UN EXERCICE (depuis un record ou un point à surveiller) */}
      <BottomSheet visible={detail !== null} onClose={() => setDetail(null)} maxHeightPercent={90}>
        {detail && <ExerciseDetailSheet detail={detail} watch={detailWatch} onClose={() => setDetail(null)} />}
      </BottomSheet>

      {/* FEUILLE : DÉTAIL DES EXERCICES EN PROGRESSION */}
      <BottomSheet visible={isProgressionOpen} onClose={() => setIsProgressionOpen(false)}>
        <Text style={styles.bwSheetTitle} accessibilityRole="header">Exercices sur 4 semaines</Text>
        <Text style={styles.bwSheetSubtitle}>Série la plus lourde de la dernière séance, comparée à celle d’il y a 4 semaines.</Text>
        <ScrollView style={styles.progressionList} showsVerticalScrollIndicator={false}>
          {summary.progression.items.map((it, idx) => (
            <View
              key={it.exerciseName}
              style={[styles.progressionRow, idx > 0 && styles.prRowDivider]}
              accessible
              accessibilityLabel={`${it.exerciseName}, ${TREND_LABEL[it.trend]} : ${topSetA11y(it.from)} le ${formatWeekLabel(it.from.date)}, puis ${topSetA11y(it.to)} le ${formatWeekLabel(it.to.date)}`}
            >
              <TrendSquare trend={it.trend} />
              <View style={styles.progressionTextCol}>
                <Text style={styles.progressionName} numberOfLines={1}>
                  {it.exerciseName}
                </Text>
                <Text style={styles.progressionDetail}>
                  {fmtTopSet(it.from)} ({formatShortDate(it.from.date)}) → {fmtTopSet(it.to)} ({formatShortDate(it.to.date)})
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.bwSaveBtn} onPress={() => setIsProgressionOpen(false)} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.bwSaveBtnText}>Fermer</Text>
        </TouchableOpacity>
      </BottomSheet>

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
  peekTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  peekChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.accent,
  },
  recordChipDisc: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.accentBright,
    borderWidth: 1.5,
    borderColor: '#E2AE00',
  },
  recordChipText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.accentTextDark,
  },
  watchCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  watchCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: THEME.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchCountBadgeText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 10,
    color: '#FFFFFF',
  },
  watchCountText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  // La semaine (barre)
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  linkText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.accentStrong,
  },
  heroValue: {
    marginTop: 4,
    fontFamily: THEME.fonts.serif,
    fontSize: 44,
    lineHeight: 50,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  heroGoal: {
    fontSize: 20,
    color: THEME.colors.textSecondary,
  },
  heroMessage: {
    marginTop: 2,
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  heroBar: {
    marginTop: 12,
    marginBottom: 10,
    marginHorizontal: -4,
  },
  streakChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    backgroundColor: '#FFFFFF',
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  streakDisc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.accent,
    borderWidth: 1,
    borderColor: '#E2AE00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDiscText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 14,
    lineHeight: 18,
    color: THEME.colors.textPrimary,
    includeFontPadding: false,
  },
  streakText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  // Records (escaliers)
  recordList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingLeft: 14,
    paddingRight: 6,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 11,
    paddingBottom: 10,
    minHeight: 64,
  },
  recordMain: {
    flex: 1,
    gap: 6,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordValue: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    lineHeight: 24,
    color: THEME.colors.textPrimary,
  },
  recordUnit: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  chevronBox: {
    width: 26,
    alignItems: 'center',
  },
  stairsLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingLeft: 14,
    paddingRight: 40,
  },
  stairsLegendText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  // À surveiller
  watchList: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.card,
    paddingLeft: 14,
    paddingRight: 6,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 11,
    minHeight: 56,
  },
  watchMain: {
    flex: 1,
  },
  watchTitle: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  watchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginTop: 5,
  },
  watchDetail: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  watchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
    backgroundColor: '#FFFFFF',
  },
  watchChipText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
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
    width: 58,
    textAlign: 'right',
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 12,
    color: THEME.colors.accentStrong,
  },
  groupValueZero: {
    color: THEME.colors.textMuted,
  },
  // Feuille détail des exercices
  progressionList: {
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 8,
  },
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  progressionTextCol: {
    flex: 1,
  },
  progressionName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  progressionDetail: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
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
  bwAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
