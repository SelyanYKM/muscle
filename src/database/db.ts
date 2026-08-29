import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Exercise, Workout, WorkoutLogEntry } from '../types';
import { SEED_EXERCISES, SEED_WORKOUTS } from './seed';

let db: SQLite.SQLiteDatabase | null = null;

// Mémoire de secours pour l'environnement Web ou mock
let memoryLogs: WorkoutLogEntry[] = [];
let memoryExercises: (Exercise & { plannedWeights: number[]; consecutiveFailures: number })[] = [];

export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') {
    initMemoryFallback();
    return;
  }

  try {
    db = SQLite.openDatabaseSync('gym_progression.db');

    // 1. Table des types de séances (PPL)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
    `);

    // 2. Table du catalogue d'exercices
    db.execSync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY,
        workout_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        min_increment REAL DEFAULT 2.5,
        base_weight REAL DEFAULT 0,
        order_index INTEGER NOT NULL,
        default_target_reps INTEGER DEFAULT 8,
        default_starting_weight REAL DEFAULT 40,
        FOREIGN KEY (workout_id) REFERENCES workouts (id)
      );
    `);

    // 3. Table de l'état de progression courant (derniers poids calculés et compteur d'échecs)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS exercise_progression_state (
        exercise_id INTEGER PRIMARY KEY,
        planned_weights TEXT NOT NULL, -- JSON array ex: "[42.5, 40, 40]"
        consecutive_failures INTEGER DEFAULT 0,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );
    `);

    // 4. Table des logs de séries
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

    // Remplissage initial si vide
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
          (id, workout_id, name, category, min_increment, base_weight, order_index, default_target_reps, default_starting_weight) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
  memoryExercises = SEED_EXERCISES.map((ex) => ({
    ...ex,
    plannedWeights: [ex.defaultStartingWeight, ex.defaultStartingWeight, ex.defaultStartingWeight],
    consecutiveFailures: 0,
  }));
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

export function getExercisesForWorkout(workoutId: number): (Exercise & { plannedWeights: number[]; consecutiveFailures: number })[] {
  if (!db || Platform.OS === 'web') {
    return memoryExercises.filter((e) => e.workoutId === workoutId);
  }

  try {
    const rows = db.getAllSync<{
      id: number;
      workout_id: number;
      name: string;
      category: 'HAMMER_STRENGTH' | 'FREE_WEIGHT';
      min_increment: number;
      base_weight: number;
      order_index: number;
      default_target_reps: number;
      default_starting_weight: number;
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
      let planned: number[] = [r.default_starting_weight, r.default_starting_weight, r.default_starting_weight];
      if (r.planned_weights) {
        try {
          planned = JSON.parse(r.planned_weights);
        } catch {
          // fallback
        }
      }

      return {
        id: r.id,
        workoutId: r.workout_id,
        name: r.name,
        category: r.category,
        minIncrement: r.min_increment,
        baseWeight: r.base_weight,
        orderIndex: r.order_index,
        defaultTargetReps: r.default_target_reps,
        defaultStartingWeight: r.default_starting_weight,
        plannedWeights: planned,
        consecutiveFailures: r.consecutive_failures || 0,
      };
    });
  } catch (error) {
    console.error('Erreur getExercisesForWorkout:', error);
    return memoryExercises.filter((e) => e.workoutId === workoutId);
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

export function getRecentLogs(limit: number = 50): WorkoutLogEntry[] {
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
