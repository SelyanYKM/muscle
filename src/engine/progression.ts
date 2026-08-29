import { Feeling, NextSessionPlan, SetResult } from '../types';

export const MIN_INCREMENT = 2.5; // Deux disques de 1.25 kg

/**
 * Moteur de calcul déterministe de surcharge progressive (pour la séance N+1).
 */
export function calculateNextSession(
  results: SetResult[],
  targetReps: number = 8,
  minIncrement: number = MIN_INCREMENT,
  consecutiveFailures: number = 0
): NextSessionPlan {
  if (!results || results.length === 0) {
    return {
      weightsPerSet: [40, 40, 40],
      progressionVerdict: 'MAINTAIN',
      message: 'Aucune donnée de série disponible.',
    };
  }

  // Poids moyen ou poids de référence de la séance actuelle
  const baseWeight = results[0].weight;
  const numSets = results.length;

  const allRepsCompleted = results.every(r => r.repsDone >= targetReps);
  const feelings: Feeling[] = results.map(r => r.feeling);
  const hasHardOrFailure = !allRepsCompleted || feelings.includes('HARD');

  // CAS ÉCHEC (Reps non atteintes OU au moins un ressenti HARD)
  if (hasHardOrFailure) {
    if (consecutiveFailures >= 1) {
      // 2e échec consécutif -> Deload de 10%
      const deloaded = Math.max(
        0,
        Math.round((baseWeight * 0.9) / minIncrement) * minIncrement
      );
      return {
        weightsPerSet: Array(numSets).fill(deloaded),
        progressionVerdict: 'DELOAD',
        message: `2e séance en échec : Deload de 10% appliqué (${deloaded} kg) pour relancer la progression.`,
      };
    }

    return {
      weightsPerSet: Array(numSets).fill(baseWeight),
      progressionVerdict: 'MAINTAIN',
      message: `Objectif non validé : Maintien à ${baseWeight} kg pour la prochaine séance.`,
    };
  }

  // CAS 1 : Validation totale 🟢 / 🟢 / 🟢 (Tous EASY)
  const allEasy = feelings.every(f => f === 'EASY');
  if (allEasy) {
    const nextWeight = baseWeight + minIncrement;
    return {
      weightsPerSet: Array(numSets).fill(nextWeight),
      progressionVerdict: 'FULL_INCREASE',
      message: `🔥 Validation totale ! Augmentation de +${minIncrement} kg sur toutes les séries (${nextWeight} kg).`,
    };
  }

  // CAS 2 : Progression intermédiaire 🟢 / 🟢 / 🟠 (EASY, EASY, MEDIUM)
  if (feelings.length >= 3 && feelings[0] === 'EASY' && feelings[1] === 'EASY' && feelings[2] === 'MEDIUM') {
    const nextS1 = baseWeight + minIncrement;
    return {
      weightsPerSet: [nextS1, baseWeight, baseWeight],
      progressionVerdict: 'PARTIAL_INCREASE',
      message: `⚡ Progression intermédiaire : Série 1 augmentée à ${nextS1} kg (+${minIncrement} kg), Séries 2 & 3 maintenues à ${baseWeight} kg.`,
    };
  }

  // CAS 3 : Maintien standard (ex: 🟢/🟠/🟠 ou 🟠/🟠/🟠)
  return {
    weightsPerSet: Array(numSets).fill(baseWeight),
    progressionVerdict: 'MAINTAIN',
    message: `💪 Maintien à ${baseWeight} kg. Objectif prochaine séance : valider toutes les séries en Facile (🟢).`,
  };
}
