// Libellés statiques par split (workoutId 1 = Push, 2 = Pull, 3 = Legs), partagés entre
// les écrans qui les affichent (accueil, séance, bilan, historique).
export const SPLIT_LETTERS: Record<number, string> = { 1: 'P', 2: 'P', 3: 'L' };

export const SPLIT_SUBTITLES: Record<number, string> = {
  1: 'Pectoraux • Épaules • Triceps',
  2: 'Dos • Arrière d’épaules • Biceps',
  3: 'Quadriceps • Ischios • Mollets',
};
