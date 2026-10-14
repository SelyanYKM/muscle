import {
  ExerciseProgressionSettings,
  ExerciseProgressionState,
  ProgressionDecision,
  ProgressionSessionInput,
  SessionStatus,
} from '../types';

// Arrondit au multiple de palier le plus proche (pour une hausse de charge).
function roundToNearestIncrement(weight: number, incrementKg: number): number {
  if (incrementKg <= 0) return weight;
  return Math.round(weight / incrementKg) * incrementKg;
}

// Arrondit au multiple de palier inférieur (pour une baisse de charge), jamais négatif.
function floorToIncrement(weight: number, incrementKg: number): number {
  if (incrementKg <= 0) return Math.max(0, weight);
  return Math.max(0, Math.floor(weight / incrementKg) * incrementKg);
}

function daysBetween(fromDate: string, toDate: Date): number {
  const [y, m, d] = fromDate.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const toMidnight = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((toMidnight.getTime() - from.getTime()) / 86400000);
}

function keep(state: ExerciseProgressionState, reason: string, status: SessionStatus): ProgressionDecision {
  return {
    status,
    nextWeight: state.currentWeight,
    nextTargetReps: state.currentTargetReps,
    reason,
    newState: { ...state, lastDecisionReason: reason },
  };
}

function applyWeightFactor(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  factor: number,
  reason: string,
  status: SessionStatus
): ProgressionDecision {
  const lowered = floorToIncrement(state.currentWeight * factor, settings.incrementKg);
  const nextWeight = Math.max(lowered, settings.minWeightKg);
  const newState: ExerciseProgressionState = {
    ...state,
    currentWeight: nextWeight,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastDecisionReason: reason,
  };
  return { status, nextWeight, nextTargetReps: state.currentTargetReps, reason, newState };
}

function lowerByOneIncrement(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  reason: string,
  status: SessionStatus
): ProgressionDecision {
  const lowered = floorToIncrement(state.currentWeight - settings.incrementKg, settings.incrementKg);
  const nextWeight = Math.max(lowered, settings.minWeightKg);
  const newState: ExerciseProgressionState = {
    ...state,
    currentWeight: nextWeight,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastDecisionReason: reason,
  };
  return { status, nextWeight, nextTargetReps: state.currentTargetReps, reason, newState };
}

function raiseWeight(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  steps: number,
  reason: string,
  status: SessionStatus,
  nextTargetReps: number
): ProgressionDecision {
  const raised = roundToNearestIncrement(state.currentWeight + steps * settings.incrementKg, settings.incrementKg);
  const newState: ExerciseProgressionState = {
    ...state,
    currentWeight: raised,
    currentTargetReps: nextTargetReps,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastDecisionReason: reason,
  };
  return { status, nextWeight: raised, nextTargetReps, reason, newState };
}

/**
 * Détermine la charge/objectif de reps pour la prochaine séance, à partir des réglages de
 * l'exercice, de l'état mémorisé et (le cas échéant) de la dernière séance de travail.
 * Traduction directe du pseudo-code du doc "Algorithme de suggestion de charges — Mooscles".
 * Prend la séance de travail qui vient d'être faite et renvoie la prescription pour la
 * prochaine. Pour simplement afficher la prescription en cours (avant toute séance), lire
 * `state.currentWeight`/`state.currentTargetReps` directement : pas besoin du moteur.
 */
