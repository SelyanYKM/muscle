// Tests du moteur de progression. Lancer : npm run test:engine (Node 22.18+, aucune dépendance).
// Fichier .mjs pour rester hors du type-check de l'app ; Node importe le .ts directement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrescription,
  selectWorkingSets,
  suggestNextPrescription,
} from '../progressionV2.ts';

const settings = (o = {}) => ({
  mode: 'CHARGE', targetSets: 3, repsMin: 8, repsMax: 8, incrementKg: 2.5, minWeightKg: 0, restSeconds: 90, ...o,
});
const reps = (o = {}) => settings({ mode: 'REPS_PUIS_CHARGE', repsMax: 12, ...o });
const state = (o = {}) => ({
  currentWeight: 50, currentTargetReps: 8, consecutiveFailures: 0, sessionsWithoutSuccess: 0,
  lastSessionDate: '2026-10-20', lastDecisionReason: null, isCalibrating: false, ...o,
});
const day = (s) => new Date(`${s}T18:00:00`);
const sets = (...pairs) => pairs.map(([weight, r]) => ({ weight, reps: r }));
const x = (n, weight, r) => Array.from({ length: n }, () => ({ weight, reps: r }));
const run = (cfg, st, logged, date = '2026-10-23', easy = false, prev = null) =>
  suggestNextPrescription(cfg, st, { sets: logged, easy }, day(date), prev);

// --- Reprise après pause ---

test('pause de 20 j : la réduction est proposée AVANT la séance', () => {
  const p = getPrescription(settings(), state(), day('2026-11-09'));
  assert.equal(p.weight, 45);
  assert.equal(p.resumedAfterBreak, true);
});

test('pause de 20 j : la séance du retour est évaluée sur la charge réduite', () => {
  const d = run(settings(), state(), x(3, 45, 8), '2026-11-09');
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 47.5);
  assert.equal(d.resumedAfterBreak, true);
  assert.equal(d.newState.lastSessionDate, '2026-11-09');
  // La réduction n'est pas réappliquée à la séance suivante.
  assert.equal(getPrescription(settings(), d.newState, day('2026-11-12')).weight, 47.5);
});

test('pause : la charge d’avant, tenue au retour, est adoptée', () => {
  const d = run(settings(), state(), x(3, 50, 8), '2026-11-09');
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 52.5);
});

test('pause sur un exercice, mais entraînement récent : un cran de moins', () => {
  assert.equal(getPrescription(settings(), state(), day('2026-11-09'), '2026-11-06').weight, 50);
  assert.equal(getPrescription(settings(), state(), day('2026-12-05'), '2026-12-01').weight, 45);
  assert.equal(getPrescription(settings(), state(), day('2026-12-05')).weight, 40);
});

// --- Charge différente de la prescription ---

test('séries droites plus légères que prescrit : on suit la charge faite', () => {
  const d = run(settings(), state(), x(3, 45, 8));
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 47.5);
});

test('séries droites plus légères et faciles : la hausse ne dépasse pas la prescription', () => {
  const d = run(settings(), state(), x(3, 47.5, 10));
  assert.equal(d.nextWeight, 50);
});

test('séries droites plus légères en double progression : objectif repris d’après les reps faites', () => {
  const d = run(reps({ repsMin: 10, repsMax: 15 }), state({ currentWeight: 27.5, currentTargetReps: 10 }), x(3, 25, 11));
  assert.equal(d.nextWeight, 25);
  assert.equal(d.nextTargetReps, 12);
});

test('baisse en cours de séance (50, 50, 45, 45) : pas de hausse', () => {
  const d = run(settings({ targetSets: 4 }), state(), sets([50, 8], [50, 8], [45, 8], [45, 8]));
  assert.equal(d.status, 'REDUCED_LOAD');
  assert.equal(d.nextWeight, 50);
});

