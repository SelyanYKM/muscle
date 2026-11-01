import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../components/BottomSheet';
import { FeelingMark } from '../components/FeelingMark';
import { Icon } from '../components/Icon';
import { FEELING_BG, FEELING_INK, FEELING_LABEL, resolveFeelingLabel } from '../constants/feeling';
import {
  clearAllWorkoutLogs,
  countWorkoutSessions,
  deleteExerciseFromSession,
  deleteWorkoutSession,
  getAllSessionFeedback,
  getLogsForRecentSessions,
  insertExerciseLogsForSession,
  SessionFeedbackRow,
  updateWorkoutSessionType,
} from '../database/db';
import { THEME } from '../theme';
import { Feeling, WorkoutLogEntry } from '../types';
import { kgA11y, setA11yLabel } from '../utils/a11y';
import { exportBackupFile, importBackupFile } from '../utils/backup';
import { exportHistoryAsText } from '../utils/exportHistory';
import { fmtKg, parseLocalDate } from '../utils/format';
import { triggerLightHaptic, triggerMediumHaptic, triggerWarningHaptic } from '../utils/haptics';

interface HistoryScreenProps {
  onBack: () => void;
}

// Séances chargées par page : l'historique se lit par séances entières (jamais tronquées),
// "Voir plus" en ajoute une page à chaque fois.
const SESSIONS_PAGE_SIZE = 30;

interface GroupedExerciseLogs {
  exerciseName: string;
  sets: WorkoutLogEntry[];
}

interface GroupedSession {
  date: string;
  workoutId: number;
  workoutName: string;
  totalVolume: number;
  totalSets: number;
  exercises: GroupedExerciseLogs[];
}

interface MonthGroup {
  label: string;
  sessions: GroupedSession[];
}

// État d'édition "brouillon" d'une séance entière, construit à l'ouverture de la feuille unique
// de modification et persisté d'un bloc au clic sur "Enregistrer".
interface EditableSet {
  setNumber: number;
  weight: number;
  repsTarget: number;
  repsDone: number;
  feeling: Feeling;
  /** Hérité tel quel de la série chargée, tant que son ressenti n'est pas retouché via le
   * sélecteur (voir setEditingSetFeeling) — l'éditeur n'offre pas de coche dédiée pour
   * (re)confirmer "facile", donc un changement explicite de ressenti l'efface. */
  markedEasy?: boolean;
}
interface EditableExercise {
  originalName: string;
  name: string;
  sets: EditableSet[];
}
interface EditableSessionState {
  date: string;
  originalWorkoutId: number;
  workoutId: number;
  exercises: EditableExercise[];
  removedExerciseNames: string[];
}

function groupByMonth(sessions: GroupedSession[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const indexByLabel = new Map<string, number>();

  for (const session of sessions) {
    const [y, m] = session.date.split('-').map(Number);
    const label = new Date(y, m - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      .toUpperCase();

    if (!indexByLabel.has(label)) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, sessions: [] });
    }
    groups[indexByLabel.get(label)!].sessions.push(session);
  }

  return groups;
}

/**
 * Mini phrase bilan d'une séance, dérivée des ressentis déjà enregistrés (pas d'IA) : part de
 * ratée des séries, enrichie du ressenti de fin de séance (énergie, étirements) quand disponible.
 */
function buildSessionBilan(session: GroupedSession, feedback?: SessionFeedbackRow): string {
  const allSets = session.exercises.flatMap((e) => e.sets);
  if (allSets.length === 0) return '';

  const notMetCount = allSets.filter((s) => s.feeling !== 'EASY').length;
  const ratio = notMetCount / allSets.length;

  let perf: string;
  if (ratio === 0) perf = 'Séance solide, tout réussi';
  else if (ratio <= 0.25) perf = 'Bonne séance, presque tout réussi';
  else if (ratio <= 0.5) perf = 'Séance correcte, quelques séries sous l’objectif';
  else perf = 'Séance difficile, plusieurs séries sous l’objectif';

  const extras: string[] = [];
  if (feedback?.physicalFeeling != null) extras.push(`énergie ${feedback.physicalFeeling}/5`);
  if (feedback?.stretched) extras.push('étirements faits');
  if (feedback?.sharkAppeared) extras.push('🦈 le requin était là');

  return extras.length > 0 ? `${perf} · ${extras.join(' · ')}` : `${perf}.`;
}

