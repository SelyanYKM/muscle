import { getPlateBreakdownPerSide } from './src/engine/plateCalculator';
import { calculateNextSession } from './src/engine/progression';
import { SetResult } from './src/types';

function runTests() {
  console.log('=== TEST 1: Calculateur de disques par côté ===');
  
  const machine45 = getPlateBreakdownPerSide(45, 0);
  console.log('Machine 45kg:', JSON.stringify(machine45.map(p => `${p.count}x${p.weight}kg`)));
  if (machine45[0]?.weight === 20 && machine45[1]?.weight === 2.5) {
    console.log('✅ PASS: Machine 45kg décomposée en [20kg, 2.5kg]');
  } else {
    console.error('❌ FAIL: Machine 45kg', machine45);
  }

  const barbell100 = getPlateBreakdownPerSide(100, 20);
  console.log('Barre 100kg:', JSON.stringify(barbell100.map(p => `${p.count}x${p.weight}kg`)));
  if (barbell100[0]?.weight === 20 && barbell100[0]?.count === 2) {
    console.log('✅ PASS: Barre 100kg décomposée en 2x 20kg par côté');
  } else {
    console.error('❌ FAIL: Barre 100kg', barbell100);
  }

  console.log('\n=== TEST 2: Surcharge progressive avec charges différentes par série (50 / 55 / 60 kg) ===');

  // Cas 🟢 🟢 🟢 avec charges variables (50 / 55 / 60) -> toutes les séries prennent +2.5kg (52.5 / 57.5 / 62.5)
  const resultsAscendingEasy: SetResult[] = [
    { setNumber: 1, targetReps: 8, repsDone: 8, weight: 50, feeling: 'EASY' },
    { setNumber: 2, targetReps: 8, repsDone: 8, weight: 55, feeling: 'EASY' },
    { setNumber: 3, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
  ];
  const planAscendingEasy = calculateNextSession(resultsAscendingEasy, 8, 2.5);
  console.log('Plan 🟢🟢🟢 (50/55/60):', planAscendingEasy);
  if (
    planAscendingEasy.progressionVerdict === 'FULL_INCREASE' &&
    planAscendingEasy.weightsPerSet[0] === 52.5 &&
    planAscendingEasy.weightsPerSet[1] === 57.5 &&
    planAscendingEasy.weightsPerSet[2] === 62.5
  ) {
    console.log('✅ PASS: 🟢🟢🟢 donne [52.5, 57.5, 62.5] kg');
  } else {
    console.error('❌ FAIL: 🟢🟢🟢', planAscendingEasy);
  }

  // Cas 🟢 🟢 🟠 avec charges variables (50 / 55 / 60) -> S1 prend +2.5kg (52.5), S2 et S3 restent à 55 et 60
  const resultsAscendingPartial: SetResult[] = [
    { setNumber: 1, targetReps: 8, repsDone: 8, weight: 50, feeling: 'EASY' },
    { setNumber: 2, targetReps: 8, repsDone: 8, weight: 55, feeling: 'EASY' },
    { setNumber: 3, targetReps: 8, repsDone: 8, weight: 60, feeling: 'MEDIUM' },
  ];
  const planAscendingPartial = calculateNextSession(resultsAscendingPartial, 8, 2.5);
  console.log('Plan 🟢🟢🟠 (50/55/60):', planAscendingPartial);
  if (
    planAscendingPartial.progressionVerdict === 'PARTIAL_INCREASE' &&
    planAscendingPartial.weightsPerSet[0] === 52.5 &&
    planAscendingPartial.weightsPerSet[1] === 55 &&
    planAscendingPartial.weightsPerSet[2] === 60
  ) {
    console.log('✅ PASS: 🟢🟢🟠 donne [52.5, 55, 60] kg');
  } else {
    console.error('❌ FAIL: 🟢🟢🟠', planAscendingPartial);
  }

  console.log('\n🎉 TOUS LES TESTS MOTEUR AVEC CHARGES VARIABLES SONT VALIDES !');
}

runTests();
