import { THEME } from '../theme';
import { Feeling } from '../types';

// Tables de ressenti partagées (libellé + 2 jeux de couleurs), reprises identiques dans
// FreeWorkoutScreen, HistoryScreen et WorkoutSummaryScreen avant cette extraction.
export const FEELING_LABEL: Record<Feeling, string> = { EASY: 'Réussi', MEDIUM: 'Juste', HARD: 'Échec' };

export const FEELING_BG: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyBg,
  MEDIUM: THEME.colors.feelingMediumBg,
  HARD: THEME.colors.feelingHardBg,
};

// Couleur "texte" : plus sombre/mate, pensée pour le contraste d'un texte sur fond clair.
export const FEELING_INK: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyText,
  MEDIUM: THEME.colors.feelingMediumText,
  HARD: THEME.colors.feelingHardText,
};

// Couleur "bordure" : plus vive, pour les pastilles pleines (Dot) — le texte garde FEELING_INK.
export const FEELING_DOT: Record<Feeling, string> = {
  EASY: THEME.colors.feelingEasyBorder,
  MEDIUM: THEME.colors.feelingMediumBorder,
  HARD: THEME.colors.feelingHardBorder,
};

// Libellé d'une série précise : "Facile" seulement si la coche "Dernière série facile" a été
// cochée pour CETTE série au moment de la valider (jamais déduit après coup d'une marge de
// reps) ; sinon le libellé générique du ressenti ("Réussi"/"Juste"/"Échec").
export function resolveFeelingLabel(feeling: Feeling, markedEasy?: boolean): string {
  if (feeling === 'EASY' && markedEasy) return 'Facile';
  return FEELING_LABEL[feeling];
}
