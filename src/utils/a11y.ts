import { resolveFeelingLabel } from '../constants/feeling';
import { Feeling } from '../types';
import { fmtKg } from './format';

// Libellés lus par TalkBack / VoiceOver : on écrit les unités en toutes lettres ("kilos",
// "reps") plutôt que les abréviations affichées à l'écran ("kg", "×"), mal prononcées.

export function kgA11y(weight: number): string {
  return `${fmtKg(weight)} kilos`;
}

/** "Série 2 : 8 reps à 42,5 kilos, réussi" (le ressenti est optionnel). */
export function setA11yLabel(
  setNumber: number,
  reps: number,
  weight: number,
  feeling?: Feeling,
  markedEasy?: boolean
): string {
  const base = `Série ${setNumber} : ${reps} reps à ${kgA11y(weight)}`;
  return feeling ? `${base}, ${resolveFeelingLabel(feeling, markedEasy).toLowerCase()}` : base;
}

/** 252 → "4 minutes 12 secondes". */
export function durationA11y(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} seconde${seconds > 1 ? 's' : ''}`);
  return parts.join(' ');
}
