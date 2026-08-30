import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { ConfiguredExercise, EquipmentCategory, Exercise, Workout, WorkoutLogEntry } from '../types';
import { SEED_EXERCISES, SEED_WORKOUTS } from './seed';

let db: SQLite.SQLiteDatabase | null = null;

let memoryLogs: WorkoutLogEntry[] = [];
let memoryExercises: (Exercise & { plannedWeights: number[]; consecutiveFailures: number; numSets: number })[] = [];

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

    const workoutCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM workouts;');
    if (!workoutCount || workoutCount.count === 0) {
      for (const w of SEED_WORKOUTS) {
        db.runSync(
          'INSERT INTO workouts (id, name, description) VALUES (?, ?, ?);',
          [w.id, w.name, w.description || '']
        );
      }

      for (const ex of SEED_EXERCISES) {
        db.runSync(
          `INSERT INTO exercises 
          (id, workout_id, name, category, min_increment, base_weight, order_index, default_target_reps, default_starting_weight, default_sets_count) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
          ]
        );

        const initialWeights = JSON.stringify([
          ex.defaultStartingWeight,
          ex.defaultStartingWeight,
          ex.defaultStartingWeight,
        ]);

        db.runSync(
          'INSERT INTO exercise_progression_state (exercise_id, planned_weights, consecutive_failures) VALUES (?, ?, 0);',
          [ex.id, initialWeights]
        );
      }
    }
  } catch (error) {
    console.warn('Erreur initialisation SQLite, utilisation du mode mémoire de secours:', error);
    initMemoryFallback();
  }
}

function initMemoryFallback() {
  if (memoryExercises.length === 0) {
    memoryExercises = SEED_EXERCISES.map((ex) => ({
      ...ex,
      plannedWeights: [ex.defaultStartingWeight, ex.defaultStartingWeight, ex.defaultStartingWeight],
      consecutiveFailures: 0,
      numSets: ex.defaultSetsCount || 3,
    }));
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

export function getExercisesForWorkout(workoutId: number): ConfiguredExercise[] {
  if (!db || Platform.OS === 'web') {
    return memoryExercises
      .filter((e) => e.workoutId === workoutId)
      .map((e) => ({
        id: e.id,
        workoutId: e.workoutId,
        name: e.name,
        category: e.category,
        minIncrement: e.minIncrement,
        baseWeight: e.baseWeight,
        targetReps: e.defaultTargetReps,
        numSets: e.numSets || 3,
        plannedWeights: e.plannedWeights || [e.defaultStartingWeight, e.defaultStartingWeight, e.defaultStartingWeight],
        consecutiveFailures: e.consecutiveFailures || 0,
      }));
  }

  try {
    const rows = db.getAllSync<{
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
      planned_weights: string | null;
      consecutive_failures: number | null;
    }>(
      `SELECT e.*, p.planned_weights, p.consecutive_failures
       FROM exercises e
       LEFT JOIN exercise_progression_state p ON e.id = p.exercise_id
       WHERE e.workout_id = ?
       ORDER BY e.order_index ASC;`,
      [workoutId]
    );

    return rows.map((r) => {
      const numSets = r.default_sets_count || 3;
      let planned: number[] = Array(numSets).fill(r.default_starting_weight);
      if (r.planned_weights) {
        try {
          const parsed = JSON.parse(r.planned_weights);
          if (Array.isArray(parsed) && parsed.length > 0) {
            planned = parsed;
          }
        } catch {}
      }

      return {
        id: r.id,
        workoutId: r.workout_id,
        name: r.name,
        category: r.category,
        minIncrement: r.min_increment,
        baseWeight: r.base_weight,
        targetReps: r.default_target_reps,
        numSets,
        plannedWeights: planned,
        consecutiveFailures: r.consecutive_failures || 0,
      };
    });
  } catch (error) {
    console.error('Erreur getExercisesForWorkout:', error);
    return memoryExercises
      .filter((e) => e.workoutId === workoutId)
      .map((e) => ({
        id: e.id,
        workoutId: e.workoutId,
        name: e.name,
        category: e.category,
        minIncrement: e.minIncrement,
        baseWeight: e.baseWeight,
        targetReps: e.defaultTargetReps,
        numSets: e.numSets || 3,
        plannedWeights: e.plannedWeights,
        consecutiveFailures: e.consecutiveFailures || 0,
      }));
  }
}

export function getAllCatalogExercises(workoutId?: number): ConfiguredExercise[] {
  if (!db || Platform.OS === 'web') {
    const list = workoutId ? memoryExercises.filter((e) => e.workoutId === workoutId) : memoryExercises;
    return list.map((e) => ({
      id: e.id,
      workoutId: e.workoutId,
      name: e.name,
      category: e.category,
      minIncrement: e.minIncrement,
      baseWeight: e.baseWeight,
      targetReps: e.defaultTargetReps,
      numSets: e.numSets || 3,
      plannedWeights: e.plannedWeights || [e.defaultStartingWeight, e.defaultStartingWeight, e.defaultStartingWeight],
      consecutiveFailures: e.consecutiveFailures || 0,
    }));
  }

  try {
    const query = workoutId
      ? `SELECT e.*, p.planned_weights, p.consecutive_failures
         FROM exercises e
         LEFT JOIN exercise_progression_state p ON e.id = p.exercise_id
         WHERE e.workout_id = ?
         ORDER BY e.name ASC;`
      : `SELECT e.*, p.planned_weights, p.consecutive_failures
         FROM exercises e
         LEFT JOIN exercise_progression_state p ON e.id = p.exercise_id
         ORDER BY e.workout_id ASC, e.order_index ASC;`;

    const params = workoutId ? [workoutId] : [];
    const rows = db.getAllSync<{
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
      planned_weights: string | null;
      consecutive_failures: number | null;
    }>(query, params);

    return rows.map((r) => {
      const numSets = r.default_sets_count || 3;
      let planned: number[] = Array(numSets).fill(r.default_starting_weight);
      if (r.planned_weights) {
        try {
          const parsed = JSON.parse(r.planned_weights);
          if (Array.isArray(parsed) && parsed.length > 0) {
            planned = parsed;
          }
        } catch {}
      }

      return {
        id: r.id,
        workoutId: r.workout_id,
        name: r.name,
        category: r.category,
        minIncrement: r.min_increment,
        baseWeight: r.base_weight,
        targetReps: r.default_target_reps,
        numSets,
        plannedWeights: planned,
        consecutiveFailures: r.consecutive_failures || 0,
      };
    });
  } catch (error) {
    console.error('Erreur getAllCatalogExercises:', error);
    return [];
  }
}

export function updateExerciseCustomSettings(
  exerciseId: number,
  plannedWeights: number[],
  targetReps: number,
  numSets: number
): void {
  const defaultWeight = plannedWeights[0] || 40;
  const plannedJson = JSON.stringify(plannedWeights);

  if (!db || Platform.OS === 'web') {
    const ex = memoryExercises.find((e) => e.id === exerciseId);
    if (ex) {
      ex.defaultStartingWeight = defaultWeight;
      ex.defaultTargetReps = targetReps;
      ex.numSets = numSets;
      ex.plannedWeights = plannedWeights;
    }
    return;
  }

  try {
    db.runSync(
      `UPDATE exercises 
       SET default_starting_weight = ?, default_target_reps = ?, default_sets_count = ?
       WHERE id = ?;`,
      [defaultWeight, targetReps, numSets, exerciseId]
    );

    db.runSync(
      `INSERT INTO exercise_progression_state (exercise_id, planned_weights, consecutive_failures)
       VALUES (?, ?, 0)
       ON CONFLICT(exercise_id) DO UPDATE SET
         planned_weights = excluded.planned_weights;`,
      [exerciseId, plannedJson]
    );
  } catch (error) {
    console.error('Erreur updateExerciseCustomSettings:', error);
  }
}

export function updateExerciseFullDetails(
  exerciseId: number,
  workoutId: number,
  name: string,
  category: EquipmentCategory,
  plannedWeights: number[],
  targetReps: number,
  numSets: number
): void {
  const defaultWeight = plannedWeights[0] || 40;
  const baseWeight = category === 'FREE_WEIGHT' ? 20 : 0;
  const plannedJson = JSON.stringify(plannedWeights);

  if (!db || Platform.OS === 'web') {
    const ex = memoryExercises.find((e) => e.id === exerciseId);
    if (ex) {
      ex.workoutId = workoutId;
      ex.name = name;
      ex.category = category;
      ex.baseWeight = baseWeight;
      ex.defaultStartingWeight = defaultWeight;
      ex.defaultTargetReps = targetReps;
      ex.numSets = numSets;
      ex.plannedWeights = plannedWeights;
    }
    return;
  }

  try {
    db.runSync(
      `UPDATE exercises 
       SET workout_id = ?, name = ?, category = ?, base_weight = ?, default_starting_weight = ?, default_target_reps = ?, default_sets_count = ?
       WHERE id = ?;`,
      [workoutId, name, category, baseWeight, defaultWeight, targetReps, numSets, exerciseId]
    );

    db.runSync(
      `INSERT INTO exercise_progression_state (exercise_id, planned_weights, consecutive_failures)
       VALUES (?, ?, 0)
       ON CONFLICT(exercise_id) DO UPDATE SET
         planned_weights = excluded.planned_weights;`,
      [exerciseId, plannedJson]
    );
  } catch (error) {
    console.error('Erreur updateExerciseFullDetails:', error);
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
  const newPlanned = Array(setsCount).fill(startingWeight);
  const plannedJson = JSON.stringify(newPlanned);

  if (!db || Platform.OS === 'web') {
    const newId = Date.now();
    const created: ConfiguredExercise = {
      id: newId,
      workoutId,
      name,
      category,
      minIncrement: 2.5,
      baseWeight,
      targetReps,
      numSets: setsCount,
      plannedWeights: newPlanned,
      consecutiveFailures: 0,
    };
    memoryExercises.push({
      id: newId,
      workoutId,
      name,
      category,
      minIncrement: 2.5,
      baseWeight,
      orderIndex: memoryExercises.length + 1,
      defaultTargetReps: targetReps,
      defaultStartingWeight: startingWeight,
      defaultSetsCount: setsCount,
      consecutiveFailures: 0,
      numSets: setsCount,
      plannedWeights: newPlanned,
    });
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
      (workout_id, name, category, min_increment, base_weight, order_index, default_target_reps, default_starting_weight, default_sets_count)
      VALUES (?, ?, ?, 2.5, ?, ?, ?, ?, ?);`,
      [workoutId, name, category, baseWeight, nextOrder, targetReps, startingWeight, setsCount]
    );

    const newExerciseId = result.lastInsertRowId;
    db.runSync(
      `INSERT INTO exercise_progression_state (exercise_id, planned_weights, consecutive_failures)
       VALUES (?, ?, 0);`,
      [newExerciseId, plannedJson]
    );

    return {
      id: newExerciseId,
      workoutId,
      name,
      category,
      minIncrement: 2.5,
      baseWeight,
      targetReps,
      numSets: setsCount,
      plannedWeights: newPlanned,
      consecutiveFailures: 0,
    };
  } catch (error) {
    console.error('Erreur addCustomExercise:', error);
    return {
      id: Date.now(),
      workoutId,
      name,
      category,
      minIncrement: 2.5,
      baseWeight,
      targetReps,
      numSets: setsCount,
      plannedWeights: newPlanned,
      consecutiveFailures: 0,
    };
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
        (workout_id, exercise_id, exercise_name, date, set_number, weight, reps_target, reps_done, feeling)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        ]
      );
    }
  } catch (error) {
    console.error('Erreur saveWorkoutLogs:', error);
  }
}

export function updateExerciseProgression(
  exerciseId: number,
  nextWeights: number[],
  consecutiveFailures: number
): void {
  if (!db || Platform.OS === 'web') {
    const ex = memoryExercises.find((e) => e.id === exerciseId);
    if (ex) {
      ex.plannedWeights = nextWeights;
      ex.consecutiveFailures = consecutiveFailures;
    }
    return;
  }

  try {
    const weightsJson = JSON.stringify(nextWeights);
    db.runSync(
      `INSERT INTO exercise_progression_state (exercise_id, planned_weights, consecutive_failures)
       VALUES (?, ?, ?)
       ON CONFLICT(exercise_id) DO UPDATE SET
         planned_weights = excluded.planned_weights,
         consecutive_failures = excluded.consecutive_failures;`,
      [exerciseId, weightsJson, consecutiveFailures]
    );
  } catch (error) {
    console.error('Erreur updateExerciseProgression:', error);
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
