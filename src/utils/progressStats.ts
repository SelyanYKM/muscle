// Statistiques du tiroir « Ton progrès » (régularité, repos, perf globale) et signal de repos de
// l'accueil. Fonctions pures, sans dépendance (testées par src/utils/__tests__/progressStats.test.mjs,
// que Node lance sur le .ts directement) : les dates sont des chaînes 'YYYY-MM-DD' locales.

export interface StatLogRow {
  date: string;
  workoutId: number;
  exerciseId: number;
  exerciseName: string;
  weight: number;
  repsDone: number;
}

export interface CalendarDay {
  date: string;
  /** Splits faits ce jour-là (deux si deux séances le même jour). */
  workoutIds: number[];
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarWeek {
  /** Lundi de la semaine. */
  weekStart: string;
  days: CalendarDay[];
  sessionCount: number;
}

export type Trend = 'up' | 'flat' | 'down';

export interface RecordRow {
  exerciseName: string;
  maxWeight: number;
  /** Gain sur l'ancien record quand il a été battu dans la fenêtre récente, sinon null. */
  delta: number | null;
}

export interface RestAdvice {
  /** Raisons courtes, affichées sous le titre du bandeau ("5 séances sur 4", ...). */
  reasons: string[];
  /** Séance déjà faite aujourd'hui : le repos est conseillé pour demain. */
  trainedToday: boolean;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateISO: string, days: number): string {
  const d = parseISODate(dateISO);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Nombre de jours entiers de `from` à `to` (positif si `to` est après). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86400000);
}

export function weekStartOf(dateISO: string): string {
  const day = parseISODate(dateISO).getDay(); // 0 = dimanche
  return addDays(dateISO, day === 0 ? -6 : 1 - day);
}

// ---------------------------------------------------------------------------
// Régularité
// ---------------------------------------------------------------------------

/** Séances distinctes (une par date et par split) : date -> splits du jour, triés. */
export function sessionsByDate(rows: { date: string; workoutId: number }[]): Map<string, number[]> {
  const byDate = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, new Set());
    byDate.get(r.date)!.add(r.workoutId);
  }
  const out = new Map<string, number[]>();
  for (const [date, ids] of byDate) out.set(date, Array.from(ids).sort((a, b) => a - b));
  return out;
}

function sessionCountByWeek(byDate: Map<string, number[]>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [date, ids] of byDate) {
    const wk = weekStartOf(date);
    counts.set(wk, (counts.get(wk) || 0) + ids.length);
  }
  return counts;
}

/** Les `weeksCount` dernières semaines (lundi → dimanche), la semaine en cours en dernier. */
export function buildCalendar(byDate: Map<string, number[]>, todayISO: string, weeksCount: number = 8): CalendarWeek[] {
  const currentWeek = weekStartOf(todayISO);
  const weeks: CalendarWeek[] = [];
  for (let w = weeksCount - 1; w >= 0; w--) {
    const weekStart = addDays(currentWeek, -7 * w);
    const days: CalendarDay[] = [];
    let sessionCount = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const workoutIds = byDate.get(date) || [];
      sessionCount += workoutIds.length;
      days.push({ date, workoutIds, isToday: date === todayISO, isFuture: date > todayISO });
    }
    weeks.push({ weekStart, days, sessionCount });
  }
  return weeks;
}

/**
 * Semaines de suite à l'objectif : les semaines terminées, en remontant depuis la dernière,
 * plus la semaine en cours si l'objectif y est déjà atteint (sinon elle ne casse rien : elle
 * n'est pas finie).
 */
export function goalStreakWeeks(byDate: Map<string, number[]>, todayISO: string, goal: number): number {
  const counts = sessionCountByWeek(byDate);
  const currentWeek = weekStartOf(todayISO);
  let streak = (counts.get(currentWeek) || 0) >= goal ? 1 : 0;
  for (let wk = addDays(currentWeek, -7); (counts.get(wk) || 0) >= goal; wk = addDays(wk, -7)) streak++;
  return streak;
}

