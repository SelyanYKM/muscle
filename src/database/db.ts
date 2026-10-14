import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { ConfiguredExercise, EquipmentCategory, Exercise, ExerciseProgressionState, ProgressionMode, Workout, WorkoutLogEntry } from '../types';
import { SEED_EXERCISES, SEED_WORKOUTS } from './seed';

let db: SQLite.SQLiteDatabase | null = null;

let memoryLogs: WorkoutLogEntry[] = [];
let memoryExercises: ConfiguredExercise[] = [];

function defaultRestSecondsFor(category: EquipmentCategory): number {
  if (category === 'CABLE') return 60;
  if (category === 'FREE_WEIGHT') return 150;
  return 90; // HAMMER_STRENGTH
}

// Construit un ConfiguredExercise "de calibration" à partir d'une définition de catalogue
// (seed ou exercice personnalisé) : utilisé pour le repli mémoire (web) et comme valeurs par
// défaut lors d'une création d'exercice.
function exerciseToConfigured(ex: Exercise): ConfiguredExercise {
  return {
    id: ex.id,
    workoutId: ex.workoutId,
    name: ex.name,
    category: ex.category,
    minIncrement: ex.minIncrement,
    baseWeight: ex.baseWeight,
    numSets: ex.defaultSetsCount || 3,
    mode: ex.mode || 'CHARGE',
    repsMin: ex.defaultTargetReps,
    repsMax: ex.repsMax || ex.defaultTargetReps,
    minWeightKg: ex.minWeightKg ?? ex.baseWeight,
    restSeconds: ex.restSeconds ?? defaultRestSecondsFor(ex.category),
    currentWeight: ex.defaultStartingWeight,
    currentTargetReps: ex.defaultTargetReps,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastSessionDate: null,
    lastDecisionReason: null,
    isCalibrating: true,
  };
}

