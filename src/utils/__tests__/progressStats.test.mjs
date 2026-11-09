// Tests des statistiques du tiroir « Ton progrès ». Lancer : npm run test:stats (Node 22.18+).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  averageSessionsPerWeek,
  buildCalendar,
  buildRestAdvice,
  consecutiveTrainingDays,
  daysSinceBySplit,
  energyTrend,
  daysSinceByMuscle,
  exerciseProgression,
  fanSelection,
  goalStreakWeeks,
  lastRestDay,
  progressSinceRestart,
  recordsWithRecent,
  restartDate,
  sessionsByDate,
  setsByMuscleThisWeek,
  volumeTrendPercent,
  weekStartOf,
} from '../progressStats.ts';

// Semaine type de la maquette : aujourd'hui dimanche 1er novembre 2026.
const TODAY = '2026-11-01';
const S = (date, workoutId) => ({ date, workoutId });
const sessions = [
  S('2026-10-12', 1), S('2026-10-14', 2), S('2026-10-16', 3),
  S('2026-10-19', 3), S('2026-10-20', 1), S('2026-10-21', 2), S('2026-10-23', 3), S('2026-10-24', 1),
  S('2026-10-26', 1), S('2026-10-27', 3), S('2026-10-29', 2), S('2026-10-30', 3), S('2026-10-31', 1),
];
const byDate = sessionsByDate(sessions);

test('weekStartOf : lundi de la semaine, dimanche compris', () => {
  assert.equal(weekStartOf('2026-11-01'), '2026-10-26');
  assert.equal(weekStartOf('2026-10-26'), '2026-10-26');
  assert.equal(weekStartOf('2026-10-31'), '2026-10-26');
});

test('buildCalendar : 8 semaines, la semaine en cours en dernier, aujourd’hui marqué', () => {
  const cal = buildCalendar(byDate, TODAY, 8);
  assert.equal(cal.length, 8);
  const last = cal[7];
  assert.equal(last.weekStart, '2026-10-26');
  assert.equal(last.sessionCount, 5);
  assert.deepEqual(last.days[0].workoutIds, [1]);
  assert.equal(last.days[6].isToday, true);
  assert.equal(last.days[6].workoutIds.length, 0);
  assert.equal(cal[6].sessionCount, 5);
});

test('buildCalendar : deux séances le même jour comptent pour deux', () => {
  const cal = buildCalendar(sessionsByDate([S('2026-10-28', 1), S('2026-10-28', 2)]), TODAY, 1);
  assert.deepEqual(cal[0].days[2].workoutIds, [1, 2]);
  assert.equal(cal[0].sessionCount, 2);
});

test('goalStreakWeeks : semaines terminées à l’objectif + la semaine en cours si atteint', () => {
  assert.equal(goalStreakWeeks(byDate, TODAY, 4), 2);
  assert.equal(goalStreakWeeks(byDate, TODAY, 3), 3);
  // Semaine en cours pas encore à l'objectif : elle ne casse pas la série.
  assert.equal(goalStreakWeeks(byDate, TODAY, 6), 0);
  assert.equal(goalStreakWeeks(sessionsByDate(sessions.slice(0, 8)), '2026-10-28', 3), 2);
});

test('averageSessionsPerWeek : semaines terminées, sans celles d’avant la reprise', () => {
  assert.equal(averageSessionsPerWeek(byDate, TODAY, 8), (3 + 5) / 2);
  assert.equal(averageSessionsPerWeek(new Map(), TODAY), null);
  assert.equal(averageSessionsPerWeek(sessionsByDate([S('2026-10-27', 1)]), TODAY), null);
});

test('consecutiveTrainingDays et lastRestDay', () => {
  assert.equal(consecutiveTrainingDays(byDate, TODAY), 3);
  assert.equal(consecutiveTrainingDays(byDate, '2026-10-31'), 3);
  assert.equal(consecutiveTrainingDays(byDate, '2026-10-29'), 1);
  assert.equal(consecutiveTrainingDays(byDate, '2026-10-29'), 1);
  assert.equal(consecutiveTrainingDays(sessionsByDate([S('2026-10-29', 1)]), TODAY), 0);
  assert.equal(lastRestDay(byDate, TODAY), '2026-10-28');
  assert.equal(lastRestDay(byDate, '2026-10-29'), '2026-10-28');
});

test('daysSinceBySplit', () => {
  const d = daysSinceBySplit(byDate, TODAY, [1, 2, 3, 4]);
  assert.equal(d.get(1), 1);
  assert.equal(d.get(2), 3);
  assert.equal(d.get(3), 2);
  assert.equal(d.get(4), null);
});

test('energyTrend', () => {
  assert.equal(energyTrend([4, 4, 5]), null);
  assert.equal(energyTrend([4, 4, 5, 4, 4, 3, 4, 3, 3, 2]), 'down');
  assert.equal(energyTrend([3, 3, 3, 3]), 'flat');
  assert.equal(energyTrend([2, 2, 4, 4]), 'up');
});