/**
 * Séances par semaine en moyenne sur les `weeksCount` dernières semaines TERMINÉES, sans compter
 * celles d'avant la toute première séance (une reprise ne doit pas tirer la moyenne vers le bas).
 * Null tant qu'aucune semaine terminée ne compte.
 */
export function averageSessionsPerWeek(byDate: Map<string, number[]>, todayISO: string, weeksCount: number = 8): number | null {
  if (byDate.size === 0) return null;
  const firstWeek = weekStartOf(Array.from(byDate.keys()).sort()[0]);
  const counts = sessionCountByWeek(byDate);
  const currentWeek = weekStartOf(todayISO);
  let total = 0;
  let weeks = 0;
  for (let i = 1; i <= weeksCount; i++) {
    const wk = addDays(currentWeek, -7 * i);
    if (wk < firstWeek) break;
    total += counts.get(wk) || 0;
    weeks++;
  }
  return weeks === 0 ? null : total / weeks;
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

/** Jours d'entraînement d'affilée, aujourd'hui compris s'il y a eu séance (sinon jusqu'à hier). */
export function consecutiveTrainingDays(byDate: Map<string, number[]>, todayISO: string): number {
  let day = byDate.has(todayISO) ? todayISO : addDays(todayISO, -1);
  let n = 0;
  while (byDate.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Dernier jour sans séance AVANT aujourd'hui (aujourd'hui n'est pas encore fini). */
export function lastRestDay(byDate: Map<string, number[]>, todayISO: string, lookbackDays: number = 60): string | null {
  for (let i = 1; i <= lookbackDays; i++) {
    const day = addDays(todayISO, -i);
    if (!byDate.has(day)) return day;
  }
  return null;
}

/** Jours écoulés depuis la dernière séance de chaque split (null : jamais fait). */
export function daysSinceBySplit(byDate: Map<string, number[]>, todayISO: string, workoutIds: number[]): Map<number, number | null> {
  const last = new Map<number, string>();
  for (const [date, ids] of byDate) {
    for (const id of ids) if (!last.has(id) || date > last.get(id)!) last.set(id, date);
  }
  const out = new Map<number, number | null>();
  for (const id of workoutIds) {
    const d = last.get(id);
    out.set(id, d ? Math.max(0, daysBetween(d, todayISO)) : null);
  }
  return out;
}

/**
 * Tendance de l'énergie notée au bilan : moyenne des dernières notes contre celle des notes
 * d'avant (jusqu'à 3 de chaque côté). Null sous 4 notes, trop peu pour parler de tendance.
 */
export function energyTrend(values: number[]): Trend | null {
  if (values.length < 4) return null;
  const k = Math.min(3, Math.floor(values.length / 2));
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const diff = mean(values.slice(-k)) - mean(values.slice(-2 * k, -k));
  if (diff <= -0.6) return 'down';
  if (diff >= 0.6) return 'up';
  return 'flat';
}

/** Signal de repos de l'accueil, ou null quand rien ne le justifie. */
export function buildRestAdvice(params: {
  weekCount: number;
  goal: number;
  consecutiveDays: number;
  energy: Trend | null;
  trainedToday: boolean;
}): RestAdvice | null {
  const reasons: string[] = [];
  if (params.weekCount >= params.goal) reasons.push(`${params.weekCount} séance${params.weekCount > 1 ? 's' : ''} sur ${params.goal}`);
  if (params.consecutiveDays >= 3) reasons.push(`${params.consecutiveDays} jours d’affilée`);
  if (params.energy === 'down') reasons.push('énergie en baisse');
  return reasons.length > 0 ? { reasons, trainedToday: params.trainedToday } : null;
}

// ---------------------------------------------------------------------------
// Perf globale
// ---------------------------------------------------------------------------

/** Volume des `days` derniers jours (aujourd'hui compris) contre les `days` d'avant, en %. */
export function volumeTrendPercent(rows: { date: string; weight: number; repsDone: number }[], todayISO: string, days: number = 28): number | null {
  const startRecent = addDays(todayISO, -(days - 1));
  const startPrev = addDays(startRecent, -days);
  let recent = 0;
  let prev = 0;
  for (const r of rows) {
    if (r.date > todayISO) continue;
    if (r.date >= startRecent) recent += r.weight * r.repsDone;
    else if (r.date >= startPrev) prev += r.weight * r.repsDone;
  }
  if (prev <= 0) return null;
  return Math.round(((recent - prev) / prev) * 100);
}

// Meilleure série d'une séance : force estimée (Epley) quand il y a une charge, sinon les reps
// (exercices au poids du corps) — une hausse de charge comme une rep de plus comptent.
function setScore(weight: number, reps: number): number {
  return weight > 0 ? weight * (1 + reps / 30) : reps;
}

/**
 * Exercices en hausse / stables / en baisse : meilleure série de la dernière séance contre celle
 * de la séance de référence (la dernière d'avant la fenêtre, à défaut la première de la fenêtre).
 * Seuls comptent les exercices travaillés dans la fenêtre et faits au moins deux fois.
 */
export function exerciseProgression(rows: StatLogRow[], todayISO: string, windowDays: number = 28): { up: number; flat: number; down: number } {
  const windowStart = addDays(todayISO, -(windowDays - 1));
  const byExercise = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (r.date > todayISO) continue;
    if (!byExercise.has(r.exerciseId)) byExercise.set(r.exerciseId, new Map());
    const byDate = byExercise.get(r.exerciseId)!;
    byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, setScore(r.weight, r.repsDone)));
  }

  const result = { up: 0, flat: 0, down: 0 };
  for (const byDate of byExercise.values()) {
    const dates = Array.from(byDate.keys()).sort();
    const latest = dates[dates.length - 1];
    if (latest < windowStart) continue;
    const before = dates.filter((d) => d < windowStart);
    const reference = before.length > 0 ? before[before.length - 1] : dates[0];
    if (reference === latest) continue;
    const ratio = byDate.get(latest)! / Math.max(0.0001, byDate.get(reference)!);
    if (ratio > 1.01) result.up++;
    else if (ratio < 0.99) result.down++;
    else result.flat++;
  }
  return result;
}

