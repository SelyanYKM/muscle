// Lien entre une ligne d'historique (workout_logs) et un exercice du catalogue.
//
// Pourquoi par le nom : l'id d'un exercice n'est pas une identité fiable dans le temps. La
// synchronisation du catalogue renomme les exercices par leur id (un ancien « Leg curl » est
// devenu « Extension triceps à la poulie » sous le même id), une ancienne version de l'éditeur
// d'historique enregistrait l'id 0, et une restauration de sauvegarde remet les lignes telles
// quelles. Le nom, lui, est ce que l'utilisatrice a réellement fait. On relie donc par le nom,
// et l'id n'est qu'un raccourci recalculé à partir de lui.
//
// Module pur, sans base de données ni import à l'exécution : testable avec Node
// (`npm run test:engine`). db.ts l'utilise pour les requêtes et les migrations.

/** Même règle que exerciseKey() de utils/progressStats.ts (un test vérifie qu'elles concordent). */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Anciens noms d'exercices (catalogue de septembre-octobre 2026) rattachés à l'exercice actuel
 * qui les a remplacés : mêmes machines, charges continues d'un nom à l'autre. Clés normalisées
 * par exerciseKey(). Le High Row n'a pas d'équivalent : il reste hors catalogue (id 0).
 */
export const EXERCISE_ALIASES: Readonly<Record<string, string>> = {
  'leg curl': 'HS Iso-Lateral Leg Curl',
  'leg extension': 'HS Iso-Lateral Leg Extension',
  'face pull': 'Face Pull à la poulie',
};

export interface CatalogEntry {
  id: number;
  name: string;
}

export interface ExerciseLink {
  /** Id de l'exercice du catalogue, 0 s'il n'y est pas. */
  exerciseId: number;
  /** Nom exact du catalogue si l'exercice y est, sinon le nom d'origine, inchangé. */
  exerciseName: string;
}

/**
 * Exercice du catalogue correspondant à un nom saisi ou enregistré : comparaison sans tenir
 * compte des majuscules ni des espaces, puis les anciens noms connus (EXERCISE_ALIASES). En cas
 * de doublon de nom au catalogue, le plus petit id l'emporte (l'exercice du catalogue de base).
 */
export function resolveExerciseLink(name: string, catalog: readonly CatalogEntry[]): ExerciseLink {
  const byKey = new Map<string, CatalogEntry>();
  for (const entry of [...catalog].sort((a, b) => a.id - b.id)) {
    const key = exerciseKey(entry.name);
    if (!byKey.has(key)) byKey.set(key, entry);
  }
  const key = exerciseKey(name);
  const alias = EXERCISE_ALIASES[key];
  const match = byKey.get(key) ?? (alias ? byKey.get(exerciseKey(alias)) : undefined);
  return match ? { exerciseId: match.id, exerciseName: match.name } : { exerciseId: 0, exerciseName: name };
}

export interface LinkedLogRow {
  id: number;
  exercise_id: number;
  exercise_name: string;
}

export interface LogRelink {
  /** Id de la ligne de workout_logs. */
  id: number;
  exerciseId: number;
  exerciseName: string;
}

/**
 * Lignes de l'historique à corriger pour qu'id et nom désignent le même exercice. Ne renvoie
 * que les lignes qui changent ; appliquer le résultat puis relancer donne une liste vide.
 * Ne touche jamais aux dates, charges ni répétitions.
 */
export function planRelink(rows: readonly LinkedLogRow[], catalog: readonly CatalogEntry[]): LogRelink[] {
  const cache = new Map<string, ExerciseLink>();
  const changes: LogRelink[] = [];
  for (const row of rows) {
    let link = cache.get(row.exercise_name);
    if (!link) {
      link = resolveExerciseLink(row.exercise_name, catalog);
      cache.set(row.exercise_name, link);
    }
    if (link.exerciseId !== row.exercise_id || link.exerciseName !== row.exercise_name) {
      changes.push({ id: row.id, ...link });
    }
  }
  return changes;
}

export interface HistoryLogRow {
  date: string;
  weight: number;
  reps_done: number;
  marked_easy: number | null;
}

export interface GroupedSession {
  date: string;
  sets: { weight: number; reps: number }[];
  easy: boolean;
}

/** Regroupe les séries d'un exercice par date de séance, dans l'ordre chronologique. */
export function groupSessionsByDate(rows: readonly HistoryLogRow[]): GroupedSession[] {
  const byDate = new Map<string, GroupedSession>();
  for (const r of rows) {
    const session = byDate.get(r.date) ?? { date: r.date, sets: [], easy: false };
    session.sets.push({ weight: r.weight, reps: r.reps_done });
    session.easy = session.easy || !!r.marked_easy;
    byDate.set(r.date, session);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Requêtes partagées entre db.ts et les tests d'intégration : toujours l'id ET le nom, et la
// séance la plus récente par sa date (pas par l'ordre d'enregistrement : une séance passée
// corrigée dans l'historique est réenregistrée avec des id plus récents).
export const LINK_SQL = {
  catalog: 'SELECT id, name FROM exercises;',
  allLogLinks: 'SELECT id, exercise_id, exercise_name FROM workout_logs;',
  relinkLog: 'UPDATE workout_logs SET exercise_id = ?, exercise_name = ? WHERE id = ?;',
  trainingDates: 'SELECT DISTINCT date FROM workout_logs ORDER BY date ASC;',
  exerciseHistory: `SELECT date, weight, reps_done, marked_easy FROM workout_logs
    WHERE exercise_id = ? AND exercise_name = ?
    ORDER BY date ASC, set_number ASC, id ASC;`,
  lastSessionDate: `SELECT date FROM workout_logs
    WHERE exercise_id = ? AND exercise_name = ?
    ORDER BY date DESC, id DESC LIMIT 1;`,
  sessionSets: `SELECT set_number, weight, reps_done, feeling FROM workout_logs
    WHERE exercise_id = ? AND exercise_name = ? AND date = ?
    ORDER BY set_number ASC, id ASC;`,
} as const;
