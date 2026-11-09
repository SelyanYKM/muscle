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

export interface RecordStep {
  date: string;
  weight: number;
}

export interface RecordRow {
  exerciseName: string;
  maxWeight: number;
  /** Gain sur l'ancien record quand il a été battu dans la fenêtre récente, sinon null. */
  delta: number | null;
  /** Les marches du record : la première séance, puis chaque fois qu'il a été battu. */
  steps: RecordStep[];
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

// Série de tête d'une séance : la charge la plus lourde, et le meilleur nombre de reps à cette
// charge. Comparées dans cet ordre, une charge en hausse est un progrès même si les reps
// retombent (double progression : 12 reps à 20 kg, puis 8 reps à 22,5 kg), et à charge égale
// une rep de plus compte. Au poids du corps (charge 0), seules les reps comptent.
/** Clé d'un exercice : son nom, sans casse ni espaces superflus. */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface TopSet {
  weight: number;
  reps: number;
}

export interface ExerciseTrend {
  exerciseName: string;
  trend: Trend;
  /** Séance de référence et dernière séance, avec leur série de tête. */
  from: TopSet & { date: string };
  to: TopSet & { date: string };
}

export interface ProgressionSummary {
  up: number;
  flat: number;
  down: number;
  /** Détail par exercice : en hausse, puis stables, puis en baisse, par nom. */
  items: ExerciseTrend[];
}

function compareTopSets(latest: TopSet, reference: TopSet): Trend {
  if (latest.weight > reference.weight + 1e-9) return 'up';
  if (latest.weight < reference.weight - 1e-9) return 'down';
  if (latest.reps > reference.reps) return 'up';
  if (latest.reps < reference.reps) return 'down';
  return 'flat';
}

/**
 * Exercices en hausse / stables / en baisse : série de tête de la dernière séance contre celle de
 * la séance de référence (la dernière d'avant la fenêtre, à défaut la première de la fenêtre).
 * Seuls comptent les exercices travaillés dans la fenêtre et faits au moins deux fois.
 *
 * Les exercices sont reconnus par leur NOM (sans casse ni espaces autour), pas par leur id : les
 * anciens catalogues ont réattribué des ids (le leg curl d'hier porte l'id de l'extension triceps
 * d'aujourd'hui), et les séances corrigées dans l'historique ont un id 0 quand le nom n'était pas
 * au catalogue. Par id, on comparait un leg curl à 60 kg à une extension triceps à 27,5 kg.
 */
export function exerciseProgression(rows: StatLogRow[], todayISO: string, windowDays: number = 28): ProgressionSummary {
  const windowStart = addDays(todayISO, -(windowDays - 1));
  const byExercise = new Map<string, Map<string, TopSet>>();
  const names = new Map<string, { name: string; date: string }>();
  for (const r of rows) {
    if (r.date > todayISO) continue;
    const key = exerciseKey(r.exerciseName);
    if (!byExercise.has(key)) byExercise.set(key, new Map());
    // Graphie la plus récente du nom, pour l'affichage.
    const known = names.get(key);
    if (!known || r.date >= known.date) names.set(key, { name: r.exerciseName, date: r.date });
    const byDate = byExercise.get(key)!;
    const top = byDate.get(r.date);
    if (!top || r.weight > top.weight + 1e-9) byDate.set(r.date, { weight: r.weight, reps: r.repsDone });
    else if (Math.abs(r.weight - top.weight) <= 1e-9 && r.repsDone > top.reps) top.reps = r.repsDone;
  }

  const result: ProgressionSummary = { up: 0, flat: 0, down: 0, items: [] };
  for (const [key, byDate] of byExercise) {
    const dates = Array.from(byDate.keys()).sort();
    const latest = dates[dates.length - 1];
    if (latest < windowStart) continue;
    const before = dates.filter((d) => d < windowStart);
    const reference = before.length > 0 ? before[before.length - 1] : dates[0];
    if (reference === latest) continue;
    const from = byDate.get(reference)!;
    const to = byDate.get(latest)!;
    const trend = compareTopSets(to, from);
    result[trend]++;
    result.items.push({
      exerciseName: names.get(key)!.name,
      trend,
      from: { ...from, date: reference },
      to: { ...to, date: latest },
    });
  }
  const order: Record<Trend, number> = { up: 0, flat: 1, down: 2 };
  result.items.sort((a, b) => order[a.trend] - order[b.trend] || a.exerciseName.localeCompare(b.exerciseName));
  return result;
}

/** Charge la plus lourde de chaque séance, par exercice (clé exerciseKey), dates triées. */
function topWeightsByExercise(rows: StatLogRow[], todayISO: string): Map<string, { name: string; byDate: Map<string, number> }> {
  const out = new Map<string, { name: string; nameDate: string; byDate: Map<string, number> }>();
  for (const r of rows) {
    if (r.date > todayISO) continue;
    const key = exerciseKey(r.exerciseName);
    let e = out.get(key);
    if (!e) {
      e = { name: r.exerciseName, nameDate: r.date, byDate: new Map() };
      out.set(key, e);
    }
    // Graphie la plus récente du nom, pour l'affichage.
    if (r.date >= e.nameDate) {
      e.name = r.exerciseName;
      e.nameDate = r.date;
    }
    e.byDate.set(r.date, Math.max(e.byDate.get(r.date) ?? 0, r.weight));
  }
  return out;
}

/** Marches d'un record : la première séance, puis chaque séance qui a battu le record d'avant. */
export function recordSteps(byDate: Map<string, number>): RecordStep[] {
  const steps: RecordStep[] = [];
  let best = 0;
  for (const date of Array.from(byDate.keys()).sort()) {
    const w = byDate.get(date)!;
    if (w > best + 1e-9) {
      steps.push({ date, weight: w });
      best = w;
    }
  }
  return steps;
}

/**
 * Records (charge max par exercice), les `limit` plus lourds, avec le gain quand l'ancien record
 * a été battu dans les `windowDays` derniers jours ; `beaten` compte tous les records battus.
 * Exercices reconnus par leur nom (voir exerciseProgression).
 */
export function recordsWithRecent(rows: StatLogRow[], todayISO: string, windowDays: number = 28, limit: number = 5): { records: RecordRow[]; beaten: number } {
  const windowStart = addDays(todayISO, -(windowDays - 1));
  const all: RecordRow[] = [];
  for (const { name, byDate } of topWeightsByExercise(rows, todayISO).values()) {
    let before = 0;
    let recent = 0;
    for (const [date, w] of byDate) {
      if (date >= windowStart) recent = Math.max(recent, w);
      else before = Math.max(before, w);
    }
    all.push({
      exerciseName: name,
      maxWeight: Math.max(before, recent),
      // Un exercice tout neuf n'a pas d'ancien record à battre.
      delta: before > 0 && recent > before ? Math.round((recent - before) * 10) / 10 : null,
      steps: recordSteps(byDate),
    });
  }
  const beaten = all.filter((r) => r.delta !== null).length;
  all.sort((a, b) => b.maxWeight - a.maxWeight || a.exerciseName.localeCompare(b.exerciseName));
  return { records: all.filter((r) => r.maxWeight > 0).slice(0, limit), beaten };
}

// ---------------------------------------------------------------------------
// Depuis la reprise
// ---------------------------------------------------------------------------

/**
 * Début de la période d'entraînement en cours : la première séance après la dernière pause de
 * plus de `gapDays` jours, à défaut la toute première séance. Null sans aucune séance.
 */
export function restartDate(dates: Iterable<string>, gapDays: number = 28): string | null {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length === 0) return null;
  let start = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) > gapDays) start = sorted[i];
  }
  return start;
}

