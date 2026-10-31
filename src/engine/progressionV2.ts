import type {
  ConfiguredExercise,
  ExerciseProgressionSettings,
  ExerciseProgressionState,
  LoggedSet,
  Prescription,
  ProgressionDecision,
  ProgressionMode,
  ProgressionSessionInput,
  SessionStatus,
} from '../types';

// Moteur de suggestion de charges (double progression), version 3.
// Moteur pur : aucune dépendance à la base ni à React, testable isolément
// (`npm run test:engine`). Règles détaillées : section « Algorithme de progression » du README.
//
// Deux points d'entrée :
// - getPrescription()        AVANT la séance : charge/objectif à afficher (réduction de reprise
//                            comprise). Ne modifie rien.
// - suggestNextPrescription() APRÈS la séance : classe la séance réellement faite par rapport à
//                            cette prescription et renvoie le nouvel état à mémoriser.
// L'état mémorisé garde exactement la même forme qu'en v2 : aucune migration SQLite.

// --- Réglages de l'algorithme -------------------------------------------------------------

/** Part du volume visé (reps plafonnées à l'objectif) en dessous de laquelle une séance non
 * réussie est un échec (FAILED). Au-dessus, elle est « presque » réussie (PARTIAL). */
export const NEAR_MISS_RATIO = 0.85;
/** Échecs (FAILED) depuis la dernière réussite avant décharge. */
export const FAILURES_BEFORE_DELOAD = 3;
/** Séances sans réussite (PARTIAL, FAILED, REDUCED_LOAD) avant décharge : la stagnation.
 * En mode CHARGE, une stagnation fait reculer d'un palier ; seuls les échecs francs font −10 %. */
export const STALLED_SESSIONS_BEFORE_DELOAD = 4;
/** Décharge après échecs francs en mode CHARGE : la charge est ramenée vers −10 %. */
export const DELOAD_FACTOR = 0.9;
/** Au-delà de ce rapport palier / charge, monter la charge est trop brutal (ex. 8 → 10 kg = +25 %) :
 * un exercice en mode CHARGE passe alors en double progression tant que la charge est légère. */
export const LIGHT_LOAD_RATIO = 0.1;
/** Largeur de la plage de reps de cette double progression forcée (un exercice en mode CHARGE
 * n'a pas de plage : repsMax = repsMin). Ex. objectif 8 → plage 8-12. */
export const LIGHT_LOAD_EXTRA_REPS = 4;
/** Le « +2 paliers » d'une séance facile n'est accordé que s'il reste sous +10 % de la charge. */
export const MAX_EASY_RAISE_RATIO = 0.1;
/** Calibration : la charge estimée ne s'écarte pas de plus de ±20 % de la charge soulevée. */
export const CALIBRATION_MAX_CHANGE = 0.2;
/** Calibration : au-delà de 15 reps, la formule d'Epley n'est plus fiable. */
export const CALIBRATION_MAX_REPS = 15;

const EPS = 1e-6;

// --- Outils numériques --------------------------------------------------------------------

// Supprime le bruit flottant (ex. 20.000000000000004) pour l'affichage et la comparaison.
const clean = (n: number): number => Math.round(n * 1000) / 1000;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const fmt = (w: number): string => String(clean(w)).replace('.', ',');

// Formule d'Epley : 1RM estimé, et charge correspondant à un nombre de reps donné.
const estimateOneRepMax = (weight: number, reps: number): number => weight * (1 + reps / 30);
const weightForReps = (oneRepMax: number, reps: number): number => oneRepMax / (1 + reps / 30);

// Hausse : multiple de palier le plus proche de « charge + n paliers ».
function raiseBySteps(weight: number, steps: number, incrementKg: number): number {
  if (incrementKg <= 0) return weight;
  return clean(Math.round((weight + steps * incrementKg) / incrementKg) * incrementKg);
}

