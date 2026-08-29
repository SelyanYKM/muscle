export type Feeling = 'EASY' | 'MEDIUM' | 'HARD';

export type EquipmentCategory = 'HAMMER_STRENGTH' | 'FREE_WEIGHT';

export interface Exercise {
  id: number;
  workoutId: number;
  name: string;
  category: EquipmentCategory;
  minIncrement: number; // default 2.5
  baseWeight: number; // 0 for plate-loaded machines, 20 for barbell
  orderIndex: number;
  defaultTargetReps: number; // default 8
  defaultStartingWeight: number; // default e.g. 40kg
  defaultSetsCount?: number; // default 3
}

export interface ConfiguredExercise {
  id: number;
  workoutId: number;
  name: string;
  category: EquipmentCategory;
  minIncrement: number;
  baseWeight: number;
  targetReps: number;
  numSets: number;
  plannedWeights: number[];
  consecutiveFailures?: number;
}

export interface Workout {
  id: number;
  name: string; // 'Push' | 'Pull' | 'Legs'
  description?: string;
}

export interface SetResult {
  setNumber: number;
  targetReps: number;
  repsDone: number;
  weight: number;
  feeling: Feeling;
}

export interface NextSessionPlan {
  weightsPerSet: number[];
  progressionVerdict: 'FULL_INCREASE' | 'PARTIAL_INCREASE' | 'MAINTAIN' | 'DELOAD';
  message: string;
}

export interface WorkoutLogEntry {
  id?: number;
  workoutId: number;
  exerciseId: number;
  exerciseName: string;
  date: string; // ISO 'YYYY-MM-DD'
  setNumber: number;
  weight: number;
  repsTarget: number;
  repsDone: number;
  feeling: Feeling;
}

export interface SessionConfig {
  workoutId: number;
  workoutName: string;
  standardRestSeconds: number; // e.g. 90
  finisherRestSeconds: number; // e.g. 180
  configuredExercises: ConfiguredExercise[];
}

export interface PlateInfo {
  weight: number;
  count: number;
  color: string;
  textColor: string;
}