test('montée en charge 60/70/75 : pas de séries droites, pas de hausse', () => {
  const sel = selectWorkingSets(sets([60, 8], [70, 8], [75, 8]), 3, 75, 8);
  assert.equal(sel.pattern, 'MIXED');
  const d = run(settings(), state({ currentWeight: 75 }), sets([60, 8], [70, 8], [75, 8]));
  assert.equal(d.status, 'REDUCED_LOAD');
  assert.equal(d.nextWeight, 75);
});

test('première série plus légère puis deux à la charge prévue : charge maintenue', () => {
  const d = run(settings({ repsMin: 6, repsMax: 6 }), state({ currentWeight: 72.5, currentTargetReps: 6 }), sets([70, 6], [72.5, 6], [72.5, 5]));
  assert.equal(d.status, 'REDUCED_LOAD');
  assert.equal(d.nextWeight, 72.5);
});

test('dernière série tentée plus lourd et ratée : la tentative est ignorée', () => {
  const d = run(reps({ repsMin: 10, repsMax: 15 }), state({ currentWeight: 27.5, currentTargetReps: 10 }), sets([27.5, 10], [27.5, 10], [30, 2]));
  assert.equal(d.status, 'INCOMPLETE');
  assert.equal(d.nextWeight, 27.5);
  assert.equal(d.newState.consecutiveFailures, 0);
});

test('séance de 4 séries droites + série de retour au calme : la dernière est ignorée', () => {
  const d = run(settings({ repsMin: 6, repsMax: 6 }), state({ currentWeight: 117.5, currentTargetReps: 6 }), sets([120, 6], [120, 6], [120, 6], [100, 6]));
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 122.5);
});

test('série test plus lourde en premier : ignorée', () => {
  const d = run(settings(), state({ currentWeight: 75 }), sets([80, 3], [75, 8], [75, 8], [75, 8]));
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 77.5);
});

test('plus lourd que prescrit et tenu : nouvelle charge adoptée puis +1 palier', () => {
  const d = run(settings(), state(), x(3, 55, 8));
  assert.equal(d.nextWeight, 57.5);
});

test('plus lourd que prescrit, une série puis arrêt : rien n’est mémorisé', () => {
  const d = run(settings(), state(), sets([70, 3]));
  assert.equal(d.status, 'INCOMPLETE');
  assert.equal(d.nextWeight, 50);
});

test('plus lourd que prescrit et raté : retour à la prescription, compteurs intacts', () => {
  const d = run(settings(), state({ consecutiveFailures: 1 }), x(3, 60, 5));
  assert.equal(d.status, 'FAILED');
  assert.equal(d.nextWeight, 50);
  assert.equal(d.newState.consecutiveFailures, 1);
});

// --- Classification et décharge ---

test('8/7/7 sur 3×8 : « presque », charge maintenue, deux fois de suite sans décharge', () => {
  let d = run(settings(), state(), sets([50, 8], [50, 7], [50, 7]));
  assert.equal(d.status, 'PARTIAL');
  d = run(settings(), d.newState, sets([50, 8], [50, 7], [50, 7]), '2026-10-27');
  assert.equal(d.status, 'PARTIAL');
  assert.equal(d.nextWeight, 50);
  assert.equal(d.newState.consecutiveFailures, 0);
});

test('curl à l’échec 10/8/6 sur 3×8 : « presque »', () => {
  const d = run(reps(), state({ currentWeight: 12 }), sets([12, 10], [12, 8], [12, 6]));
  assert.equal(d.status, 'PARTIAL');
});

test('trois échecs francs : −10 %', () => {
  let s = state();
  const days = ['2026-10-23', '2026-10-27', '2026-10-30'];
  let d;
  for (const date of days) {
    d = run(settings(), s, sets([50, 8], [50, 5], [50, 5]), date);
    s = d.newState;
  }
  assert.equal(d.status, 'FAILED');
  assert.equal(d.nextWeight, 45);
  assert.equal(d.newState.consecutiveFailures, 0);
});

test('stagnation : quatre séances « presque » → −1 palier seulement', () => {
  let s = state();
  let d;
  for (const date of ['2026-10-21', '2026-10-23', '2026-10-27', '2026-10-30']) {
    d = run(settings(), s, sets([50, 8], [50, 8], [50, 7]), date);
    s = d.newState;
  }
  assert.equal(d.nextWeight, 47.5);
});

