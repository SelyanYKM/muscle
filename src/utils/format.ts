// Formatte un poids en kg à la française (virgule plutôt que point), sans décimales inutiles
// pour un nombre entier. Repris identique dans plusieurs écrans avant cette extraction.
export function fmtKg(w: number): string {
  return w % 1 === 0 ? String(w) : String(w).replace('.', ',');
}

// Parse une date 'YYYY-MM-DD' en Date LOCALE (jamais `new Date(dateStr)`, qui l'interprète en
// UTC et peut retomber sur la veille selon le fuseau horaire). Contrepartie de
// `formatLocalDate()` dans db.ts ; les appelants gardent leurs propres options de formatage
// (toLocaleDateString), seule l'étape de parsing était dupliquée.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Formatte un nombre de secondes en "m:ss" (ex: 90 -> "1:30"). Repris identique dans
// RestTimerOverlay (décompte à l'écran) et restTimerNotifee (décompte en pause dans la
// notification) avant cette extraction.
export function formatMinSec(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
