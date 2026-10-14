export type Feeling = 'EASY' | 'MEDIUM' | 'HARD';

export type EquipmentCategory = 'HAMMER_STRENGTH' | 'FREE_WEIGHT' | 'CABLE';

// Mode de progression de l'algorithme v2 (double progression) — voir plus bas pour le détail.
export type ProgressionMode = 'CHARGE' | 'REPS_PUIS_CHARGE';

export interface Exercise {
  id: number;
  workoutId: number;
  name: string;
  category: EquipmentCategory;
  minIncrement: number; // default 2.5 (= palier_kg)
  baseWeight: number; // 0 for plate-loaded machines, 20 for barbell
  orderIndex: number;
  defaultTargetReps: number; // default 8 (= repsMin au premier lancement)
  defaultStartingWeight: number; // default e.g. 40kg
  defaultSetsCount?: number; // default 3
  mode?: ProgressionMode; // défaut CHARGE si absent
  repsMax?: number; // défaut = defaultTargetReps (mode CHARGE : repsMax = repsMin)
  minWeightKg?: number; // défaut = baseWeight
  restSeconds?: number; // défaut selon catégorie (poulie 60 / machine 90 / barre libre 150)
}

export interface ConfiguredExercise {
  id: number;
  workoutId: number;
  name: string;
  category: EquipmentCategory;
  minIncrement: number;
  baseWeight: number;
  numSets: number;
  // Réglages de progression (catalogue)
  mode: ProgressionMode;
  repsMin: number;
  repsMax: number;
  minWeightKg: number;
  restSeconds: number;
  // État mémorisé (séance à séance)
  currentWeight: number;
  currentTargetReps: number;
  consecutiveFailures: number;
  sessionsWithoutSuccess: number;
  lastSessionDate: string | null;
  lastDecisionReason: string | null;
  isCalibrating: boolean;
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

export type SessionMode = 'GUIDED' | 'FREE';

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
  /** Mode utilisé pour cette séance. Absent (null) sur les séances enregistrées avant son ajout. */
  mode?: SessionMode | null;
}

export interface PlateInfo {
  weight: number;
  count: number;
  color: string;
  textColor: string;
}

// --- Algorithme de suggestion de charges v2 (double progression) ---
// Remplace le moteur ressenti EASY/MEDIUM/HARD par une classification basée uniquement sur
// les répétitions réellement faites vs l'objectif, avec deux modes de progression par exercice.

export type SessionStatus =
  | 'EASY_SUCCESS' // Réussie facile : toutes les séries ≥ objectif, case "facile" (ou ≥ objectif+2 partout)
  | 'SUCCESS' // Réussie : toutes les séries ≥ objectif
  | 'PARTIAL' // Partielle : une seule série sous l'objectif
  | 'FAILED' // Ratée : deux séries ou plus sous l'objectif
  | 'CALIBRATION' // Première séance sur cet exercice : pas de statut, l'utilisateur choisit la charge
  | 'INCOMPLETE' // Moins de séries que l'objectif : séance non exploitable
  | 'RESUMED_AFTER_BREAK'; // Reprise après plus de 14/30 jours sans l'exercice

// Réglages par exercice (catalogue). minIncrement/baseWeight existent déjà sur Exercise ;
// ces champs s'y ajoutent pour piloter le nouveau moteur.
export interface ExerciseProgressionSettings {
  mode: ProgressionMode;
  targetSets: number; // series_cibles
  repsMin: number;
  repsMax: number; // = repsMin en mode CHARGE
  incrementKg: number; // palier_kg (= minIncrement)
  minWeightKg: number; // charge_min_kg (plancher, jamais en dessous)
  restSeconds: number; // repos_s, minuteur après chaque série de travail
}

// État mémorisé par exercice, entre deux séances.
export interface ExerciseProgressionState {
  currentWeight: number; // charge_actuelle
  currentTargetReps: number; // reps_cible_actuelle (utile en mode REPS_PUIS_CHARGE)
  consecutiveFailures: number; // echecs_consecutifs
  sessionsWithoutSuccess: number; // seances_sans_reussite
  lastSessionDate: string | null; // date_derniere_seance ('YYYY-MM-DD'), null = jamais fait
  lastDecisionReason: string | null; // raison de la dernière décision, pour affichage
  isCalibrating: boolean; // vrai tant qu'aucune séance n'a encore été classée sur cet exercice
}

// Une séance de travail sur un exercice (hors échauffement), telle que saisie par l'utilisateur.
export interface ProgressionSessionInput {
  reps: number[]; // répétitions par série de travail, à la charge prescrite
  weightUsed: number; // charge réellement utilisée (résolue si elle a varié en cours de séance)
  easy: boolean; // case "facile" cochée sur la dernière série
}

export interface ProgressionDecision {
  status: SessionStatus;
  nextWeight: number;
  nextTargetReps: number;
  reason: string;
  newState: ExerciseProgressionState;
}