test('décharge arrondie au palier le plus proche (52,5 → 47,5)', () => {
  const d = run(settings(), state({ currentWeight: 52.5, consecutiveFailures: 2 }), x(3, 52.5, 4));
  assert.equal(d.nextWeight, 47.5);
});

// --- Progression ---

test('charge légère en mode CHARGE (8 kg, palier 2 kg) : les reps montent d’abord', () => {
  const cfg = settings({ incrementKg: 2 });
  let d = run(cfg, state({ currentWeight: 8 }), x(3, 8, 8));
  assert.equal(d.nextWeight, 8);
  assert.equal(d.nextTargetReps, 9);
  d = run(cfg, state({ currentWeight: 8, currentTargetReps: 12 }), x(3, 8, 12));
  assert.equal(d.nextWeight, 10);
  assert.equal(d.nextTargetReps, 8);
});

test('séance facile : +2 paliers seulement si ça reste sous +10 %', () => {
  assert.equal(run(settings(), state({ currentWeight: 40 }), x(3, 40, 8), undefined, true).nextWeight, 42.5);
  assert.equal(run(settings(), state({ currentWeight: 100 }), x(3, 100, 8), undefined, true).nextWeight, 105);
});

test('double progression : haut de plage atteint d’un coup → la charge monte', () => {
  const d = run(reps(), state({ currentWeight: 30, currentTargetReps: 9 }), x(3, 30, 12));
  assert.equal(d.nextWeight, 32.5);
  assert.equal(d.nextTargetReps, 8);
});

test('double progression : une rep de plus que la dernière perf', () => {
  const d = run(reps(), state({ currentWeight: 30 }), x(3, 30, 11));
  assert.equal(d.nextTargetReps, 12);
});

// --- Calibration ---

test('calibration 3×15 à 30 kg (plage 8-12) : 35 kg × 8', () => {
  const d = run(reps(), state({ isCalibrating: true, lastSessionDate: null }), x(3, 30, 15));
  assert.equal(d.status, 'CALIBRATION');
  assert.equal(d.nextWeight, 35);
  assert.equal(d.nextTargetReps, 8);
  assert.equal(d.newState.isCalibrating, false);
});

test('calibration dans la plage : on repart de ce qui a été fait', () => {
  const d = run(reps(), state({ isCalibrating: true, currentWeight: 12 }), x(3, 12, 10));
  assert.equal(d.nextWeight, 12);
  assert.equal(d.nextTargetReps, 10);
});

test('calibration en mode CHARGE : 3×12 à 40 kg pour un objectif de 8 → 42,5 kg', () => {
  const d = run(settings(), state({ isCalibrating: true }), x(3, 40, 12));
  assert.equal(d.nextWeight, 42.5);
  assert.equal(d.nextTargetReps, 8);
});

test('calibration : une tentative isolée plus lourde ne fausse pas l’estimation', () => {
  const d = run(reps({ repsMin: 10, repsMax: 15 }), state({ isCalibrating: true }), sets([27.5, 10], [27.5, 10], [30, 2]));
  assert.equal(d.nextWeight, 27.5);
  assert.equal(d.nextTargetReps, 10);
});

// --- Cas limites ---

test('aucune série : rien ne change, pas même la date', () => {
  const st = state();
  const d = run(settings(), st, []);
  assert.equal(d.status, 'SKIPPED');
  assert.deepEqual(d.newState, st);
});

test('aucune série en calibration : la calibration attend la vraie première séance', () => {
  const d = run(settings(), state({ isCalibrating: true }), []);
  assert.equal(d.status, 'SKIPPED');
  assert.equal(d.newState.isCalibrating, true);
});

test('réglages incohérents (0 série) : pas de « facile » fantôme', () => {
  const d = run(settings({ targetSets: 0 }), state(), x(1, 50, 8));
  assert.equal(d.status, 'SUCCESS');
  assert.equal(d.nextWeight, 52.5);
});