// Flèche pivotante (200ms) pour le chevron de chaque séance : un Animated.Value par
// sessionKey, créé à la demande et conservé dans un ref pour survivre aux re-renders.
function useChevronAnim() {
  const animsRef = useRef<Map<string, Animated.Value>>(new Map());

  const get = (key: string, expanded: boolean) => {
    if (!animsRef.current.has(key)) {
      animsRef.current.set(key, new Animated.Value(expanded ? 1 : 0));
    }
    return animsRef.current.get(key)!;
  };

  const animateTo = (key: string, expanded: boolean) => {
    Animated.timing(get(key, expanded), {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return { get, animateTo };
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, SessionFeedbackRow>>({});
  const [expandedSessions, setExpandedSessions] = useState<{ [sessionKey: string]: boolean }>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const chevronAnim = useChevronAnim();

  // Édition unifiée d'une séance passée : programme + tous ses exercices/séries en un seul
  // endroit, plutôt que deux feuilles séparées avec un bouton "Modifier" différent chacune.
  const [editingSession, setEditingSession] = useState<EditableSessionState | null>(null);
  // Copie figée de la séance à l'ouverture de l'éditeur, pour savoir s'il y a des modifications
  // à ne pas perdre au moment de fermer.
  const editingSnapshotRef = useRef<string | null>(null);

  const [sessionLimit, setSessionLimit] = useState<number>(SESSIONS_PAGE_SIZE);
  const [totalSessionCount, setTotalSessionCount] = useState<number>(0);

  useEffect(() => {
    loadHierarchicalLogs();
  }, []);

  const loadHierarchicalLogs = (limit: number = sessionLimit, resetExpanded: boolean = true) => {
    const rawLogs = getLogsForRecentSessions(limit);
    setTotalSessionCount(countWorkoutSessions());

    const feedbackMap: Record<string, SessionFeedbackRow> = {};
    for (const f of getAllSessionFeedback()) {
      feedbackMap[`${f.date}_${f.workoutId}`] = f;
    }
    setFeedbackByKey(feedbackMap);

    const sessionMap = new Map<string, GroupedSession>();

    // getRecentLogs() renvoie les logs du plus récent au plus ancien (nécessaire pour ne garder
    // que les N derniers, tous séances confondues) ; on reparcourt ici en ordre chronologique
    // (ascendant) pour que les exercices et séries s'empilent déjà dans le bon ordre à
    // l'intérieur de chaque séance. Seul l'ordre des SÉANCES elles-mêmes doit rester
    // récent-en-premier : il se rétablit d'un coup en inversant la liste finale, plus bas.
    for (const log of [...rawLogs].reverse()) {
      const sessionKey = `${log.date}_${log.workoutId}`;
      const workoutName =
        log.workoutId === 1
          ? 'Push (Pecs / Épaules / Triceps)'
          : log.workoutId === 2
          ? 'Pull (Dos / Arrière d’épaules / Biceps)'
          : 'Legs (Quadriceps / Ischios / Mollets)';

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          date: log.date,
          workoutId: log.workoutId,
          workoutName,
          totalVolume: 0,
          totalSets: 0,
          exercises: [],
        });
      }

      const session = sessionMap.get(sessionKey)!;
      session.totalVolume += log.weight * log.repsDone;
      session.totalSets += 1;

      let exGroup = session.exercises.find((e) => e.exerciseName === log.exerciseName);
      if (!exGroup) {
        exGroup = {
          exerciseName: log.exerciseName,
          sets: [],
        };
        session.exercises.push(exGroup);
      }

      exGroup.sets.push(log);
    }

    // L'itération ci-dessus était chronologique, donc Map a inséré les séances de la plus
    // ancienne à la plus récente : on inverse pour retrouver la plus récente en tête.
    const sessionList = Array.from(sessionMap.values()).reverse();
    setSessions(sessionList);

    if (resetExpanded && sessionList.length > 0) {
      const firstKey = `${sessionList[0].date}_${sessionList[0].workoutId}`;
      setExpandedSessions({ [firstKey]: true });
    }
  };

  const loadMoreSessions = () => {
    triggerLightHaptic();
    const next = sessionLimit + SESSIONS_PAGE_SIZE;
    setSessionLimit(next);
    loadHierarchicalLogs(next, false);
  };

  const toggleSessionExpand = (sessionKey: string) => {
    triggerLightHaptic();
    setExpandedSessions((prev) => {
      const nextExpanded = !prev[sessionKey];
      chevronAnim.animateTo(sessionKey, nextExpanded);
      return { ...prev, [sessionKey]: nextExpanded };
    });
  };

  // Seul point d'entrée de l'effacement total (plus d'appui long caché) : propose de
  // sauvegarder d'abord, puisque rien ne permet de revenir en arrière ensuite.
  const promptClearHistory = () => {
    triggerWarningHaptic();
    Alert.alert(
      "Effacer tout l'historique ?",
      'Toutes les séances et performances enregistrées seront définitivement supprimées. Pense à faire une sauvegarde avant.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: "Sauvegarder d'abord", onPress: handleBackup },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: () => {
            clearAllWorkoutLogs();
            setSessions([]);
            setExpandedSessions({});
            setTotalSessionCount(0);
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (isExporting) return;
    triggerLightHaptic();
    setIsExporting(true);
    try {
      await exportHistoryAsText();
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackup = async () => {
    if (isBackingUp) return;
    triggerLightHaptic();
    setIsBackingUp(true);
    try {
      await exportBackupFile();
    } finally {
      setIsBackingUp(false);
    }
  };

  const confirmRestore = () => {
    triggerWarningHaptic();
    Alert.alert(
      'Restaurer une sauvegarde ?',
      'Toutes tes données actuelles (catalogue, historique, progression) seront remplacées par celles du fichier choisi. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Choisir un fichier', style: 'destructive', onPress: handleRestore },
      ]
    );
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const outcome = await importBackupFile();
      if (outcome === 'restored') {
        triggerMediumHaptic();
        loadHierarchicalLogs();
        Alert.alert('Restauration terminée', 'Tes données ont été remplacées par celles de la sauvegarde.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Ouvre la feuille d'édition unique d'une séance : copie "brouillon" locale (programme +
  // tous les exercices/séries), rien n'est écrit en base avant "Enregistrer les modifications".
  const openEditSessionModal = (session: GroupedSession) => {
    triggerLightHaptic();
    const initial: EditableSessionState = {
      date: session.date,
      originalWorkoutId: session.workoutId,
      workoutId: session.workoutId,
      exercises: session.exercises.map((ex) => ({
        originalName: ex.exerciseName,
        name: ex.exerciseName,
        sets: ex.sets.map((s, idx) => ({
          setNumber: idx + 1,
          weight: s.weight,
          repsTarget: s.repsTarget || 8,
          repsDone: s.repsDone,
          feeling: s.feeling as Feeling,
          markedEasy: s.markedEasy,
        })),
      })),
      removedExerciseNames: [],
    };
    editingSnapshotRef.current = JSON.stringify(initial);
    setEditingSession(initial);
  };

  // Fermeture de l'éditeur (bouton Fermer, tap sur le fond, geste retour) : demande confirmation
  // s'il y a des modifications non enregistrées, au lieu de les jeter sans prévenir.
  const requestCloseEditor = () => {
    if (editingSession && JSON.stringify(editingSession) !== editingSnapshotRef.current) {
      triggerWarningHaptic();
      Alert.alert('Abandonner les modifications ?', 'Tes changements sur cette séance ne seront pas enregistrés.', [
        { text: "Continuer l'édition", style: 'cancel' },
        { text: 'Abandonner', style: 'destructive', onPress: () => setEditingSession(null) },
      ]);
      return;
    }
    setEditingSession(null);
  };

  const updateEditingExerciseName = (exIdx: number, name: string) => {
    setEditingSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exIdx] = { ...exercises[exIdx], name };
      return { ...prev, exercises };
    });
  };

  // Mutation partagée d'une série en édition : les 3 handlers ci-dessous ne différaient que par
  // le champ patché, calculé à partir de la valeur courante de la série (lue dans l'updater,
  // jamais depuis une closure, pour rester correct même avec plusieurs taps rapprochés).
  const patchEditingSet = (exIdx: number, setIdx: number, patch: (current: EditableSet) => Partial<EditableSet>) => {
    setEditingSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      const sets = [...exercises[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], ...patch(sets[setIdx]) };
      exercises[exIdx] = { ...exercises[exIdx], sets };
      return { ...prev, exercises };
    });
  };

  const adjustEditingSetWeight = (exIdx: number, setIdx: number, delta: number) => {
    triggerLightHaptic();
    patchEditingSet(exIdx, setIdx, (s) => ({ weight: Math.max(0, Math.round((s.weight + delta) * 100) / 100) }));
  };

  const adjustEditingSetReps = (exIdx: number, setIdx: number, delta: number) => {
    triggerLightHaptic();
    patchEditingSet(exIdx, setIdx, (s) => ({ repsDone: Math.max(0, s.repsDone + delta) }));
  };

  const setEditingSetFeeling = (exIdx: number, setIdx: number, feeling: Feeling) => {
    triggerLightHaptic();
    // Un choix explicite dans le sélecteur écrase toujours markedEasy : l'éditeur n'a pas de
    // coche dédiée pour reconfirmer "facile", donc retoucher le ressenti d'une série ramène au
    // libellé générique ("Réussi"), même si elle était "Facile" au moment de la séance.
    patchEditingSet(exIdx, setIdx, () => ({ feeling, markedEasy: false }));
  };

  const addEditingSet = (exIdx: number) => {
    triggerLightHaptic();
    setEditingSession((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      const sets = exercises[exIdx].sets;
      const last = sets[sets.length - 1] || { weight: 40, repsTarget: 8, repsDone: 8, feeling: 'EASY' as Feeling };
      exercises[exIdx] = {
        ...exercises[exIdx],
        sets: [
          ...sets,
          { setNumber: sets.length + 1, weight: last.weight, repsTarget: last.repsTarget, repsDone: last.repsDone, feeling: last.feeling },
        ],
      };
      return { ...prev, exercises };
    });
  };

  const removeEditingSet = (exIdx: number, setIdx: number) => {
    triggerLightHaptic();
    setEditingSession((prev) => {
      if (!prev) return prev;
      if (prev.exercises[exIdx].sets.length <= 1) {
        Alert.alert('Action impossible', 'Un exercice doit comporter au moins 1 série.');
        return prev;
      }
      const exercises = [...prev.exercises];
      const sets = exercises[exIdx].sets.filter((_, idx) => idx !== setIdx).map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      exercises[exIdx] = { ...exercises[exIdx], sets };
      return { ...prev, exercises };
    });
  };

  const removeEditingExercise = (exIdx: number) => {
    const exerciseName = editingSession?.exercises[exIdx]?.name;
    if (!exerciseName) return;
    triggerWarningHaptic();

    Alert.alert(
      'Retirer cet exercice ?',
      `« ${exerciseName} » sera retiré de cette séance quand tu enregistreras les modifications.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            setEditingSession((prev) => {
              if (!prev) return prev;
              const removedName = prev.exercises[exIdx].originalName;
              return {
                ...prev,
                exercises: prev.exercises.filter((_, idx) => idx !== exIdx),
                removedExerciseNames: [...prev.removedExerciseNames, removedName],
              };
            });
          },
        },
      ]
    );
  };

  // Enregistre tout d'un coup : programme, puis séries de chaque exercice modifié/retiré.
  // Toutes les suppressions (par ancien nom) sont faites AVANT toute insertion (par nom final) :
  // si un exercice est renommé vers le nom d'origine d'un autre (modifié ou retiré), traiter
  // delete+insert exercice par exercice effacerait les lignes tout juste insérées pour le
  // premier dès que le second est traité — d'où cette passe en deux temps.
  const saveAllSessionChanges = () => {
    if (!editingSession) return;
    const { date, originalWorkoutId, workoutId, exercises, removedExerciseNames } = editingSession;

    if (exercises.some((ex) => !ex.name.trim())) {
      Alert.alert('Nom requis', 'Chaque exercice doit avoir un nom.');
      return;
    }
    triggerMediumHaptic();

    if (workoutId !== originalWorkoutId) {
      updateWorkoutSessionType(date, originalWorkoutId, workoutId);
    }
    for (const ex of exercises) {
      deleteExerciseFromSession(date, workoutId, ex.originalName);
    }
    for (const name of removedExerciseNames) {
      deleteExerciseFromSession(date, workoutId, name);
    }
    for (const ex of exercises) {
      insertExerciseLogsForSession(date, workoutId, ex.name.trim(), ex.sets);
    }

    setEditingSession(null);
    loadHierarchicalLogs();
  };

  const confirmDeleteSession = () => {
    if (!editingSession) return;
    triggerWarningHaptic();

    Alert.alert(
      'Supprimer cette séance ?',
      `La séance du ${formatDate(editingSession.date)} sera supprimée de l'historique.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteWorkoutSession(editingSession.date, editingSession.originalWorkoutId);
            setEditingSession(null);
            loadHierarchicalLogs();
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return parseLocalDate(dateStr).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // Date en toutes lettres pour le lecteur d'écran ("lundi 27 octobre" plutôt que "lun. 27 oct.").
  const formatDateA11y = (dateStr: string) => {
    try {
      return parseLocalDate(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  const monthGroups = groupByMonth(sessions);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[THEME.colors.bgGradientPeach, THEME.colors.bgGradientPink, THEME.colors.bgGradientSand]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête avec bouton Retour & Option Clear au clic long */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.8}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          accessibilityRole="button"
          accessibilityLabel="Retour à l'accueil"
        >
          <Icon name="arrow-left" size={18} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleWrapper}>
          <Text style={styles.title} accessibilityRole="header">Historique</Text>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={isExporting || sessions.length === 0}
          activeOpacity={0.8}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          accessibilityRole="button"
          accessibilityLabel="Exporter l'historique en texte"
          accessibilityState={{ disabled: isExporting || sessions.length === 0, busy: isExporting }}
        >
          <Text style={styles.exportButtonText}>{isExporting ? '...' : 'Exporter'}</Text>
        </TouchableOpacity>
      </View>

      {/* Sauvegarde complète : contrairement à "Exporter" (texte lisible, non réimportable),
          ce JSON couvre catalogue + historique + progression et peut être restauré plus tard —
          seule protection contre la perte du téléphone, l'app n'a pas de synchro cloud. */}
      <View style={styles.backupRow}>
        <Text style={styles.backupLabel}>SAUVEGARDE COMPLÈTE</Text>
        <View style={styles.backupBtnRow}>
          <TouchableOpacity
            style={styles.backupBtn}
            onPress={handleBackup}
            disabled={isBackingUp}
            activeOpacity={0.8}
            hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityLabel="Sauvegarder toutes les données"
            accessibilityState={{ disabled: isBackingUp, busy: isBackingUp }}
          >
            <Text style={styles.backupBtnText}>{isBackingUp ? '...' : 'Sauvegarder'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backupBtn}
            onPress={confirmRestore}
            disabled={isRestoring}
            activeOpacity={0.8}
            hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityLabel="Restaurer une sauvegarde"
            accessibilityState={{ disabled: isRestoring, busy: isRestoring }}
          >
            <Text style={styles.backupBtnText}>{isRestoring ? '...' : 'Restaurer'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune séance enregistrée.</Text>
          <Text style={styles.emptySubtext}>
            Complète ton premier entraînement pour voir tes charges évoluer !
          </Text>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {monthGroups.map((group) => {
            const monthVolume = group.sessions.reduce((acc, s) => acc + s.totalVolume, 0);

            return (
              <View key={group.label} style={{ gap: 10 }}>
                <View style={styles.monthHeaderRow}>
                  <Text style={styles.monthLabel} accessibilityRole="header">{group.label}</Text>
                  <Text style={styles.monthSummary}>
                    {group.sessions.length} séance{group.sessions.length > 1 ? 's' : ''} · {Math.round(monthVolume).toLocaleString('fr-FR')} kg
                  </Text>
                </View>

                <View style={styles.monthContainer}>
                  {group.sessions.map((session, sIdx) => {
                    const sessionKey = `${session.date}_${session.workoutId}`;
                    const isExpanded = !!expandedSessions[sessionKey];
                    const split = THEME.splits[session.workoutId];
                    const bilan = buildSessionBilan(session, feedbackByKey[sessionKey]);
                    const rotation = chevronAnim.get(sessionKey, isExpanded).interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    });

                    return (
                      <View key={sIdx} style={[styles.sessionRow, sIdx > 0 && styles.sessionRowDivider]}>
                        <View style={styles.sessionHeader}>
                          <TouchableOpacity
                            style={styles.sessionHeaderTappable}
                            onPress={() => toggleSessionExpand(sessionKey)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`${formatDateA11y(session.date)}, ${session.workoutName.split(' (')[0]}. ${session.exercises.length} exercices, ${session.totalSets} séries, ${Math.round(session.totalVolume).toLocaleString('fr-FR')} kilos.${bilan ? ` ${bilan}` : ''}`}
                            accessibilityHint={isExpanded ? 'Masque le détail' : 'Affiche le détail'}
                            accessibilityState={{ expanded: isExpanded }}
                          >
                            <LinearGradient
                              colors={split.gradient}
                              start={{ x: 0.1, y: 0 }}
                              end={{ x: 0.9, y: 1 }}
                              style={styles.letterBadge}
                            >
                              <Text style={[styles.letterBadgeText, { color: split.fg }]}>
                                {session.workoutName.charAt(0)}
                              </Text>
                            </LinearGradient>

                            <View style={styles.sessionHeaderLeft}>
                              <Text style={styles.dateText}>{formatDate(session.date)}</Text>
                              <Text style={styles.sessionWorkoutTitle} numberOfLines={1}>
                                {session.workoutName.split(' (')[0]}
                              </Text>
                              <Text style={styles.sessionMetricsSummary}>
                                {session.exercises.length} exos · {session.totalSets} séries ·{' '}
                                <Text style={styles.volumeHighlight}>{Math.round(session.totalVolume).toLocaleString('fr-FR')} kg</Text>
                              </Text>
                              {!!bilan && (
                                <Text style={styles.sessionBilanText} numberOfLines={2}>
                                  {bilan}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.editSessionBtn}
                            onPress={() => openEditSessionModal(session)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifier la séance du ${formatDateA11y(session.date)}`}
                          >
                            <Text style={styles.editSessionBtnText}>Modifier</Text>
                          </TouchableOpacity>

                          {/* Doublon visuel de l'en-tête (qui déplie déjà la séance) : masqué au lecteur d'écran. */}
                          <TouchableOpacity
                            onPress={() => toggleSessionExpand(sessionKey)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                            accessible={false}
                            importantForAccessibility="no-hide-descendants"
                          >
                            <Animated.View style={[styles.chevronCircle, { transform: [{ rotate: rotation }] }]}>
                              <Icon name="chevron-down" size={16} color={THEME.colors.textSecondary} />
                            </Animated.View>
                          </TouchableOpacity>
                        </View>

                        {/* Contenu détaillé (lecture seule — "Modifier" ouvre la feuille unique) */}
                        {isExpanded && (
                          <View style={styles.sessionDetailsBox}>
                            {session.exercises.map((ex, exIdx) => (
                              <View key={exIdx} style={styles.exerciseDetailRow}>
                                <Text style={styles.exerciseDetailName}>{ex.exerciseName}</Text>
                                <View style={styles.setsChipsRow}>
                                  {ex.sets.map((set, setIdx) => (
                                    <View
                                      key={setIdx}
                                      style={styles.setChip}
                                      accessible
                                      accessibilityLabel={setA11yLabel(set.setNumber, set.repsDone, set.weight, set.feeling as Feeling, set.markedEasy)}
                                    >
                                      <FeelingMark feeling={set.feeling as Feeling} />
                                      <Text style={styles.setChipText}>
                                        S{set.setNumber} · {set.repsDone} × {fmtKg(set.weight)}kg ·{' '}
                                        {resolveFeelingLabel(set.feeling as Feeling, set.markedEasy)}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {sessions.length < totalSessionCount && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMoreSessions}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.loadMoreBtnText}>
                Voir plus de séances ({totalSessionCount - sessions.length} restante
                {totalSessionCount - sessions.length > 1 ? 's' : ''})
              </Text>
            </TouchableOpacity>
          )}

          {/* Légende des pastilles */}
          <View style={styles.legendRow}>
            {(['EASY', 'MEDIUM', 'HARD'] as Feeling[]).map((f) => (
              <View key={f} style={styles.legendItem}>
                <FeelingMark feeling={f} size={8} />
                <Text style={styles.legendText}>{FEELING_LABEL[f]}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.clearHistoryBtn}
            onPress={promptClearHistory}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.clearHistoryBtnText}>Effacer tout l'historique</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FEUILLE UNIQUE : MODIFIER LA SÉANCE — programme, tous les exercices et toutes les
          séries d'un coup (remplace les deux feuilles séparées d'avant, chacune avec son
          propre bouton "Modifier"). */}
      <BottomSheet visible={!!editingSession} onClose={requestCloseEditor} maxHeightPercent={88}>
        <Text style={styles.sheetTitle} accessibilityRole="header">Modifier la séance</Text>
        <Text style={styles.sheetSubtitle}>
          Séance du {editingSession ? formatDate(editingSession.date) : ''}
        </Text>

        <ScrollView style={styles.sessionEditScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.inputSectionLabel}>PROGRAMME ASSOCIÉ</Text>
          <View style={styles.programToggleRow} accessibilityRole="radiogroup" accessibilityLabel="Programme associé">
            {[{ id: 1, label: 'Push' }, { id: 2, label: 'Pull' }, { id: 3, label: 'Legs' }].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.programBtn, editingSession?.workoutId === p.id && styles.programBtnActive]}
                onPress={() => setEditingSession((prev) => (prev ? { ...prev, workoutId: p.id } : prev))}
                activeOpacity={0.8}
                hitSlop={{ top: 3, bottom: 3 }}
                accessibilityRole="radio"
                accessibilityLabel={p.label}
                accessibilityState={{ checked: editingSession?.workoutId === p.id }}
              >
                <Text style={[styles.programBtnText, editingSession?.workoutId === p.id && styles.programBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {editingSession?.exercises.map((ex, exIdx) => (
            <View key={exIdx} style={styles.exEditCard}>
              <View style={styles.exEditHeaderRow}>
                <TextInput
                  style={styles.exNameInput}
                  value={ex.name}
                  onChangeText={(text) => updateEditingExerciseName(exIdx, text)}
                  placeholderTextColor={THEME.colors.textMuted}
                  accessibilityLabel={`Nom de l'exercice ${exIdx + 1}`}
                />
                <TouchableOpacity
                  onPress={() => removeEditingExercise(exIdx)}
                  hitSlop={{ top: 14, bottom: 14, left: 6, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer l'exercice ${ex.name} de la séance`}
                >
                  <Text style={styles.deleteSetLink}>Retirer</Text>
                </TouchableOpacity>
              </View>

              {ex.sets.map((s, setIdx) => (
                <View key={setIdx} style={styles.setEditCard}>
                  <View style={styles.setEditTop}>
                    <Text style={styles.setNumberBadge}>Série {s.setNumber}</Text>
                    {ex.sets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeEditingSet(exIdx, setIdx)}
                        hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer la série ${s.setNumber}`}
                      >
                        <Text style={styles.deleteSetLink}>Retirer</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.steppersRow}>
                    <View style={styles.stepperBlock}>
                      <Text style={styles.stepperLabel}>POIDS</Text>
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => adjustEditingSetWeight(exIdx, setIdx, -2.5)}
                          hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Retirer 2,5 kilos à la série ${s.setNumber}`}
                        >
                          <Text style={styles.stepBtnText}>−2,5</Text>
                        </TouchableOpacity>
                        <Text
                          style={styles.stepValText}
                          accessibilityRole="adjustable"
                          accessibilityLabel={`Poids de la série ${s.setNumber}`}
                          accessibilityValue={{ text: kgA11y(s.weight) }}
                          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                          onAccessibilityAction={(e) =>
                            adjustEditingSetWeight(exIdx, setIdx, e.nativeEvent.actionName === 'increment' ? 2.5 : -2.5)
                          }
                        >
                          {fmtKg(s.weight)}kg
                        </Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => adjustEditingSetWeight(exIdx, setIdx, 2.5)}
                          hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Ajouter 2,5 kilos à la série ${s.setNumber}`}
                        >
                          <Text style={styles.stepBtnText}>+2,5</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.stepperBlock}>
                      <Text style={styles.stepperLabel}>REPS</Text>
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => adjustEditingSetReps(exIdx, setIdx, -1)}
                          hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Retirer une rep à la série ${s.setNumber}`}
                        >
                          <Text style={styles.stepBtnText}>−1</Text>
                        </TouchableOpacity>
                        <Text
                          style={styles.stepValText}
                          accessibilityRole="adjustable"
                          accessibilityLabel={`Reps de la série ${s.setNumber}`}
                          accessibilityValue={{ text: `${s.repsDone} reps` }}
                          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                          onAccessibilityAction={(e) =>
                            adjustEditingSetReps(exIdx, setIdx, e.nativeEvent.actionName === 'increment' ? 1 : -1)
                          }
                        >
                          {s.repsDone}
                        </Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => adjustEditingSetReps(exIdx, setIdx, 1)}
                          hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Ajouter une rep à la série ${s.setNumber}`}
                        >
                          <Text style={styles.stepBtnText}>+1</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.feelingRow} accessibilityRole="radiogroup" accessibilityLabel={`Ressenti de la série ${s.setNumber}`}>
                    {(['EASY', 'MEDIUM', 'HARD'] as Feeling[]).map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.feelBtn, s.feeling === f && { backgroundColor: FEELING_BG[f] }]}
                        onPress={() => setEditingSetFeeling(exIdx, setIdx, f)}
                        hitSlop={{ top: 7, bottom: 7 }}
                        accessibilityRole="radio"
                        accessibilityLabel={FEELING_LABEL[f]}
                        accessibilityState={{ checked: s.feeling === f }}
                      >
                        <FeelingMark feeling={f} />
                        <Text style={[styles.feelBtnText, s.feeling === f && { color: FEELING_INK[f] }]}>
                          {FEELING_LABEL[f]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addEditingSet(exIdx)}
                activeOpacity={0.8}
                hitSlop={{ top: 4, bottom: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter une série à ${ex.name}`}
              >
                <Text style={styles.addSetBtnText}>+ Ajouter une série</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveAllSessionChanges} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Enregistrer les modifications</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.destructiveBtn} onPress={confirmDeleteSession} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.destructiveBtnText}>Supprimer cette séance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineBtn} onPress={requestCloseEditor} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.outlineBtnText}>Fermer</Text>
        </TouchableOpacity>
      </BottomSheet>
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
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  backupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: THEME.radius.inner,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  backupLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
  },
  backupBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backupBtn: {
    height: 30,
    justifyContent: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.pill,
  },
  backupBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.accentStrong,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 28,
    color: THEME.colors.textPrimary,
  },
  exportButton: {
    height: 40,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 16,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  exportButtonText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
  },
  monthLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  monthSummary: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  monthContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: THEME.radius.card,
  },
  sessionRow: {},
  sessionRowDivider: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  sessionHeaderTappable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  editSessionBtn: {
    height: 34,
    justifyContent: 'center',
    backgroundColor: THEME.colors.cardInner,
    paddingHorizontal: 13,
    borderRadius: THEME.radius.pill,
  },
  editSessionBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.accentStrong,
  },
  letterBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBadgeText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
  },
  sessionHeaderLeft: {
    flex: 1,
  },
  dateText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 1,
  },
  sessionWorkoutTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    color: THEME.colors.textPrimary,
  },
  sessionMetricsSummary: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  sessionBilanText: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 11,
    color: THEME.colors.accentStrong,
    fontStyle: 'italic',
    marginTop: 3,
  },
  volumeHighlight: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.sansHeavy,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionDetailsBox: {
    backgroundColor: '#F2F5FA',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  exerciseDetailRow: {
    gap: 6,
  },
  exerciseDetailName: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  setsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  setChipText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  loadMoreBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
    borderRadius: THEME.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  loadMoreBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.accentStrong,
  },
  clearHistoryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  clearHistoryBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.feelingHardText,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  sheetTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: THEME.fonts.sansSemi,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  inputSectionLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  programToggleRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.pill,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  programBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  programBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: THEME.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  programBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  programBtnTextActive: {
    color: THEME.colors.textPrimary,
  },
  sessionEditScroll: {
    maxHeight: 440,
    marginBottom: 8,
  },
  exEditCard: {
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.card,
    padding: 10,
    marginBottom: 12,
  },
  exEditHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  exNameInput: {
    flex: 1,
    height: 40,
    backgroundColor: THEME.colors.cardBg,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.sans,
    fontSize: 13,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.inner,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  setEditCard: {
    backgroundColor: THEME.colors.cardInner,
    borderRadius: THEME.radius.inner,
    padding: 10,
    marginBottom: 8,
  },
  setEditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumberBadge: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  deleteSetLink: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.feelingHardText,
    fontSize: 11,
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stepperBlock: {
    flex: 1,
  },
  stepperLabel: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginBottom: 3,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.radius.inner,
    padding: 2,
  },
  stepBtn: {
    width: 36,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.textPrimary,
    fontSize: 11,
  },
  stepValText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.accentStrong,
    fontSize: 12,
  },
  feelingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feelBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.cardBg,
    paddingVertical: 7,
    borderRadius: THEME.radius.inner,
  },
  feelBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  addSetBtn: {
    backgroundColor: THEME.colors.cardInner,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  addSetBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: '#FFFFFF',
    fontSize: 14,
  },
  destructiveBtn: {
    backgroundColor: THEME.colors.feelingHardBg,
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginBottom: 8,
  },
  destructiveBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    color: THEME.colors.feelingHardText,
    fontSize: 13,
  },
  outlineBtn: {
    paddingVertical: 13,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  outlineBtnText: {
    fontFamily: THEME.fonts.sans,
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
});
