// Tests du reliage historique ↔ catalogue. Lancer : npm run test:engine (Node 22.18+).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISE_ALIASES,
  exerciseKey,
  groupSessionsByDate,
  planRelink,
  resolveExerciseLink,
} from '../exerciseLinks.ts';
import { exerciseKey as statsExerciseKey } from '../../utils/progressStats.ts';
import { replayHistory } from '../../engine/progressionV2.ts';

const catalog = [
  { id: 3, name: 'HS Iso-Lateral Decline Press' },
  { id: 4, name: 'HS Iso-Lateral Shoulder Press' },
  { id: 7, name: 'HS Iso-Lateral Low Row' },
  { id: 11, name: 'HS Iso-Lateral Leg Extension' },
  { id: 12, name: 'HS Iso-Lateral Leg Curl' },
  { id: 14, name: 'Squat barre libre (Finisher)' },
  { id: 15, name: 'Extension triceps à la poulie' },
  { id: 16, name: 'Élévations latérales à la poulie' },
  { id: 17, name: 'Face Pull à la poulie' },
  { id: 18, name: 'Curl biceps à la poulie' },
];

// --- Résolution d'un nom ---

test('nom exact du catalogue : son id et son nom', () => {
  assert.deepEqual(resolveExerciseLink('HS Iso-Lateral Decline Press', catalog), { exerciseId: 3, exerciseName: 'HS Iso-Lateral Decline Press' });
});

test('majuscules et espaces ignorés, nom remis à celui du catalogue', () => {
  assert.deepEqual(resolveExerciseLink('  squat  BARRE libre (finisher) ', catalog), { exerciseId: 14, exerciseName: 'Squat barre libre (Finisher)' });
});

test('anciens noms rattachés à l’exercice actuel', () => {
  assert.equal(resolveExerciseLink('Leg curl', catalog).exerciseId, 12);
  assert.equal(resolveExerciseLink('Leg extension', catalog).exerciseId, 11);
  assert.deepEqual(resolveExerciseLink('face pull', catalog), { exerciseId: 17, exerciseName: 'Face Pull à la poulie' });
});

test('nom absent du catalogue : id 0, nom d’origine inchangé', () => {
  assert.deepEqual(resolveExerciseLink('HS Iso-Lateral High Row', catalog), { exerciseId: 0, exerciseName: 'HS Iso-Lateral High Row' });
});

test('ancien nom dont l’exercice actuel n’est plus au catalogue : id 0', () => {
  const sansLegCurl = catalog.filter((e) => e.id !== 12);
  assert.deepEqual(resolveExerciseLink('Leg curl', sansLegCurl), { exerciseId: 0, exerciseName: 'Leg curl' });
});

test('doublon de nom au catalogue : le plus petit id l’emporte', () => {
  const avecDoublon = [{ id: 10001, name: 'HS Iso-Lateral Low Row' }, ...catalog];
  assert.equal(resolveExerciseLink('HS Iso-Lateral Low Row', avecDoublon).exerciseId, 7);
});

test('même normalisation que les statistiques du tableau de bord', () => {
  for (const name of ['  Face  Pull à la POULIE ', 'Élévations latérales', 'leg curl', ...Object.keys(EXERCISE_ALIASES)]) {
    assert.equal(exerciseKey(name), statsExerciseKey(name));
  }
});

// --- Plan de reliage de l'historique ---

// Les cas réels : id 0 alors que le nom existe, ids réattribués, exercice disparu.
const logs = [
  { id: 1, exercise_id: 0, exercise_name: 'HS Iso-Lateral Decline Press' },
  { id: 2, exercise_id: 0, exercise_name: 'HS Iso-Lateral Shoulder Press' },
  { id: 3, exercise_id: 0, exercise_name: 'Squat barre libre (Finisher)' },
  { id: 4, exercise_id: 15, exercise_name: 'Leg curl' },
  { id: 5, exercise_id: 16, exercise_name: 'Leg extension' },
  { id: 6, exercise_id: 18, exercise_name: 'face pull' },
  { id: 7, exercise_id: 8, exercise_name: 'HS Iso-Lateral High Row' },
  { id: 8, exercise_id: 15, exercise_name: 'Extension triceps à la poulie' }, // déjà juste
  { id: 9, exercise_id: 0, exercise_name: 'Mon exercice perso supprimé' }, // déjà juste
];

test('reliage : chaque ligne fausse est corrigée, les justes ne bougent pas', () => {
  const plan = planRelink(logs, catalog);
  assert.deepEqual(plan, [
    { id: 1, exerciseId: 3, exerciseName: 'HS Iso-Lateral Decline Press' },
    { id: 2, exerciseId: 4, exerciseName: 'HS Iso-Lateral Shoulder Press' },
    { id: 3, exerciseId: 14, exerciseName: 'Squat barre libre (Finisher)' },
    { id: 4, exerciseId: 12, exerciseName: 'HS Iso-Lateral Leg Curl' },
    { id: 5, exerciseId: 11, exerciseName: 'HS Iso-Lateral Leg Extension' },
    { id: 6, exerciseId: 17, exerciseName: 'Face Pull à la poulie' },
    { id: 7, exerciseId: 0, exerciseName: 'HS Iso-Lateral High Row' },
  ]);
});

test('reliage : relancer après application ne change plus rien', () => {
  const applied = logs.map((row) => {
    const change = planRelink([row], catalog)[0];
    return change ? { ...row, exercise_id: change.exerciseId, exercise_name: change.exerciseName } : row;
  });
  assert.deepEqual(planRelink(applied, catalog), []);
});

// --- Du reliage au moteur ---

test('séances regroupées par date, dans l’ordre chronologique', () => {
  const sessions = groupSessionsByDate([
    { date: '2026-10-16', weight: 65, reps_done: 8, marked_easy: 0 },
    { date: '2026-10-12', weight: 60, reps_done: 8, marked_easy: 0 },
    { date: '2026-10-16', weight: 65, reps_done: 8, marked_easy: 1 },
  ]);
  assert.deepEqual(sessions.map((s) => s.date), ['2026-10-12', '2026-10-16']);
  assert.equal(sessions[1].sets.length, 2);
  assert.equal(sessions[1].easy, true);
});

const settings = { mode: 'CHARGE', targetSets: 3, repsMin: 8, repsMax: 8, incrementKg: 2.5, minWeightKg: 0, restSeconds: 90 };
const neverDone = { currentWeight: 62.5, currentTargetReps: 8, consecutiveFailures: 0, sessionsWithoutSuccess: 0, lastSessionDate: null, lastDecisionReason: null, isCalibrating: false };

test('séance retrouvée par le reliage : l’exercice est enfin calibré dessus', () => {
  const rows = [
    { date: '2026-10-12', weight: 70, reps_done: 8, marked_easy: 0 },
    { date: '2026-10-12', weight: 60, reps_done: 8, marked_easy: 0 },
    { date: '2026-10-12', weight: 80, reps_done: 8, marked_easy: 0 },
  ];
  const state = replayHistory(settings, neverDone, groupSessionsByDate(rows));
  assert.equal(state.lastSessionDate, '2026-10-12');
  assert.equal(state.isCalibrating, false);
  assert.equal(state.currentWeight, 80); // aucune charge ne domine : la plus lourde (règle conservée)
});
