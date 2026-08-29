import { Feeling, NextSessionPlan, SetResult } from '../types';

export const MIN_INCREMENT = 2.5; // Deux disques de 1.25 kg

/**
 * Moteur de calcul déterministe de surcharge progressive.
 * Prend en charge les charges identiques OU différentes par série (ex: pyramidal 50 / 55 / 60 kg).
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

  // Poids respectifs de chaque série réalisée
  const currentWeights = results.map((r) => r.weight);
  const numSets = results.length;

  const allRepsCompleted = results.every((r) => r.repsDone >= targetReps);
  const feelings: Feeling[] = results.map((r) => r.feeling);
  const hasHardOrFailure = !allRepsCompleted || feelings.includes('HARD');

  // CAS ÉCHEC (Reps non atteintes OU au moins un ressenti HARD)
  if (hasHardOrFailure) {
    if (consecutiveFailures >= 1) {
      // 2e échec consécutif -> Deload de 10% sur chaque série
      const deloadedWeights = currentWeights.map((w) =>
        Math.max(0, Math.round((w * 0.9) / minIncrement) * minIncrement)
      );
      return {
        weightsPerSet: deloadedWeights,
        progressionVerdict: 'DELOAD',
        message: `2e séance en échec : Deload de 10% appliqué (${deloadedWeights.join(' / ')} kg) pour relancer la progression.`,
      };
    }

    return {
      weightsPerSet: currentWeights,
      progressionVerdict: 'MAINTAIN',
      message: `Objectif non validé : Maintien des charges actuelles (${currentWeights.join(' / ')} kg).`,
    };
  }

  // CAS 1 : Validation totale 🟢 / 🟢 / 🟢 (Tous EASY)
  const allEasy = feelings.every((f) => f === 'EASY');
  if (allEasy) {
    const nextWeights = currentWeights.map((w) => w + minIncrement);
    return {
      weightsPerSet: nextWeights,
      progressionVerdict: 'FULL_INCREASE',
      message: `🔥 Validation totale ! Augmentation de +${minIncrement} kg sur toutes les séries (${nextWeights.join(' / ')} kg).`,
    };
  }

  // CAS 2 : Progression intermédiaire 🟢 / 🟢 / 🟠 (EASY, EASY, MEDIUM)
  if (feelings.length >= 3 && feelings[0] === 'EASY' && feelings[1] === 'EASY' && feelings[2] === 'MEDIUM') {
    const nextWeights = [...currentWeights];
    nextWeights[0] = nextWeights[0] + minIncrement; // S1 monte de +2.5 kg
    return {
      weightsPerSet: nextWeights,
      progressionVerdict: 'PARTIAL_INCREASE',
      message: `⚡ Progression intermédiaire : Série 1 augmentée à ${nextWeights[0]} kg (+${minIncrement} kg), autres séries maintenues (${nextWeights.slice(1).join(' / ')} kg).`,
    };
  }

  // CAS 3 : Maintien standard (ex: 🟢/🟠/🟠 ou 🟠/🟠/🟠)
  return {
    weightsPerSet: currentWeights,
    progressionVerdict: 'MAINTAIN',
    message: `💪 Maintien à ${currentWeights.join(' / ')} kg. Objectif prochaine séance : valider toutes les séries en Facile (🟢).`,
  };
}