export function suggestNextPrescription(
  settings: ExerciseProgressionSettings,
  state: ExerciseProgressionState,
  session: ProgressionSessionInput,
  today: Date = new Date()
): ProgressionDecision {
  // 1. Pause longue (seulement si une séance précédente existe réellement).
  if (state.lastSessionDate && !state.isCalibrating) {
    const jours = daysBetween(state.lastSessionDate, today);
    if (jours > 30) {
      return applyWeightFactor(settings, state, 0.8, 'Reprise après plus de 30 jours', 'RESUMED_AFTER_BREAK');
    }
    if (jours > 14) {
      return applyWeightFactor(settings, state, 0.9, 'Reprise après plus de 14 jours', 'RESUMED_AFTER_BREAK');
    }
  }

  // 2. Calibration (première séance sur cet exercice) : pas de statut, la suggestion
  // démarre à la séance suivante.
  if (state.isCalibrating) {
    const newState: ExerciseProgressionState = {
      ...state,
      currentWeight: session.weightUsed,
      isCalibrating: false,
      lastSessionDate: formatLocalDateForEngine(today),
      lastDecisionReason: 'Séance de calibration',
    };
    return {
      status: 'CALIBRATION',
      nextWeight: session.weightUsed,
      nextTargetReps: state.currentTargetReps,
      reason: 'Séance de calibration',
      newState,
    };
  }

  // 3. Séance non exploitable (interrompue) : la charge suivante reste identique.
  if (session.reps.length < settings.targetSets) {
    const decision = keep(state, 'Séance incomplète : la charge suivante reste identique', 'INCOMPLETE');
    decision.newState.lastSessionDate = formatLocalDateForEngine(today);
    return decision;
  }

  // 4. Classification de la séance.
  const objectif = state.currentTargetReps;
  const ratees = session.reps.filter((r) => r < objectif).length;
  const facile = session.easy || Math.min(...session.reps) >= objectif + 2;

  if (ratees === 0) {
    const resetState: ExerciseProgressionState = {
      ...state,
      consecutiveFailures: 0,
      sessionsWithoutSuccess: 0,
      lastSessionDate: formatLocalDateForEngine(today),
    };

    if (settings.mode === 'CHARGE') {
      const steps = facile ? 2 : 1;
      const reason = facile
        ? `+${steps} paliers : séance réussie facile`
        : `+${steps} palier : séance réussie`;
      return raiseWeight(settings, resetState, steps, reason, facile ? 'EASY_SUCCESS' : 'SUCCESS', objectif);
    }

    // Mode REPS_PUIS_CHARGE
    if (objectif < settings.repsMax) {
      const pas = facile ? 2 : 1;
      const nextTargetReps = Math.min(objectif + pas, settings.repsMax);
      const reason = `Objectif ${nextTargetReps} reps`;
      const newState: ExerciseProgressionState = {
        ...resetState,
        currentTargetReps: nextTargetReps,
        lastDecisionReason: reason,
      };
      return {
        status: facile ? 'EASY_SUCCESS' : 'SUCCESS',
        nextWeight: state.currentWeight,
        nextTargetReps,
        reason,
        newState,
      };
    }

    return raiseWeight(
      settings,
      { ...resetState, currentTargetReps: settings.repsMin },
      1,
      '+1 palier, objectif ramené au bas de la plage',
      facile ? 'EASY_SUCCESS' : 'SUCCESS',
      settings.repsMin
    );
  }

  // Échec partiel ou total : mise à jour des compteurs.
  const sessionsWithoutSuccess = state.sessionsWithoutSuccess + 1;
  const consecutiveFailures = ratees === 1 ? 0 : state.consecutiveFailures + 1;
  const afterCountersState: ExerciseProgressionState = {
    ...state,
    sessionsWithoutSuccess,
    consecutiveFailures,
    lastSessionDate: formatLocalDateForEngine(today),
  };

  const shouldDeload = consecutiveFailures >= 2 || sessionsWithoutSuccess >= 3;
  const status: SessionStatus = ratees === 1 ? 'PARTIAL' : 'FAILED';

  if (shouldDeload) {
    if (settings.mode === 'CHARGE') {
      return applyWeightFactor(settings, afterCountersState, 0.9, '−10 % : échecs répétés', status);
    }
    if (state.currentTargetReps > settings.repsMin) {
      const newState: ExerciseProgressionState = {
        ...afterCountersState,
        currentTargetReps: settings.repsMin,
        consecutiveFailures: 0,
        sessionsWithoutSuccess: 0,
        lastDecisionReason: 'Retour au bas de la plage : échecs répétés',
      };
      return {
        status,
        nextWeight: state.currentWeight,
        nextTargetReps: settings.repsMin,
        reason: 'Retour au bas de la plage : échecs répétés',
        newState,
      };
    }
    return lowerByOneIncrement(settings, afterCountersState, '−1 palier : échecs répétés', status);
  }

  return keep(afterCountersState, 'Objectif pas encore atteint', status);
}

// Même format de date que formatLocalDate() de db.ts (pas d'import croisé pour garder ce
// moteur pur et testable isolément).
function formatLocalDateForEngine(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Résout la charge "réellement utilisée" d'une séance quand elle a varié entre les séries :
 * garde la charge la plus fréquente ; sans majorité stricte, retient la plus basse (pour ne
 * jamais surestimer la prescription suivante).
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
    return Math.min(...weightsPerSet);
  }
  return bestWeight;
}