export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') {
    initMemoryFallback();
    return;
  }

  try {
    db = SQLite.openDatabaseSync('gym_progression.db');

    db.execSync(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        min_increment REAL DEFAULT 2.5,
        base_weight REAL DEFAULT 0,
        order_index INTEGER NOT NULL,
        default_target_reps INTEGER DEFAULT 8,
        default_starting_weight REAL DEFAULT 40,
        default_sets_count INTEGER DEFAULT 3,
        FOREIGN KEY (workout_id) REFERENCES workouts (id)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS exercise_progression_state (
        exercise_id INTEGER PRIMARY KEY,
        planned_weights TEXT NOT NULL,
        consecutive_failures INTEGER DEFAULT 0,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );
    `);

    // Migrations additives pour l'algorithme de suggestion v2 (double progression) : réglages
    // par exercice (mode, plage de reps, plancher, repos) sur `exercises`, et état mémorisé
    // complet (charge/reps actuels, compteurs, date, raison, calibration) sur
    // `exercise_progression_state`. Toujours exécutées (idempotentes via PRAGMA table_info),
    // indépendamment du re-seed versionné plus bas.
    try {
      const exerciseColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(exercises);');
      const addExerciseColumnIfMissing = (name: string, ddl: string) => {
        if (!exerciseColumns.some((c) => c.name === name)) {
          db!.execSync(`ALTER TABLE exercises ADD COLUMN ${ddl};`);
        }
      };
      addExerciseColumnIfMissing('mode', "mode TEXT DEFAULT 'CHARGE'");
      addExerciseColumnIfMissing('reps_min', 'reps_min INTEGER');
      addExerciseColumnIfMissing('reps_max', 'reps_max INTEGER');
      addExerciseColumnIfMissing('min_weight_kg', 'min_weight_kg REAL');
      addExerciseColumnIfMissing('rest_seconds', 'rest_seconds INTEGER DEFAULT 90');
      addExerciseColumnIfMissing('muscle_group', 'muscle_group TEXT');
    } catch (error) {
      console.error('Erreur migration exercises (v2 progression):', error);
    }

    try {
      const stateColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(exercise_progression_state);');
      const addStateColumnIfMissing = (name: string, ddl: string) => {
        if (!stateColumns.some((c) => c.name === name)) {
          db!.execSync(`ALTER TABLE exercise_progression_state ADD COLUMN ${ddl};`);
        }
      };
      addStateColumnIfMissing('current_weight', 'current_weight REAL');
      addStateColumnIfMissing('current_target_reps', 'current_target_reps INTEGER');
      addStateColumnIfMissing('sessions_without_success', 'sessions_without_success INTEGER DEFAULT 0');
      addStateColumnIfMissing('last_session_date', 'last_session_date TEXT');
      addStateColumnIfMissing('last_decision_reason', 'last_decision_reason TEXT');
      addStateColumnIfMissing('is_calibrating', 'is_calibrating INTEGER DEFAULT 0');
    } catch (error) {
      console.error('Erreur migration exercise_progression_state (v2 progression):', error);
    }

    db.execSync(`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        date TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        weight REAL NOT NULL,
        reps_target INTEGER NOT NULL,
        reps_done INTEGER NOT NULL,
        feeling TEXT NOT NULL
      );
    `);

    // Migration additive : la colonne "mode" (GUIDED/FREE) a été ajoutée après coup, pour
    // savoir dans quel mode une séance passée a été faite (utile pour "Reprendre"/"Relancer").
    // Sur une base déjà existante, ALTER TABLE échoue si la colonne existe déjà : on vérifie
    // d'abord via PRAGMA table_info plutôt que de se fier à un try/catch qui masquerait
    // d'autres erreurs réelles.
    try {
      const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(workout_logs);');
      if (!columns.some((c) => c.name === 'mode')) {
        db.execSync('ALTER TABLE workout_logs ADD COLUMN mode TEXT;');
      }
    } catch (error) {
      console.error('Erreur migration workout_logs.mode:', error);
    }

    db.execSync(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Ressenti mental/physique + étirements, saisis sur le bilan de fin de séance : une ligne
    // par séance (date + split), tous les champs optionnels (l'utilisateur peut tout laisser
    // vide sans bloquer "Enregistrer & revenir").
    db.execSync(`
      CREATE TABLE IF NOT EXISTS session_feedback (
        date TEXT NOT NULL,
        workout_id INTEGER NOT NULL,
        physical_feeling INTEGER,
        mental_feeling INTEGER,
        stretched INTEGER DEFAULT 0,
        PRIMARY KEY (date, workout_id)
      );
    `);

    // v5 : ajout des réglages de l'algorithme de progression v2 (mode, plage de reps, plancher,
    // repos) sur chaque exercice du catalogue — relance le bloc de seed pour les installations
    // déjà passées par v3/v4, sans toucher aux exercices personnalisés de l'utilisateur (hors
    // de SEED_EXERCISES) ni à leur état de progression déjà en cours.
    const catalogVersion = db.getFirstSync<{ value: string }>(
      "SELECT value FROM app_metadata WHERE key = 'seed_version_v5';"
    );

    const workoutCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM workouts;');
    if (!workoutCount || workoutCount.count === 0) {
      for (const w of SEED_WORKOUTS) {
        db.runSync(
          'INSERT INTO workouts (id, name, description) VALUES (?, ?, ?);',
          [w.id, w.name, w.description || '']
        );
      }
    }

    if (!catalogVersion) {
      for (const ex of SEED_EXERCISES) {
        const mode = ex.mode || 'CHARGE';
        const repsMax = ex.repsMax || ex.defaultTargetReps;
        const minWeightKg = ex.minWeightKg ?? ex.baseWeight;
        const restSeconds = ex.restSeconds ?? defaultRestSecondsFor(ex.category);

        const existing = db.getFirstSync<{ id: number }>('SELECT id FROM exercises WHERE id = ?;', [ex.id]);
        if (existing) {
          db.runSync(
            `UPDATE exercises
             SET name = ?, category = ?, workout_id = ?, order_index = ?, base_weight = ?, default_target_reps = ?, default_starting_weight = ?,
                 mode = ?, reps_min = ?, reps_max = ?, min_weight_kg = ?, rest_seconds = ?
             WHERE id = ?;`,
            [
              ex.name, ex.category, ex.workoutId, ex.orderIndex, ex.baseWeight, ex.defaultTargetReps, ex.defaultStartingWeight,
              mode, ex.defaultTargetReps, repsMax, minWeightKg, restSeconds,
              ex.id,
            ]
          );
        } else {
          db.runSync(
            `INSERT INTO exercises
            (id, workout_id, name, category, min_increment, base_weight, order_index, default_target_reps, default_starting_weight, default_sets_count,
             mode, reps_min, reps_max, min_weight_kg, rest_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              ex.id,
              ex.workoutId,
              ex.name,
              ex.category,
              ex.minIncrement,
              ex.baseWeight,
              ex.orderIndex,
              ex.defaultTargetReps,
              ex.defaultStartingWeight,
              ex.defaultSetsCount || 3,
              mode,
              ex.defaultTargetReps,
              repsMax,
              minWeightKg,
              restSeconds,
            ]
          );

          db.runSync(
            `INSERT OR IGNORE INTO exercise_progression_state
             (exercise_id, planned_weights, consecutive_failures, current_weight, current_target_reps, sessions_without_success, is_calibrating)
             VALUES (?, ?, 0, ?, ?, 0, 1);`,
            [ex.id, JSON.stringify([ex.defaultStartingWeight]), ex.defaultStartingWeight, ex.defaultTargetReps]
          );
        }
      }

      db.runSync("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seed_version_v5', '1');");
    }

    // Rétro-remplissage de l'état v2 pour les exercices déjà en cours avant cette migration
    // (créés via l'ancien chemin planned_weights). Idempotent : ne touche que les lignes où
    // current_weight est encore vide, donc ne s'exécute réellement qu'une fois par exercice.
    try {
      const toBackfill = db.getAllSync<{
        exercise_id: number;
        planned_weights: string;
        default_target_reps: number;
      }>(
        `SELECT p.exercise_id, p.planned_weights, e.default_target_reps
         FROM exercise_progression_state p
         JOIN exercises e ON e.id = p.exercise_id
         WHERE p.current_weight IS NULL;`
      );
      for (const row of toBackfill) {
        let startingWeight = 40;
        try {
          const parsed = JSON.parse(row.planned_weights);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'number') {
            startingWeight = parsed[0];
          }
        } catch {}

        db.runSync(
          `UPDATE exercise_progression_state
           SET current_weight = ?, current_target_reps = ?, sessions_without_success = 0, is_calibrating = 0
           WHERE exercise_id = ?;`,
          [startingWeight, row.default_target_reps, row.exercise_id]
        );
      }
    } catch (error) {
      console.error('Erreur rétro-remplissage progression v2:', error);
    }

    // Rétro-remplissage du groupe musculaire (ajouté après le gate seed_version_v5, donc pas
    // rejoué par le bloc de seed pour les installations qui l'ont déjà passé) : toujours
    // exécuté, idempotent via la clause muscle_group IS NULL. Ne touche jamais les exercices
    // personnalisés (hors SEED_EXERCISES, sans muscleGroup).
    try {
      for (const ex of SEED_EXERCISES) {
        if (!ex.muscleGroup) continue;
        db.runSync(
          'UPDATE exercises SET muscle_group = ? WHERE id = ? AND muscle_group IS NULL;',
          [ex.muscleGroup, ex.id]
        );
      }
    } catch (error) {
      console.error('Erreur rétro-remplissage muscle_group:', error);
    }
  } catch (error) {
    console.warn('Erreur initialisation SQLite, utilisation du mode mémoire de secours:', error);
    initMemoryFallback();
  }
}