test('buildRestAdvice', () => {
  assert.equal(buildRestAdvice({ weekCount: 3, goal: 4, consecutiveDays: 2, energy: 'flat', trainedToday: false }), null);
  assert.deepEqual(buildRestAdvice({ weekCount: 5, goal: 4, consecutiveDays: 3, energy: 'down', trainedToday: false }), {
    reasons: ['5 séances sur 4', '3 jours d’affilée', 'énergie en baisse'],
    trainedToday: false,
  });
  assert.deepEqual(buildRestAdvice({ weekCount: 1, goal: 1, consecutiveDays: 1, energy: null, trainedToday: true }), {
    reasons: ['1 séance sur 1'],
    trainedToday: true,
  });
});

const L = (date, exerciseId, weight, repsDone, exerciseName = `Ex ${exerciseId}`) => ({ date, workoutId: 1, exerciseId, exerciseName, weight, repsDone });

test('volumeTrendPercent : 28 jours glissants contre les 28 d’avant', () => {
  const rows = [L('2026-09-20', 1, 50, 10), L('2026-10-10', 1, 50, 15)];
  assert.equal(volumeTrendPercent(rows, TODAY), 50);
  assert.equal(volumeTrendPercent([L('2026-10-10', 1, 50, 10)], TODAY), null);
});

test('exerciseProgression : charge ou reps en hausse, baisse, stable, exclusions', () => {
  const rows = [
    // 1 : charge en hausse (référence avant la fenêtre)
    L('2026-09-20', 1, 50, 8), L('2026-10-20', 1, 55, 8),
    // 2 : une rep de plus à charge égale
    L('2026-10-06', 2, 40, 8), L('2026-10-27', 2, 40, 9),
    // 3 : stable
    L('2026-10-06', 3, 30, 8), L('2026-10-27', 3, 30, 8),
    // 4 : en baisse
    L('2026-10-06', 4, 60, 8), L('2026-10-27', 4, 55, 8),
    // 5 : une seule séance -> ignoré ; 6 : plus travaillé depuis la fenêtre -> ignoré
    L('2026-10-27', 5, 20, 8), L('2026-09-01', 6, 20, 8), L('2026-09-10', 6, 25, 8),
    // 7 : poids du corps, reps en hausse ; meilleure série de la séance retenue
    L('2026-10-06', 7, 0, 10), L('2026-10-27', 7, 0, 12), L('2026-10-27', 7, 0, 9),
    // 8 : double progression, la charge monte et les reps retombent -> en hausse
    L('2026-10-06', 8, 20, 12), L('2026-10-27', 8, 22.5, 6),
    // 9 : même charge, une rep de moins à l'échec -> en baisse ; série d'échauffement plus légère ignorée
    L('2026-10-06', 9, 30, 10), L('2026-10-27', 9, 15, 15), L('2026-10-27', 9, 30, 9),
  ];
  const { up, flat, down, items } = exerciseProgression(rows, TODAY);
  assert.deepEqual({ up, flat, down }, { up: 4, flat: 1, down: 2 });
  assert.equal(items.length, 7);
  assert.deepEqual(items.map((i) => i.trend), ['up', 'up', 'up', 'up', 'flat', 'down', 'down']);
  assert.deepEqual(items.find((i) => i.exerciseName === 'Ex 8'), {
    exerciseName: 'Ex 8',
    trend: 'up',
    from: { weight: 20, reps: 12, date: '2026-10-06' },
    to: { weight: 22.5, reps: 6, date: '2026-10-27' },
  });
  assert.deepEqual(items.find((i) => i.exerciseName === 'Ex 9').to, { weight: 30, reps: 9, date: '2026-10-27' });
});

test('exerciseProgression : exercices reconnus par leur nom, pas par leur id', () => {
  const rows = [
    // Même id 15 pour deux exercices différents (ancien catalogue) : jamais comparés entre eux.
    L('2026-09-28', 15, 55, 8, 'Leg curl'), L('2026-10-11', 15, 60, 8, 'Leg curl'),
    L('2026-10-19', 15, 25, 10, 'Extension triceps à la poulie'), L('2026-10-31', 15, 27.5, 10, 'Extension triceps à la poulie'),
    // Même exercice sous l'id 0 (séance corrigée) puis sous son id du catalogue : un seul exercice.
    L('2026-10-04', 0, 120, 8, 'Squat barre libre (Finisher)'), L('2026-10-30', 14, 125, 6, 'squat barre libre  (Finisher) '),
  ];
  const { up, flat, down, items } = exerciseProgression(rows, TODAY);
  assert.deepEqual({ up, flat, down }, { up: 3, flat: 0, down: 0 });
  assert.equal(items.find((i) => i.exerciseName.startsWith('squat')).from.weight, 120);
});