export interface RestartProgress {
  exerciseName: string;
  /** Charge la plus lourde de la première séance depuis la reprise, puis de la dernière. */
  from: number;
  to: number;
  percent: number;
}

/**
 * Évolution de chaque exercice depuis la reprise : charge la plus lourde de sa première séance
 * depuis `restartISO` contre celle de sa dernière séance. Seuls comptent les exercices chargés,
 * faits au moins deux fois depuis la reprise et encore travaillés dans les `activeDays` derniers
 * jours. Du plus gros progrès au plus petit ; `averagePercent` : moyenne de tous.
 */
export function progressSinceRestart(
  rows: StatLogRow[],
  todayISO: string,
  restartISO: string,
  activeDays: number = 28
): { items: RestartProgress[]; averagePercent: number | null } {
  const activeStart = addDays(todayISO, -(activeDays - 1));
  const items: RestartProgress[] = [];
  for (const { name, byDate } of topWeightsByExercise(rows, todayISO).values()) {
    const dates = Array.from(byDate.keys()).filter((d) => d >= restartISO).sort();
    if (dates.length < 2 || dates[dates.length - 1] < activeStart) continue;
    const from = byDate.get(dates[0])!;
    const to = byDate.get(dates[dates.length - 1])!;
    if (from <= 0) continue;
    items.push({ exerciseName: name, from, to, percent: ((to - from) / from) * 100 });
  }
  items.sort((a, b) => b.percent - a.percent || a.exerciseName.localeCompare(b.exerciseName));
  const averagePercent = items.length > 0 ? items.reduce((s, i) => s + i.percent, 0) / items.length : null;
  return { items, averagePercent };
}

/**
 * Exercices montrés dans l'éventail : les plus gros progrès, plus le plus net recul s'il y en a
 * un (il dit autant que les progrès), `max` au total.
 */
export function fanSelection(items: RestartProgress[], max: number = 5): RestartProgress[] {
  if (items.length <= max) return items;
  const worst = items[items.length - 1];
  if (worst.percent < 0) return [...items.slice(0, max - 1), worst];
  return items.slice(0, max);
}

// ---------------------------------------------------------------------------
// Muscles
// ---------------------------------------------------------------------------

/**
 * Séries de la semaine en cours (lundi → aujourd'hui) par groupe musculaire, pour les groupes
 * donnés (ceux du programme), même à 0. Du plus travaillé au moins travaillé.
 */
export function setsByMuscleThisWeek(
  rows: { date: string; muscleGroup: string | null }[],
  todayISO: string,
  groups: string[]
): { muscleGroup: string; sets: number }[] {
  const weekStart = weekStartOf(todayISO);
  const counts = new Map<string, number>(groups.map((g) => [g, 0]));
  for (const r of rows) {
    if (!r.muscleGroup || r.date < weekStart || r.date > todayISO || !counts.has(r.muscleGroup)) continue;
    counts.set(r.muscleGroup, counts.get(r.muscleGroup)! + 1);
  }
  return groups.map((g) => ({ muscleGroup: g, sets: counts.get(g)! })).sort((a, b) => b.sets - a.sets);
}

/** Jours depuis la dernière série de chaque groupe (null : jamais travaillé). */
export function daysSinceByMuscle(
  rows: { date: string; muscleGroup: string | null }[],
  todayISO: string,
  groups: string[]
): Map<string, number | null> {
  const last = new Map<string, string>();
  for (const r of rows) {
    if (!r.muscleGroup || r.date > todayISO) continue;
    if (!last.has(r.muscleGroup) || r.date > last.get(r.muscleGroup)!) last.set(r.muscleGroup, r.date);
  }
  return new Map(groups.map((g) => [g, last.has(g) ? daysBetween(last.get(g)!, todayISO) : null]));
}