// Baisse : multiple de palier le plus proche de la cible, strictement sous la charge actuelle,
// jamais sous le plancher. Plus fidèle qu'un arrondi systématique au palier inférieur
// (52,5 × 0,9 = 47,25 → 47,5 kg, et non 45).
function lowerTowards(target: number, current: number, incrementKg: number, minWeightKg: number): number {
  let lowered: number;
  if (incrementKg <= 0) {
    lowered = Math.min(target, current);
  } else {
    lowered = Math.round(target / incrementKg) * incrementKg;
    if (lowered >= current - EPS) lowered = Math.floor((current - EPS) / incrementKg) * incrementKg;
  }
  const floor = Math.min(minWeightKg, current); // un état déjà sous le plancher ne remonte pas
  return clean(Math.max(floor, lowered, 0));
}

function daysBetween(fromDate: string, toDate: Date): number {
  const [y, m, d] = fromDate.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const toMidnight = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((toMidnight.getTime() - from.getTime()) / 86400000);
}

// Même format de date que formatLocalDate() de db.ts (pas d'import croisé pour garder ce
// moteur pur et testable isolément).
function formatLocalDateForEngine(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Réglages et plan de progression ------------------------------------------------------

// Protège le moteur des réglages incohérents (0 série, plage inversée, valeurs manquantes).
function normalizeSettings(s: ExerciseProgressionSettings): ExerciseProgressionSettings {
  const repsMin = Math.max(1, Math.round(s.repsMin || 0));
  return {
    ...s,
    targetSets: Math.max(1, Math.round(s.targetSets || 0)),
    repsMin,
    repsMax: Math.max(repsMin, Math.round(s.repsMax || 0)),
    incrementKg: Math.max(0, s.incrementKg || 0),
    minWeightKg: Math.max(0, s.minWeightKg || 0),
  };
}

interface ProgressionPlan {
  mode: ProgressionMode;
  repsMin: number;
  repsMax: number;
  /** Vrai quand un exercice en mode CHARGE passe en double progression à cause d'une charge légère. */
  lightLoad: boolean;
}

function progressionPlan(cfg: ExerciseProgressionSettings, weight: number): ProgressionPlan {
  if (cfg.mode === 'REPS_PUIS_CHARGE') {
    return { mode: 'REPS_PUIS_CHARGE', repsMin: cfg.repsMin, repsMax: cfg.repsMax, lightLoad: false };
  }
  const light = cfg.incrementKg > 0 && (weight <= EPS || cfg.incrementKg / weight > LIGHT_LOAD_RATIO + EPS);
  if (!light) return { mode: 'CHARGE', repsMin: cfg.repsMin, repsMax: cfg.repsMax, lightLoad: false };
  return {
    mode: 'REPS_PUIS_CHARGE',
    repsMin: cfg.repsMin,
    repsMax: Math.max(cfg.repsMax, cfg.repsMin + LIGHT_LOAD_EXTRA_REPS),
    lightLoad: true,
  };
}

// --- Avant la séance ----------------------------------------------------------------------

/**
 * Charge et objectif à proposer pour la séance qui commence. Applique la réduction de reprise :
 * plus de 14 jours sans l'exercice → −10 %, plus de 30 jours → −20 %, d'un cran en moins si
 * l'utilisatrice s'est entraînée (autre exercice) dans les 14 derniers jours.
 * `previousWorkoutDate` : date de la dernière séance, tous exercices confondus, STRICTEMENT
 * avant aujourd'hui (voir getLastTrainingDateBefore() dans db.ts). Optionnel.
 */
export function getPrescription(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  today: Date = new Date(),
  previousWorkoutDate: string | null = null
): Prescription {
  const cfg = normalizeSettings(settings);
  const plan = progressionPlan(cfg, state.currentWeight);
  const targetReps = clamp(state.currentTargetReps, plan.repsMin, plan.repsMax);
  const base: Prescription = {
    weight: state.currentWeight,
    targetReps,
    resumedAfterBreak: false,
    daysOff: null,
    reason: state.lastDecisionReason,
  };
  if (state.isCalibrating || !state.lastSessionDate) return base;

  const daysOff = daysBetween(state.lastSessionDate, today);
  if (!Number.isFinite(daysOff)) return base;

  let level = daysOff > 30 ? 2 : daysOff > 14 ? 1 : 0;
  if (level > 0 && previousWorkoutDate) {
    const globalGap = daysBetween(previousWorkoutDate, today);
    if (Number.isFinite(globalGap) && globalGap <= 14) level -= 1;
  }
  if (level === 0) return { ...base, daysOff };

  const factor = level === 2 ? 0.8 : 0.9;
  const weight = lowerTowards(state.currentWeight * factor, state.currentWeight, cfg.incrementKg, cfg.minWeightKg);
  return {
    weight,
    targetReps,
    resumedAfterBreak: true,
    daysOff,
    reason: `Reprise après ${daysOff} j : −${Math.round((1 - factor) * 100)} %`,
  };
}

// --- Sélection des séries de travail ------------------------------------------------------

export type SetPattern = 'STRAIGHT' | 'MIXED' | 'INCOMPLETE';

export interface WorkingSelection {
  /** Séries retenues pour l'évaluation (exactement targetSets, sauf INCOMPLETE). */
  sets: LoggedSet[];
  /** Charge représentative de la séance, comparée à la prescription. */
  weight: number;
  pattern: SetPattern;
}

const isPerformed = (s: LoggedSet): boolean =>
  !s.isWarmup && Number.isFinite(s.weight) && s.weight >= 0 && Number.isFinite(s.reps) && s.reps > 0;

/**
 * Choisit les séries qui comptent et la charge qui représente la séance. Le moteur est pensé pour
 * des séries droites (ex. 3×8 à la même charge) :
 * - STRAIGHT : au moins targetSets séries à une même charge (la plus lourde si plusieurs). Les
 *   autres séries (série test, série bonus, série de retour au calme) sont ignorées.
 * - MIXED : pas de séries droites. Une série plus lourde que la prescription et ratée est une
 *   tentative, ignorée ; on garde ensuite les targetSets premières séries, charge = la plus légère.
 * - INCOMPLETE : pas assez de séries, tentatives exclues.
 */
export function selectWorkingSets(
  allSets: LoggedSet[],
  targetSets: number,
  prescribedWeight: number,
  targetReps: number
): WorkingSelection {
  const sets = allSets.filter(isPerformed);

  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  const straightWeights = [...counts].filter(([, n]) => n >= targetSets).map(([w]) => w);
  if (straightWeights.length > 0) {
    const weight = Math.max(...straightWeights);
    return { sets: sets.filter((s) => s.weight === weight).slice(0, targetSets), weight, pattern: 'STRAIGHT' };
  }

  const kept = sets.filter((s) => !(s.weight > prescribedWeight + EPS && s.reps < targetReps));
  if (kept.length < targetSets) {
    return { sets: kept, weight: kept.length ? Math.min(...kept.map((s) => s.weight)) : 0, pattern: 'INCOMPLETE' };
  }
  const picked = kept.slice(0, targetSets);
  return { sets: picked, weight: Math.min(...picked.map((s) => s.weight)), pattern: 'MIXED' };
}

// --- Après la séance ----------------------------------------------------------------------

type Outcome = 'SUCCESS' | 'PARTIAL' | 'FAILED';

function decision(
  status: SessionStatus,
  state: ExerciseProgressionState,
  reason: string,
  resumedAfterBreak = false
): ProgressionDecision {
  return {
    status,
    nextWeight: state.currentWeight,
    nextTargetReps: state.currentTargetReps,
    reason,
    newState: { ...state, lastDecisionReason: reason },
    resumedAfterBreak,
  };
}

// Décharge si trop d'échecs ou de séances sans réussite ; sinon null.
function applyDeloadRules(
  cfg: ExerciseProgressionSettings,
  plan: ProgressionPlan,
  s: ExerciseProgressionState
): { state: ExerciseProgressionState; reason: string } | null {
  const tooManyFailures = s.consecutiveFailures >= FAILURES_BEFORE_DELOAD;
  const stalled = s.sessionsWithoutSuccess >= STALLED_SESSIONS_BEFORE_DELOAD;
  if (!tooManyFailures && !stalled) return null;

  const why = tooManyFailures ? `${s.consecutiveFailures} échecs` : `${s.sessionsWithoutSuccess} séances sans réussite`;
  const reset: ExerciseProgressionState = { ...s, consecutiveFailures: 0, sessionsWithoutSuccess: 0 };

  if (plan.mode === 'CHARGE') {
    // Échecs francs : vraie décharge. Stagnation (des « presque » qui s'accumulent) : un palier
    // suffit pour relancer la machine.
    if (tooManyFailures) {
      const w = lowerTowards(s.currentWeight * DELOAD_FACTOR, s.currentWeight, cfg.incrementKg, cfg.minWeightKg);
      return { state: { ...reset, currentWeight: w }, reason: `−10 % (${why}) : ${fmt(w)} kg` };
    }
    const w = lowerTowards(s.currentWeight - cfg.incrementKg, s.currentWeight, cfg.incrementKg, cfg.minWeightKg);
    return { state: { ...reset, currentWeight: w }, reason: `−1 palier (${why}) : ${fmt(w)} kg` };
  }
  if (s.currentTargetReps > plan.repsMin) {
    return { state: { ...reset, currentTargetReps: plan.repsMin }, reason: `Retour à ${plan.repsMin} reps (${why})` };
  }
  const w = lowerTowards(s.currentWeight - cfg.incrementKg, s.currentWeight, cfg.incrementKg, cfg.minWeightKg);
  return { state: { ...reset, currentWeight: w }, reason: `−1 palier (${why}) : ${fmt(w)} kg` };
}

// Première séance sur l'exercice : la charge et l'objectif suivants sont estimés d'après les
// reps réellement faites (Epley), au lieu de reprendre la charge telle quelle.
function calibrate(
  cfg: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  sets: LoggedSet[],
  todayStr: string
): ProgressionDecision {
  // Charge de référence : celle du plus grand nombre de séries (la plus lourde en cas
  // d'égalité). Une tentative isolée plus lourde ne fausse pas l'estimation.
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  const most = Math.max(...counts.values());
  const top = Math.max(...[...counts].filter(([, n]) => n === most).map(([w]) => w));
  const reps = Math.min(...sets.filter((s) => s.weight === top).map((s) => s.reps));
  const plan = progressionPlan(cfg, top);

  let weight = top;
  let target: number;
  if (plan.mode === 'REPS_PUIS_CHARGE' && reps >= plan.repsMin && reps <= plan.repsMax) {
    target = reps; // dans la plage : on repart de ce qui vient d'être fait
  } else {
    target = plan.mode === 'CHARGE' ? clamp(state.currentTargetReps, plan.repsMin, plan.repsMax) : plan.repsMin;
    const estimate = weightForReps(estimateOneRepMax(top, Math.min(reps, CALIBRATION_MAX_REPS)), target);
    const bounded = clamp(estimate, top * (1 - CALIBRATION_MAX_CHANGE), top * (1 + CALIBRATION_MAX_CHANGE));
    if (cfg.incrementKg > 0 && Math.abs(bounded - top) >= cfg.incrementKg - EPS) {
      // Arrondi au palier inférieur dans les deux sens : une estimation reste une estimation.
      weight = clean(Math.max(cfg.minWeightKg, Math.floor(bounded / cfg.incrementKg + EPS) * cfg.incrementKg));
    }
  }

  const estimated = Math.abs(weight - top) > EPS || target !== reps;
  const reason = estimated
    ? `Calibration : ${fmt(weight)} kg × ${target} (estimé d'après ${fmt(top)} kg × ${reps})`
    : `Calibration : ${fmt(weight)} kg × ${target}`;
  return decision('CALIBRATION', {
    ...state,
    currentWeight: weight,
    currentTargetReps: target,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    isCalibrating: false,
    lastSessionDate: todayStr,
  }, reason);
}

/**
 * Prend la séance de travail qui vient d'être faite (toutes les séries loguées, telles quelles)
 * et renvoie la prescription de la prochaine séance avec le nouvel état à mémoriser.
 * `today` : date de la séance. `previousWorkoutDate` : voir getPrescription().
 */
export function suggestNextPrescription(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  session: ProgressionSessionInput,
  today: Date = new Date(),
  previousWorkoutDate: string | null = null
): ProgressionDecision {
  const cfg = normalizeSettings(settings);
  const todayStr = formatLocalDateForEngine(today);
  const performed = (session.sets ?? []).filter(isPerformed);

  // 0. Aucune série faite : rien ne change, pas même la date (sinon une séance vide
  // effacerait une vraie pause).
  if (performed.length === 0) {
    return { ...decision('SKIPPED', state, 'Aucune série enregistrée : rien ne change'), newState: state };
  }

  // 1. Première séance sur l'exercice.
  if (state.isCalibrating) return calibrate(cfg, state, performed, todayStr);

  // 2. Prescription réellement proposée pour cette séance (réduction de reprise comprise) : c'est
  // la référence, et non la charge mémorisée avant la pause.
  const prescription = getPrescription(cfg, state, today, previousWorkoutDate);
  const resumed = prescription.resumedAfterBreak;
  const ref = prescription.weight;
  const prefix = resumed ? `${prescription.reason} · ` : '';
  let s: ExerciseProgressionState = {
    ...state,
    currentWeight: ref,
    currentTargetReps: prescription.targetReps,
    lastSessionDate: todayStr,
    // Après une pause, les échecs d'avant ne disent plus rien de la forme actuelle.
    ...(resumed ? { consecutiveFailures: 0, sessionsWithoutSuccess: 0 } : {}),
  };
  const finish = (status: SessionStatus, next: ExerciseProgressionState, reason: string) =>
    decision(status, next, prefix + reason, resumed);

  // 3. Séries qui comptent.
  const sel = selectWorkingSets(performed, cfg.targetSets, ref, prescription.targetReps);
  if (sel.pattern === 'INCOMPLETE') {
    return finish('INCOMPLETE', s, `Séance incomplète (${sel.sets.length}/${cfg.targetSets} séries) : charge inchangée`);
  }

  const lighter = sel.weight < ref - EPS;
  const heavier = sel.weight > ref + EPS;
  // Séries droites plus légères que prévu : une mauvaise séance isolée fait stagner (la charge
  // prévue est maintenue). Si la séance précédente était déjà sous cette charge prévue, et pas
  // réussie (sinon la prescription aurait bougé), c'est un choix qui se confirme : la charge faite
  // devient la référence et la progression repart d'elle, sans dépasser la prescription.
  const previous = session.previousSets?.length
    ? selectWorkingSets(session.previousSets, cfg.targetSets, ref, prescription.targetReps)
    : null;
  const previousAlsoLighter =
    !!previous && previous.pattern !== 'INCOMPLETE' && previous.weight < ref - EPS && s.sessionsWithoutSuccess >= 1;
  const followLighter = lighter && sel.pattern === 'STRAIGHT' && previousAlsoLighter;
  const evalWeight = heavier || followLighter ? sel.weight : ref;
  const plan = progressionPlan(cfg, evalWeight);
  const target = clamp(s.currentTargetReps, plan.repsMin, plan.repsMax);
  s = { ...s, currentTargetReps: target };

  // 4. Classification par le volume : reps plafonnées à l'objectif, rapportées au volume visé.
  const reps = sel.sets.map((x) => x.reps);
  const minReps = Math.min(...reps);
  const ratio = reps.reduce((sum, r) => sum + Math.min(r, target), 0) / (target * cfg.targetSets);
  const outcome: Outcome = minReps >= target ? 'SUCCESS' : ratio >= NEAR_MISS_RATIO - EPS ? 'PARTIAL' : 'FAILED';
  const easy = !!session.easy || minReps >= target + 2;
  const pct = Math.round(ratio * 100);
  let note = '';

  // 5a. Plus lourd que prévu : la nouvelle charge n'est adoptée que si elle a été tenue.
  if (heavier) {
    if (outcome === 'FAILED') {
      return finish('FAILED', s, `${fmt(sel.weight)} kg non tenus (${pct} % du volume) : retour à ${fmt(ref)} kg`);
    }
    s = { ...s, currentWeight: sel.weight, consecutiveFailures: 0, sessionsWithoutSuccess: 0 };
  }

  // 5b. Séries droites plus légères : on suit la charge réellement choisie.
  if (followLighter) {
    s = { ...s, currentWeight: sel.weight, consecutiveFailures: 0, sessionsWithoutSuccess: 0 };
    note = `2e séance de suite sous ${fmt(ref)} kg : la charge suit (${fmt(sel.weight)} kg) · `;
  }

  // 5c. Séance plus légère isolée, ou irrégulière avec au moins une série sous la prescription
  // (50, 50, 45, 45, ou 70, 72,5, 72,5 pour 72,5 prévus) : la charge stagne, jamais de hausse.
  if (lighter && !followLighter) {
    const failed = outcome === 'FAILED';
    const next: ExerciseProgressionState = {
      ...s,
      sessionsWithoutSuccess: s.sessionsWithoutSuccess + 1,
      consecutiveFailures: s.consecutiveFailures + (failed ? 1 : 0),
    };
    const status: SessionStatus = failed ? 'FAILED' : 'REDUCED_LOAD';
    const deload = applyDeloadRules(cfg, plan, next);
    if (deload) return finish(status, deload.state, deload.reason);
    const why = sel.pattern === 'STRAIGHT' ? `Faite à ${fmt(sel.weight)} kg` : `Série(s) sous la charge prévue (${fmt(sel.weight)} kg)`;
    return finish(status, next, `${why} : ${fmt(ref)} kg maintenus`);
  }

  // 6. Réussite.
  if (outcome === 'SUCCESS') {
    const reset: ExerciseProgressionState = { ...s, consecutiveFailures: 0, sessionsWithoutSuccess: 0 };
    const status: SessionStatus = easy ? 'EASY_SUCCESS' : 'SUCCESS';
    const w = reset.currentWeight;
    const cap = (next: number) => (followLighter ? Math.min(next, ref) : next);

    if (plan.mode === 'CHARGE') {
      const steps = easy && 2 * cfg.incrementKg <= MAX_EASY_RAISE_RATIO * w + EPS ? 2 : 1;
      const next = cap(raiseBySteps(w, steps, cfg.incrementKg));
      const label = steps === 2 ? '+2 paliers : séance facile' : '+1 palier : séance réussie';
      return finish(status, { ...reset, currentWeight: next }, note + label);
    }

    // Double progression : la charge monte quand le haut de la plage est atteint sur toutes les séries.
    if (minReps >= plan.repsMax || target >= plan.repsMax) {
      const next = cap(raiseBySteps(w, 1, cfg.incrementKg));
      return finish(status, { ...reset, currentWeight: next, currentTargetReps: plan.repsMin }, `${note}+1 palier, objectif ${plan.repsMin} reps`);
    }
    // Une rep de plus que la dernière perf (deux si facile), jamais moins que l'objectif + 1.
    const nextTarget = Math.min(plan.repsMax, Math.max(target + (easy ? 2 : 1), minReps + 1));
    const light = plan.lightLoad ? ' (charge légère : les reps montent avant la charge)' : '';
    return finish(status, { ...reset, currentTargetReps: nextTarget }, `${note}Objectif ${nextTarget} reps${light}`);
  }

  // 7. Presque réussie ou ratée : charge maintenue, compteurs, décharge éventuelle.
  const failed = outcome === 'FAILED';
  const next: ExerciseProgressionState = {
    ...s,
    sessionsWithoutSuccess: s.sessionsWithoutSuccess + 1,
    consecutiveFailures: s.consecutiveFailures + (failed ? 1 : 0),
  };
  const deload = applyDeloadRules(cfg, plan, next);
  if (deload) return finish(outcome, deload.state, note + deload.reason);
  return finish(
    outcome,
    next,
    note + (failed ? `Objectif manqué (${pct} % du volume) : charge maintenue` : `Presque (${pct} % du volume) : charge maintenue`)
  );
}

// --- Rejeu de l'historique ---------------------------------------------------------------

export interface HistorySession {
  date: string; // 'YYYY-MM-DD'
  sets: LoggedSet[];
  easy?: boolean;
}

/**
 * Recalcule l'état d'un exercice en rejouant toute son histoire réelle dans le moteur, séance
 * après séance, comme si le moteur actuel avait toujours tourné. Sert à repartir de ce qui a
 * vraiment été soulevé quand les règles changent (la mémoire calculée par une ancienne version
 * peut avoir dérivé), au lieu de corriger l'écart séance après séance.
 * `trainingDates` : toutes les dates d'entraînement, tous exercices confondus (pour la pause).
 */
export function replayHistory(
  settings: ExerciseProgressionSettings,
  initial: ExerciseProgressionState,
  sessions: HistorySession[],
  trainingDates: string[] = []
): ExerciseProgressionState {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dates = [...new Set(trainingDates)].sort();
  let state: ExerciseProgressionState = {
    ...initial,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastSessionDate: null,
    lastDecisionReason: null,
    isCalibrating: true,
  };
  let previousSets: LoggedSet[] | undefined;

  for (const session of sorted) {
    const [y, m, d] = session.date.split('-').map(Number);
    const day = new Date(y, m - 1, d, 12);
    const before = dates.filter((x) => x < session.date);
    const previousWorkoutDate = before.length > 0 ? before[before.length - 1] : null;
    const result = suggestNextPrescription(
      settings,
      state,
      { sets: session.sets, easy: !!session.easy, previousSets },
      day,
      previousWorkoutDate
    );
    if (result.status === 'SKIPPED') continue;
    state = result.newState;
    previousSets = session.sets;
  }
  return state;
}

// --- Raccourcis pour les écrans -----------------------------------------------------------

export function progressionSettingsOf(ex: ConfiguredExercise): ExerciseProgressionSettings {
  return {
    mode: ex.mode,
    targetSets: ex.numSets,
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    incrementKg: ex.minIncrement,
    minWeightKg: ex.minWeightKg,
    restSeconds: ex.restSeconds,
  };
}

export function progressionStateOf(ex: ConfiguredExercise): ExerciseProgressionState {
  return {
    currentWeight: ex.currentWeight,
    currentTargetReps: ex.currentTargetReps,
    consecutiveFailures: ex.consecutiveFailures,
    sessionsWithoutSuccess: ex.sessionsWithoutSuccess,
    lastSessionDate: ex.lastSessionDate,
    lastDecisionReason: ex.lastDecisionReason,
    isCalibrating: ex.isCalibrating,
  };
}

/** Prescription à afficher pour un exercice du catalogue (voir getPrescription). */
export function prescriptionFor(
  ex: ConfiguredExercise,
  today: Date = new Date(),
  previousWorkoutDate: string | null = null
): Prescription {
  return getPrescription(progressionSettingsOf(ex), progressionStateOf(ex), today, previousWorkoutDate);
}

/**
 * @deprecated N'est plus utilisée par le moteur (voir selectWorkingSets). Conservée telle quelle
 * pour les migrations de db.ts qui resynchronisent les charges depuis l'historique.
 *
 * Résout la charge "réellement utilisée" d'une séance quand elle a varié entre les séries :
 * garde la charge la plus fréquente ; sans majorité stricte (ex. une montée en charge), retient
 * la DERNIÈRE série de la séance.
 */
export function resolveSessionWeight(weightsPerSet: number[]): number {
  if (weightsPerSet.length === 0) return 0;

  const counts = new Map<number, number>();
  for (const w of weightsPerSet) {
    counts.set(w, (counts.get(w) || 0) + 1);
  }

  let bestWeight = weightsPerSet[0];
  let bestCount = 0;
  let tie = false;
  for (const [w, count] of counts) {
    if (count > bestCount) {
      bestWeight = w;
      bestCount = count;
      tie = false;
    } else if (count === bestCount) {
      tie = true;
    }
  }

  if (tie) {
    return weightsPerSet[weightsPerSet.length - 1];
  }
  return bestWeight;
}