test('recordsWithRecent : gain sur l’ancien record, exercices neufs exclus du compte', () => {
  const rows = [
    L('2026-09-01', 1, 100, 5, 'Squat'), L('2026-10-20', 1, 105, 5, 'Squat'),
    L('2026-09-01', 2, 80, 5, 'Bench'), L('2026-10-20', 2, 77.5, 5, 'Bench'),
    L('2026-10-20', 3, 120, 5, 'Deadlift'),
    L('2026-10-20', 4, 0, 12, 'Tractions'),
  ];
  const { records, beaten } = recordsWithRecent(rows, TODAY);
  assert.equal(beaten, 1);
  assert.deepEqual(records, [
    { exerciseName: 'Deadlift', maxWeight: 120, delta: null, steps: [{ date: '2026-10-20', weight: 120 }] },
    { exerciseName: 'Squat', maxWeight: 105, delta: 5, steps: [{ date: '2026-09-01', weight: 100 }, { date: '2026-10-20', weight: 105 }] },
    { exerciseName: 'Bench', maxWeight: 80, delta: null, steps: [{ date: '2026-09-01', weight: 80 }] },
  ]);
});

test('recordsWithRecent : marches du record, exercice reconnu par son nom (casse, espaces)', () => {
  const rows = [
    L('2026-09-28', 14, 110, 4, 'Squat barre libre'), L('2026-10-04', 14, 120, 8, 'Squat barre libre'),
    L('2026-10-11', 0, 120, 8, 'squat  barre libre'), L('2026-10-16', 14, 110, 8, 'Squat barre libre'),
    L('2026-10-30', 14, 125, 6, 'Squat barre libre'),
  ];
  const { records, beaten } = recordsWithRecent(rows, TODAY);
  assert.equal(records.length, 1);
  assert.equal(beaten, 1);
  assert.equal(records[0].delta, 5);
  assert.deepEqual(records[0].steps.map((s) => [s.date, s.weight]), [['2026-09-28', 110], ['2026-10-04', 120], ['2026-10-30', 125]]);
});

test('restartDate : première séance après la dernière pause de plus de 28 jours', () => {
  assert.equal(restartDate([]), null);
  assert.equal(restartDate(['2026-09-20', '2026-09-25', '2026-10-02']), '2026-09-20');
  assert.equal(restartDate(['2024-05-01', '2024-05-03', '2026-09-20', '2026-09-25']), '2026-09-20');
});

test('progressSinceRestart : première contre dernière séance, exercices abandonnés exclus', () => {
  const rows = [
    L('2026-09-20', 4, 70, 8, 'Shoulder Press'), L('2026-10-31', 4, 65, 8, 'Shoulder Press'),
    L('2026-09-28', 14, 110, 6, 'Squat'), L('2026-10-30', 14, 125, 6, 'Squat'),
    L('2026-09-20', 2, 50, 8, 'Bench'), L('2026-10-02', 2, 55, 8, 'Bench'), // plus fait depuis un mois
    L('2026-10-20', 9, 0, 12, 'Tractions'), L('2026-10-27', 9, 0, 14, 'Tractions'), // poids du corps
    L('2026-10-25', 7, 90, 8, 'Low Row'), // une seule séance
  ];
  const { items, averagePercent } = progressSinceRestart(rows, TODAY, '2026-09-20');
  assert.deepEqual(items.map((i) => [i.exerciseName, i.from, i.to, Math.round(i.percent)]), [['Squat', 110, 125, 14], ['Shoulder Press', 70, 65, -7]]);
  assert.equal(Math.round(averagePercent), 3);
});

test('fanSelection : les plus gros progrès et le plus net recul', () => {
  const it = (n, p) => ({ exerciseName: n, from: 100, to: 100 + p, percent: p });
  const items = [it('a', 19), it('b', 16), it('c', 15), it('d', 14), it('e', 10), it('f', -7)];
  assert.deepEqual(fanSelection(items).map((i) => i.exerciseName), ['a', 'b', 'c', 'd', 'f']);
  assert.deepEqual(fanSelection(items.slice(0, 5)).map((i) => i.exerciseName), ['a', 'b', 'c', 'd', 'e']);
});

test('setsByMuscleThisWeek et daysSinceByMuscle : semaine en cours, groupes du programme même à 0', () => {
  const R = (date, muscleGroup) => ({ date, muscleGroup });
  const rows = [
    R('2026-10-26', 'QUADRICEPS'), R('2026-10-26', 'QUADRICEPS'), R('2026-10-27', 'DOS'),
    R('2026-10-20', 'BICEPS'), R('2026-10-31', null), R('2026-10-31', 'MOLLETS'),
  ];
  const groups = ['DOS', 'QUADRICEPS', 'BICEPS'];
  assert.deepEqual(setsByMuscleThisWeek(rows, TODAY, groups), [
    { muscleGroup: 'QUADRICEPS', sets: 2 }, { muscleGroup: 'DOS', sets: 1 }, { muscleGroup: 'BICEPS', sets: 0 },
  ]);
  const since = daysSinceByMuscle(rows, TODAY, [...groups, 'ISCHIOS']);
  assert.equal(since.get('BICEPS'), 12);
  assert.equal(since.get('DOS'), 5);
  assert.equal(since.get('ISCHIOS'), null);
});