function initMemoryFallback() {
  if (memoryExercises.length === 0) {
    memoryExercises = SEED_EXERCISES.map(exerciseToConfigured);
  }
}

export function getWorkouts(): Workout[] {
  if (!db || Platform.OS === 'web') {
    return SEED_WORKOUTS;
  }
  try {
    return db.getAllSync<Workout>('SELECT * FROM workouts ORDER BY id ASC;');
  } catch {
    return SEED_WORKOUTS;
  }
}

interface ExerciseRow {
  id: number;
  workout_id: number;
  name: string;
  category: EquipmentCategory;
  min_increment: number;
  base_weight: number;
  order_index: number;
  default_target_reps: number;
  default_starting_weight: number;
  default_sets_count: number | null;
  mode: string | null;
  reps_min: number | null;
  reps_max: number | null;
  min_weight_kg: number | null;
  rest_seconds: number | null;
  consecutive_failures: number | null;
  current_weight: number | null;
  current_target_reps: number | null;
  sessions_without_success: number | null;
  last_session_date: string | null;
  last_decision_reason: string | null;
  is_calibrating: number | null;
}

const EXERCISE_JOIN_SELECT = `
  SELECT e.*, p.consecutive_failures, p.current_weight, p.current_target_reps,
         p.sessions_without_success, p.last_session_date, p.last_decision_reason, p.is_calibrating
  FROM exercises e
  LEFT JOIN exercise_progression_state p ON e.id = p.exercise_id
`;

function rowToConfiguredExercise(r: ExerciseRow): ConfiguredExercise {
  return {
    id: r.id,
    workoutId: r.workout_id,
    name: r.name,
    category: r.category,
    minIncrement: r.min_increment,
    baseWeight: r.base_weight,
    numSets: r.default_sets_count || 3,
    mode: (r.mode as ProgressionMode) || 'CHARGE',
    repsMin: r.reps_min ?? r.default_target_reps,
    repsMax: r.reps_max ?? r.default_target_reps,
    minWeightKg: r.min_weight_kg ?? r.base_weight,
    restSeconds: r.rest_seconds ?? defaultRestSecondsFor(r.category),
    currentWeight: r.current_weight ?? r.default_starting_weight,
    currentTargetReps: r.current_target_reps ?? r.default_target_reps,
    consecutiveFailures: r.consecutive_failures || 0,
    sessionsWithoutSuccess: r.sessions_without_success || 0,
    lastSessionDate: r.last_session_date,
    lastDecisionReason: r.last_decision_reason,
    isCalibrating: !!r.is_calibrating,
  };
}

export function getExercisesForWorkout(workoutId: number): ConfiguredExercise[] {
  if (!db || Platform.OS === 'web') {
    return memoryExercises.filter((e) => e.workoutId === workoutId);
  }

  try {
    const rows = db.getAllSync<ExerciseRow>(
      `${EXERCISE_JOIN_SELECT} WHERE e.workout_id = ? ORDER BY e.order_index ASC;`,
      [workoutId]
    );
    return rows.map(rowToConfiguredExercise);
  } catch (error) {
    console.error('Erreur getExercisesForWorkout:', error);
    return memoryExercises.filter((e) => e.workoutId === workoutId);
  }
}

export interface LastExercisePerformance {
  date: string;
  sets: { setNumber: number; weight: number; repsDone: number; feeling: 'EASY' | 'MEDIUM' | 'HARD' }[];
}

/**
 * Dernière performance connue sur un exercice donné (toutes séances confondues), pour
 * l'afficher comme repère pendant la séance en cours ("la dernière fois tu avais fait...").
 */
export function getLastExercisePerformance(exerciseId: number): LastExercisePerformance | null {
  if (!db || Platform.OS === 'web') {
    const logs = memoryLogs.filter((l) => l.exerciseId === exerciseId).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (logs.length === 0) return null;
    const lastDate = logs[0].date;
    const sets = logs
      .filter((l) => l.date === lastDate)
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((l) => ({ setNumber: l.setNumber, weight: l.weight, repsDone: l.repsDone, feeling: l.feeling }));
    return { date: lastDate, sets };
  }

  try {
    const lastDateRow = db.getFirstSync<{ date: string }>(
      `SELECT date FROM workout_logs WHERE exercise_id = ? ORDER BY id DESC LIMIT 1;`,
      [exerciseId]
    );
    if (!lastDateRow) return null;

    const rows = db.getAllSync<{
      set_number: number;
      weight: number;
      reps_done: number;
      feeling: 'EASY' | 'MEDIUM' | 'HARD';
    }>(
      `SELECT set_number, weight, reps_done, feeling FROM workout_logs
       WHERE exercise_id = ? AND date = ? ORDER BY set_number ASC;`,
      [exerciseId, lastDateRow.date]
    );

    return {
      date: lastDateRow.date,
      sets: rows.map((r) => ({
        setNumber: r.set_number,
        weight: r.weight,
        repsDone: r.reps_done,
        feeling: r.feeling,
      })),
    };
  } catch (error) {
    console.error('Erreur getLastExercisePerformance:', error);
    return null;
  }
}