/**
 * Records (charge max par exercice), les `limit` plus lourds, avec le gain quand l'ancien record
 * a été battu dans les `windowDays` derniers jours ; `beaten` compte tous les records battus.
 */
export function recordsWithRecent(rows: StatLogRow[], todayISO: string, windowDays: number = 28, limit: number = 5): { records: RecordRow[]; beaten: number } {
  const windowStart = addDays(todayISO, -(windowDays - 1));
  const byName = new Map<string, { before: number; recent: number }>();
  for (const r of rows) {
    if (r.date > todayISO) continue;
    if (!byName.has(r.exerciseName)) byName.set(r.exerciseName, { before: 0, recent: 0 });
    const b = byName.get(r.exerciseName)!;
    if (r.date >= windowStart) b.recent = Math.max(b.recent, r.weight);
    else b.before = Math.max(b.before, r.weight);
  }
  const all = Array.from(byName.entries()).map(([exerciseName, { before, recent }]) => ({
    exerciseName,
    maxWeight: Math.max(before, recent),
    // Un exercice tout neuf n'a pas d'ancien record à battre.
    delta: before > 0 && recent > before ? Math.round((recent - before) * 10) / 10 : null,
  }));
  const beaten = all.filter((r) => r.delta !== null).length;
  all.sort((a, b) => b.maxWeight - a.maxWeight || a.exerciseName.localeCompare(b.exerciseName));
  return { records: all.filter((r) => r.maxWeight > 0).slice(0, limit), beaten };
}