export function getAllCatalogExercises(workoutId?: number): ConfiguredExercise[] {
  if (!db || Platform.OS === 'web') {
    return workoutId ? memoryExercises.filter((e) => e.workoutId === workoutId) : memoryExercises;
  }

  try {
    const query = workoutId
      ? `${EXERCISE_JOIN_SELECT} WHERE e.workout_id = ? ORDER BY e.name ASC;`
      : `${EXERCISE_JOIN_SELECT} ORDER BY e.workout_id ASC, e.order_index ASC;`;
    const params = workoutId ? [workoutId] : [];
    const rows = db.getAllSync<ExerciseRow>(query, params);
    return rows.map(rowToConfiguredExercise);
  } catch (error) {
    console.error('Erreur getAllCatalogExercises:', error);
    return [];
  }
}

export function addCustomExercise(
  workoutId: number,
  name: string,
  category: EquipmentCategory,
  startingWeight: number,
  targetReps: number,
  setsCount: number = 3
): ConfiguredExercise {
  const baseWeight = category === 'FREE_WEIGHT' ? 20 : 0;
  const restSeconds = defaultRestSecondsFor(category);
  // Les exercices créés depuis l'appli sont toujours en mode CHARGE (séries identiques à la
  // même charge) : le formulaire ne propose pas de choisir une plage de reps en mode
  // REPS_PUIS_CHARGE, réservé aux exercices du catalogue de base.
  const base: Omit<ConfiguredExercise, 'id'> = {
    workoutId,
    name,
    category,
    minIncrement: 2.5,
    baseWeight,
    numSets: setsCount,
    mode: 'CHARGE',
    repsMin: targetReps,
    repsMax: targetReps,
    minWeightKg: baseWeight,
    restSeconds,
    currentWeight: startingWeight,
    currentTargetReps: targetReps,
    consecutiveFailures: 0,
    sessionsWithoutSuccess: 0,
    lastSessionDate: null,
    lastDecisionReason: null,
    isCalibrating: true,
  };

  if (!db || Platform.OS === 'web') {
    const created: ConfiguredExercise = { id: Date.now(), ...base };
    memoryExercises.push(created);
    return created;
  }

  try {
    const maxOrder = db.getFirstSync<{ max_order: number | null }>(
      'SELECT MAX(order_index) as max_order FROM exercises WHERE workout_id = ?;',
      [workoutId]
    );
    const nextOrder = (maxOrder?.max_order || 0) + 1;

    const result = db.runSync(
      `INSERT INTO exercises
      (workout_id, name, category, min_increment, base_weight, order_index, default_target_reps, default_starting_weight, default_sets_count,
       mode, reps_min, reps_max, min_weight_kg, rest_seconds)
      VALUES (?, ?, ?, 2.5, ?, ?, ?, ?, ?, 'CHARGE', ?, ?, ?, ?);`,
      [workoutId, name, category, baseWeight, nextOrder, targetReps, startingWeight, setsCount, targetReps, targetReps, baseWeight, restSeconds]
    );

    const newExerciseId = result.lastInsertRowId;
    db.runSync(
      `INSERT INTO exercise_progression_state
       (exercise_id, planned_weights, consecutive_failures, current_weight, current_target_reps, sessions_without_success, is_calibrating)
       VALUES (?, ?, 0, ?, ?, 0, 1);`,
      [newExerciseId, JSON.stringify([startingWeight]), startingWeight, targetReps]
    );

    return { id: newExerciseId, ...base };
  } catch (error) {
    console.error('Erreur addCustomExercise:', error);
    return { id: Date.now(), ...base };
  }
}

export function deleteExercise(exerciseId: number): void {
  if (!db || Platform.OS === 'web') {
    memoryExercises = memoryExercises.filter((e) => e.id !== exerciseId);
    return;
  }

  try {
    db.runSync('DELETE FROM exercise_progression_state WHERE exercise_id = ?;', [exerciseId]);
    db.runSync('DELETE FROM exercises WHERE id = ?;', [exerciseId]);
  } catch (error) {
    console.error('Erreur deleteExercise:', error);
  }
}

export function saveWorkoutLogs(logs: WorkoutLogEntry[]): void {
  if (!logs || logs.length === 0) return;

  if (!db || Platform.OS === 'web') {
    memoryLogs.push(...logs);
    return;
  }

  try {
    for (const log of logs) {
      db.runSync(
        `INSERT INTO workout_logs
        (workout_id, exercise_id, exercise_name, date, set_number, weight, reps_target, reps_done, feeling, mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          log.workoutId,
          log.exerciseId,
          log.exerciseName,
          log.date,
          log.setNumber,
          log.weight,
          log.repsTarget,
          log.repsDone,
          log.feeling,
          log.mode || null,
        ]
      );
    }
  } catch (error) {
    console.error('Erreur saveWorkoutLogs:', error);
  }
}

/**
 * Enregistre le ressenti mental/physique (1-5) et les étirements d'une séance, saisis sur le
 * bilan de fin de séance. Tous les champs sont optionnels : appelé seulement si au moins un a
 * été renseigné (pas de ligne vide créée pour rien).
 */
export function saveSessionFeedback(
  date: string,
  workoutId: number,
  physicalFeeling: number | null,
  mentalFeeling: number | null,
  stretched: boolean
): void {
  if (!db || Platform.OS === 'web') return;

  try {
    db.runSync(
      `INSERT INTO session_feedback (date, workout_id, physical_feeling, mental_feeling, stretched)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date, workout_id) DO UPDATE SET
         physical_feeling = excluded.physical_feeling,
         mental_feeling = excluded.mental_feeling,
         stretched = excluded.stretched;`,
      [date, workoutId, physicalFeeling, mentalFeeling, stretched ? 1 : 0]
    );
  } catch (error) {
    console.error('Erreur saveSessionFeedback:', error);
  }
}

/**
 * Persiste l'état de progression v2 d'un exercice (charge/objectif reps actuels, compteurs,
 * date et raison de la dernière décision, calibration) — à appeler avec le `newState` renvoyé
 * par `suggestNextPrescription()` une fois une séance classée.
 */
export function saveExerciseProgressionState(exerciseId: number, state: ExerciseProgressionState): void {
  if (!db || Platform.OS === 'web') {
    const ex = memoryExercises.find((e) => e.id === exerciseId);
    if (ex) {
      ex.currentWeight = state.currentWeight;
      ex.currentTargetReps = state.currentTargetReps;
      ex.consecutiveFailures = state.consecutiveFailures;
      ex.sessionsWithoutSuccess = state.sessionsWithoutSuccess;
      ex.lastSessionDate = state.lastSessionDate;
      ex.lastDecisionReason = state.lastDecisionReason;
      ex.isCalibrating = state.isCalibrating;
    }
    return;
  }

  try {
    db.runSync(
      `INSERT INTO exercise_progression_state
       (exercise_id, planned_weights, consecutive_failures, current_weight, current_target_reps,
        sessions_without_success, last_session_date, last_decision_reason, is_calibrating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(exercise_id) DO UPDATE SET
         planned_weights = excluded.planned_weights,
         consecutive_failures = excluded.consecutive_failures,
         current_weight = excluded.current_weight,
         current_target_reps = excluded.current_target_reps,
         sessions_without_success = excluded.sessions_without_success,
         last_session_date = excluded.last_session_date,
         last_decision_reason = excluded.last_decision_reason,
         is_calibrating = excluded.is_calibrating;`,
      [
        exerciseId,
        JSON.stringify([state.currentWeight]),
        state.consecutiveFailures,
        state.currentWeight,
        state.currentTargetReps,
        state.sessionsWithoutSuccess,
        state.lastSessionDate,
        state.lastDecisionReason,
        state.isCalibrating ? 1 : 0,
      ]
    );
  } catch (error) {
    console.error('Erreur saveExerciseProgressionState:', error);
  }
}

export function getRecentLogs(limit: number = 200): WorkoutLogEntry[] {
  if (!db || Platform.OS === 'web') {
    return [...memoryLogs].reverse().slice(0, limit);
  }

  try {
    const rows = db.getAllSync<{
      id: number;
      workout_id: number;
      exercise_id: number;
      exercise_name: string;
      date: string;
      set_number: number;
      weight: number;
      reps_target: number;
      reps_done: number;
      feeling: 'EASY' | 'MEDIUM' | 'HARD';
      mode: 'GUIDED' | 'FREE' | null;
    }>(
      `SELECT * FROM workout_logs ORDER BY id DESC LIMIT ?;`,
      [limit]
    );

    return rows.map((r) => ({
      id: r.id,
      workoutId: r.workout_id,
      exerciseId: r.exercise_id,
      exerciseName: r.exercise_name,
      date: r.date,
      setNumber: r.set_number,
      weight: r.weight,
      repsTarget: r.reps_target,
      repsDone: r.reps_done,
      feeling: r.feeling,
      mode: r.mode,
    }));
  } catch (error) {
    console.error('Erreur getRecentLogs:', error);
    return [];
  }
}

/**
 * Supprime la totalité des logs d'entraînement (clear history).
 */
export function clearAllWorkoutLogs(): void {
  if (!db || Platform.OS === 'web') {
    memoryLogs = [];
    return;
  }

  try {
    db.runSync('DELETE FROM workout_logs;');
  } catch (error) {
    console.error('Erreur clearAllWorkoutLogs:', error);
  }
}

/**
 * Modifie le type de séance (Push, Pull, Legs) pour tous les logs d'une séance passée donnée.
 */
export function updateWorkoutSessionType(
  date: string,
  oldWorkoutId: number,
  newWorkoutId: number
): void {
  if (!db || Platform.OS === 'web') {
    memoryLogs = memoryLogs.map((log) => {
      if (log.date === date && log.workoutId === oldWorkoutId) {
        return { ...log, workoutId: newWorkoutId };
      }
      return log;
    });
    return;
  }

  try {
    db.runSync(
      `UPDATE workout_logs 
       SET workout_id = ? 
       WHERE date = ? AND workout_id = ?;`,
      [newWorkoutId, date, oldWorkoutId]
    );
  } catch (error) {
    console.error('Erreur updateWorkoutSessionType:', error);
  }
}

/**
 * Supprime une séance spécifique de l'historique par date et workoutId.
 */
export function deleteWorkoutSession(date: string, workoutId: number): void {
  if (!db || Platform.OS === 'web') {
    memoryLogs = memoryLogs.filter(
      (log) => !(log.date === date && log.workoutId === workoutId)
    );
    return;
  }

  try {
    db.runSync(
      `DELETE FROM workout_logs WHERE date = ? AND workout_id = ?;`,
      [date, workoutId]
    );
  } catch (error) {
    console.error('Erreur deleteWorkoutSession:', error);
  }
}

/**
 * Met à jour un exercice complet et ses séries pour une séance passée.
 */
export function updateExerciseLogsForSession(
  date: string,
  workoutId: number,
  oldExerciseName: string,
  newExerciseName: string,
  updatedSets: { setNumber: number; weight: number; repsTarget: number; repsDone: number; feeling: 'EASY' | 'MEDIUM' | 'HARD' }[]
): void {
  if (!db || Platform.OS === 'web') {
    // Retirer les anciens logs de cet exercice
    memoryLogs = memoryLogs.filter(
      (log) => !(log.date === date && log.workoutId === workoutId && log.exerciseName === oldExerciseName)
    );
    // Insérer les nouveaux
    for (const s of updatedSets) {
      memoryLogs.push({
        workoutId,
        exerciseId: 0,
        exerciseName: newExerciseName,
        date,
        setNumber: s.setNumber,
        weight: s.weight,
        repsTarget: s.repsTarget,
        repsDone: s.repsDone,
        feeling: s.feeling,
      });
    }
    return;
  }

  try {
    // Supprimer les anciens logs pour cet exercice lors de cette séance
    db.runSync(
      `DELETE FROM workout_logs WHERE date = ? AND workout_id = ? AND exercise_name = ?;`,
      [date, workoutId, oldExerciseName]
    );

    // Insérer les séries mises à jour
    for (const s of updatedSets) {
      db.runSync(
        `INSERT INTO workout_logs 
        (workout_id, exercise_id, exercise_name, date, set_number, weight, reps_target, reps_done, feeling)
        VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?);`,
        [workoutId, newExerciseName, date, s.setNumber, s.weight, s.repsTarget, s.repsDone, s.feeling]
      );
    }
  } catch (error) {
    console.error('Erreur updateExerciseLogsForSession:', error);
  }
}

/**
 * Supprime un exercice d'une séance passée.
 */
export function deleteExerciseFromSession(
  date: string,
  workoutId: number,
  exerciseName: string
): void {
  if (!db || Platform.OS === 'web') {
    memoryLogs = memoryLogs.filter(
      (log) => !(log.date === date && log.workoutId === workoutId && log.exerciseName === exerciseName)
    );
    return;
  }

  try {
    db.runSync(
      `DELETE FROM workout_logs WHERE date = ? AND workout_id = ? AND exercise_name = ?;`,
      [date, workoutId, exerciseName]
    );
  } catch (error) {
    console.error('Erreur deleteExerciseFromSession:', error);
  }
}

/**
 * Petit stockage clé/valeur pour des drapeaux simples (ex : "tel conseil déjà affiché ?"),
 * sans créer une table dédiée pour chaque cas.
 */
export function getAppMetadata(key: string): string | null {
  if (!db || Platform.OS === 'web') return null;
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_metadata WHERE key = ?;', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setAppMetadata(key: string, value: string): void {
  if (!db || Platform.OS === 'web') return;
  try {
    db.runSync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?);', [key, value]);
  } catch {
    // Sans conséquence : le conseil réapparaîtra simplement au prochain lancement
  }
}

// ---------------------------------------------------------------------------
// Dashboard motivation : stats agrégées, records personnels, mini analyse.
// ---------------------------------------------------------------------------

export interface WeeklyStat {
  /** Lundi de la semaine, au format ISO 'YYYY-MM-DD'. */
  weekStart: string;
  totalVolume: number;
  sessionCount: number;
}

export interface PersonalRecord {
  exerciseName: string;
  maxWeight: number;
}

export interface MuscleGroupVolume {
  muscleGroup: string; // clé (ex 'PECTORAUX') ou 'AUTRE' pour les exercices personnalisés
  label: string; // libellé FR affiché
  volume: number;
}

export interface StrengthCurvePoint {
  date: string;
  estimated1RM: number;
}

export interface StrengthCurve {
  exerciseId: number;
  exerciseName: string;
  points: StrengthCurvePoint[];
}

export interface DashboardSummary {
  totalVolumeAllTime: number;
  totalSessions: number;
  /** Nombre de semaines consécutives (en comptant la semaine en cours) avec au moins 1 séance. */
  streakWeeks: number;
  weeklyStats: WeeklyStat[];
  personalRecords: PersonalRecord[];
  /** Phrase courte calculée (pas d'IA, juste une comparaison de volume) pour motiver. */
  insightText: string;
  /** Répartition du volume des 4 dernières semaines par groupe musculaire. */
  volumeByMuscleGroup: MuscleGroupVolume[];
  /** Force estimée (formule Epley) dans le temps, pour chaque exercice barre libre du catalogue. */
  strengthCurves: StrengthCurve[];
}

const MUSCLE_GROUP_LABEL: Record<string, string> = {
  PECTORAUX: 'Pectoraux',
  DOS: 'Dos',
  EPAULES: 'Épaules',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  QUADRICEPS: 'Quadriceps',
  ISCHIOS: 'Ischios',
  MOLLETS: 'Mollets',
  AUTRE: 'Autre',
};

// Formate une date en 'YYYY-MM-DD' à partir de ses composantes LOCALES (jamais toISOString,
// qui convertit en UTC : sur un fuseau horaire en avance sur UTC (ex. Europe/Paris), minuit
// local round-trippé par toISOString() retombe sur la veille — et comme cette conversion était
// appelée deux fois de suite (une fois dans getWeekStartISO, une fois de plus dans la boucle
// des ancres), le décalage s'accumulait et empêchait toute correspondance entre les semaines.
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Lundi de la semaine contenant la date donnée (format 'YYYY-MM-DD'), en heure locale. */
function getWeekStartISO(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = dimanche .. 6 = samedi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return formatLocalDate(d);
}

function buildWeeklyStats(
  rawLogs: { date: string; workoutId: number; weight: number; repsDone: number }[],
  weeksCount: number
): WeeklyStat[] {
  const byWeek = new Map<string, { totalVolume: number; sessionKeys: Set<string> }>();

  for (const log of rawLogs) {
    const weekStart = getWeekStartISO(log.date);
    if (!byWeek.has(weekStart)) {
      byWeek.set(weekStart, { totalVolume: 0, sessionKeys: new Set() });
    }
    const bucket = byWeek.get(weekStart)!;
    bucket.totalVolume += log.weight * log.repsDone;
    bucket.sessionKeys.add(`${log.date}_${log.workoutId}`);
  }

  // Génère les N dernières semaines (y compris celles sans séance, à 0), de la plus
  // ancienne à la plus récente, pour un axe continu sur le graphique.
  const currentWeekStart = getWeekStartISO(formatLocalDate(new Date()));
  const weeks: WeeklyStat[] = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() - i * 7);
    const weekStart = formatLocalDate(d);
    const bucket = byWeek.get(weekStart);
    weeks.push({
      weekStart,
      totalVolume: bucket ? Math.round(bucket.totalVolume) : 0,
      sessionCount: bucket ? bucket.sessionKeys.size : 0,
    });
  }
  return weeks;
}

function computeStreakWeeks(weeklyStats: WeeklyStat[]): number {
  if (weeklyStats.length === 0) return 0;
  const weeks = [...weeklyStats];
  // La semaine en cours n'est peut-être pas terminée : si elle est vide, elle ne casse pas
  // une série déjà entamée, elle est juste ignorée du décompte.
  if (weeks[weeks.length - 1].sessionCount === 0) weeks.pop();

  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].sessionCount > 0) streak++;
    else break;
  }
  return streak;
}

function buildInsightText(weeklyStats: WeeklyStat[]): string {
  if (weeklyStats.length < 4) {
    return 'Continue à enregistrer tes séances pour voir ta progression apparaître ici !';
  }

  const last2 = weeklyStats.slice(-2);
  const prev2 = weeklyStats.slice(-4, -2);
  const lastVolume = last2.reduce((sum, w) => sum + w.totalVolume, 0);
  const prevVolume = prev2.reduce((sum, w) => sum + w.totalVolume, 0);

  if (prevVolume === 0) {
    return lastVolume > 0
      ? 'Belle reprise ! Continue sur cette lancée.'
      : 'Continue à enregistrer tes séances pour voir ta progression apparaître ici !';
  }

  const changePercent = Math.round(((lastVolume - prevVolume) / prevVolume) * 100);
  if (changePercent >= 10) return `Volume en hausse de ${changePercent}% sur les 2 dernières semaines !`;
  if (changePercent <= -15) return `Volume en baisse de ${Math.abs(changePercent)}% sur 2 semaines — une séance de plus cette semaine ?`;
  return 'Volume stable sur les 2 dernières semaines — régularité au rendez-vous.';
}

/** Volume total (kg) par groupe musculaire, sur les lignes dont la date >= sinceDate. */
function buildVolumeByMuscleGroup(
  rows: { date: string; muscleGroup: string | null; weight: number; repsDone: number }[],
  sinceDate: string
): MuscleGroupVolume[] {
  const byGroup = new Map<string, number>();
  for (const r of rows) {
    if (r.date < sinceDate) continue;
    const key = r.muscleGroup || 'AUTRE';
    byGroup.set(key, (byGroup.get(key) || 0) + r.weight * r.repsDone);
  }
  return Array.from(byGroup.entries())
    .map(([muscleGroup, volume]) => ({
      muscleGroup,
      label: MUSCLE_GROUP_LABEL[muscleGroup] || muscleGroup,
      volume: Math.round(volume),
    }))
    .sort((a, b) => b.volume - a.volume);
}

/**
 * Force estimée (formule Epley : poids × (1 + reps/30)) par exercice barre libre, un point par
 * date (la meilleure série de la séance), limité aux `pointsPerExercise` séances les plus
 * récentes pour rester lisible sur le graphique.
 */
function buildStrengthCurves(
  rows: { date: string; exerciseId: number; exerciseName: string; category: string | null; weight: number; repsDone: number }[],
  pointsPerExercise: number = 8
): StrengthCurve[] {
  const byExercise = new Map<number, { exerciseName: string; byDate: Map<string, number> }>();
  for (const r of rows) {
    if (r.category !== 'FREE_WEIGHT') continue;
    if (!byExercise.has(r.exerciseId)) {
      byExercise.set(r.exerciseId, { exerciseName: r.exerciseName, byDate: new Map() });
    }
    const bucket = byExercise.get(r.exerciseId)!;
    const estimated1RM = r.weight * (1 + r.repsDone / 30);
    bucket.byDate.set(r.date, Math.max(bucket.byDate.get(r.date) || 0, estimated1RM));
  }

  return Array.from(byExercise.entries()).map(([exerciseId, { exerciseName, byDate }]) => ({
    exerciseId,
    exerciseName,
    points: Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-pointsPerExercise)
      .map(([date, estimated1RM]) => ({ date, estimated1RM: Math.round(estimated1RM * 10) / 10 })),
  }));
}

export function getDashboardSummary(weeksCount: number = 10): DashboardSummary {
  let rawLogs: { date: string; workoutId: number; weight: number; repsDone: number }[];
  let prRows: { exercise_name: string; max_weight: number }[];
  let fullRows: { date: string; exerciseId: number; exerciseName: string; muscleGroup: string | null; category: string | null; weight: number; repsDone: number }[];

  if (!db || Platform.OS === 'web') {
    rawLogs = memoryLogs.map((l) => ({ date: l.date, workoutId: l.workoutId, weight: l.weight, repsDone: l.repsDone }));
    const maxByExercise = new Map<string, number>();
    for (const l of memoryLogs) {
      maxByExercise.set(l.exerciseName, Math.max(maxByExercise.get(l.exerciseName) || 0, l.weight));
    }
    prRows = Array.from(maxByExercise.entries()).map(([exercise_name, max_weight]) => ({ exercise_name, max_weight }));

    const seedMetaById = new Map(SEED_EXERCISES.map((ex) => [ex.id, ex]));
    fullRows = memoryLogs.map((l) => {
      const meta = seedMetaById.get(l.exerciseId);
      const category = meta?.category ?? memoryExercises.find((e) => e.id === l.exerciseId)?.category ?? null;
      return {
        date: l.date,
        exerciseId: l.exerciseId,
        exerciseName: l.exerciseName,
        muscleGroup: meta?.muscleGroup ?? null,
        category,
        weight: l.weight,
        repsDone: l.repsDone,
      };
    });
  } else {
    try {
      rawLogs = db
        .getAllSync<{ date: string; workout_id: number; weight: number; reps_done: number }>(
          'SELECT date, workout_id, weight, reps_done FROM workout_logs;'
        )
        .map((r) => ({ date: r.date, workoutId: r.workout_id, weight: r.weight, repsDone: r.reps_done }));

      prRows = db.getAllSync<{ exercise_name: string; max_weight: number }>(
        'SELECT exercise_name, MAX(weight) as max_weight FROM workout_logs GROUP BY exercise_name ORDER BY max_weight DESC LIMIT 5;'
      );

      fullRows = db
        .getAllSync<{
          date: string;
          exercise_id: number;
          exercise_name: string;
          muscle_group: string | null;
          category: string | null;
          weight: number;
          reps_done: number;
        }>(
          `SELECT l.date, l.exercise_id, l.exercise_name, e.muscle_group, e.category, l.weight, l.reps_done
           FROM workout_logs l
           LEFT JOIN exercises e ON e.id = l.exercise_id;`
        )
        .map((r) => ({
          date: r.date,
          exerciseId: r.exercise_id,
          exerciseName: r.exercise_name,
          muscleGroup: r.muscle_group,
          category: r.category,
          weight: r.weight,
          repsDone: r.reps_done,
        }));
    } catch (error) {
      console.error('Erreur getDashboardSummary:', error);
      rawLogs = [];
      prRows = [];
      fullRows = [];
    }
  }

  const weeklyStats = buildWeeklyStats(rawLogs, weeksCount);
  const sessionKeys = new Set(rawLogs.map((l) => `${l.date}_${l.workoutId}`));
  const totalVolumeAllTime = Math.round(rawLogs.reduce((sum, l) => sum + l.weight * l.repsDone, 0));

  prRows.sort((a, b) => b.max_weight - a.max_weight);

  // Fenêtre des 4 dernières semaines (28 jours glissants) pour la répartition par groupe
  // musculaire — une photo de l'équilibre d'entraînement récent, pas un cumul depuis le début.
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const sinceDate = formatLocalDate(fourWeeksAgo);

  return {
    totalVolumeAllTime,
    totalSessions: sessionKeys.size,
    streakWeeks: computeStreakWeeks(weeklyStats),
    weeklyStats,
    personalRecords: prRows.slice(0, 5).map((r) => ({ exerciseName: r.exercise_name, maxWeight: r.max_weight })),
    insightText: buildInsightText(weeklyStats),
    volumeByMuscleGroup: buildVolumeByMuscleGroup(fullRows, sinceDate),
    strengthCurves: buildStrengthCurves(fullRows),
  };
}

// ---------------------------------------------------------------------------
// Export de l'historique (fichier texte à partager/sauvegarder).
// ---------------------------------------------------------------------------

export interface ExportSessionSet {
  weight: number;
  repsDone: number;
  feeling: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface ExportSessionExercise {
  exerciseName: string;
  sets: ExportSessionSet[];
}

export interface ExportSession {
  date: string;
  workoutId: number;
  exercises: ExportSessionExercise[];
}

/**
 * Toutes les séances, triées de la plus récente à la plus ancienne, avec pour chaque
 * séance ses exercices DANS L'ORDRE où ils ont été faits (ordre d'insertion des logs),
 * chacun avec la liste de ses séries. Sert de base à l'export texte de l'historique.
 */
export function getAllSessionsForExport(): ExportSession[] {
  let rows: {
    id: number;
    date: string;
    workout_id: number;
    exercise_name: string;
    weight: number;
    reps_done: number;
    feeling: 'EASY' | 'MEDIUM' | 'HARD';
  }[];

  if (!db || Platform.OS === 'web') {
    rows = memoryLogs.map((l, idx) => ({
      id: idx,
      date: l.date,
      workout_id: l.workoutId,
      exercise_name: l.exerciseName,
      weight: l.weight,
      reps_done: l.repsDone,
      feeling: l.feeling,
    }));
  } else {
    try {
      rows = db.getAllSync(
        'SELECT id, date, workout_id, exercise_name, weight, reps_done, feeling FROM workout_logs ORDER BY date DESC, id ASC;'
      );
    } catch (error) {
      console.error('Erreur getAllSessionsForExport:', error);
      rows = [];
    }
  }

  const sessionMap = new Map<string, ExportSession>();
  const sessionOrder: string[] = [];

  for (const r of rows) {
    const key = `${r.date}_${r.workout_id}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { date: r.date, workoutId: r.workout_id, exercises: [] });
      sessionOrder.push(key);
    }
    const session = sessionMap.get(key)!;

    let ex = session.exercises.find((e) => e.exerciseName === r.exercise_name);
    if (!ex) {
      ex = { exerciseName: r.exercise_name, sets: [] };
      session.exercises.push(ex);
    }
    ex.sets.push({ weight: r.weight, repsDone: r.reps_done, feeling: r.feeling });
  }

  return sessionOrder.map((k) => sessionMap.get(k)!);
}
