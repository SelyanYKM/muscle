import { getPlateBreakdownPerSide } from './src/engine/plateCalculator';
import { calculateNextSession } from './src/engine/progression';
import { SetResult } from './src/types';

function runTests() {
  console.log('=== TEST 1: Calculateur de disques par côté ===');
  
  // Cas 1: 45 kg sur machine (base = 0kg) -> 22.5 kg / côté -> 20 + 2.5
  const machine45 = getPlateBreakdownPerSide(45, 0);
  console.log('Machine 45kg:', JSON.stringify(machine45.map(p => `${p.count}x${p.weight}kg`)));
  if (machine45[0]?.weight === 20 && machine45[1]?.weight === 2.5) {
    console.log('✅ PASS: Machine 45kg décomposée en [20kg, 2.5kg]');
  } else {
    console.error('❌ FAIL: Machine 45kg', machine45);
  }

  // Cas 2: 100 kg sur barre libre (base = 20kg) -> 80kg net -> 40 kg / côté -> 2x20kg
  const barbell100 = getPlateBreakdownPerSide(100, 20);
  console.log('Barre 100kg:', JSON.stringify(barbell100.map(p => `${p.count}x${p.weight}kg`)));
  if (barbell100[0]?.weight === 20 && barbell100[0]?.count === 2) {
    console.log('✅ PASS: Barre 100kg décomposée en 2x 20kg par côté');
  } else {
    console.error('❌ FAIL: Barre 100kg', barbell100);
  }

  // Cas 3: 62.5 kg sur barre libre (base = 20kg) -> 42.5kg net -> 21.25 kg / côté -> 20 + 1.25
  const barbell62_5 = getPlateBreakdownPerSide(62.5, 20);
  console.log('Barre 62.5kg:', JSON.stringify(barbell62_5.map(p => `${p.count}x${p.weight}kg`)));
  if (barbell62_5[0]?.weight === 20 && barbell62_5[1]?.weight === 1.25) {
    console.log('✅ PASS: Barre 62.5kg décomposée en [20kg, 1.25kg]');
  } else {
    console.error('❌ FAIL: Barre 62.5kg', barbell62_5);
  }

  console.log('\n=== TEST 2: Algorithme de surcharge progressive ===');

  // Cas 🟢 🟢 🟢 -> +2.5kg sur toutes les séries
  const resultsEasy: SetResult[] = [
    { setNumber: 1, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
    { setNumber: 2, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
    { setNumber: 3, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
  ];
  const planEasy = calculateNextSession(resultsEasy, 8, 2.5);
  console.log('Plan 🟢🟢🟢:', planEasy);
  if (planEasy.progressionVerdict === 'FULL_INCREASE' && planEasy.weightsPerSet.every(w => w === 62.5)) {
    console.log('✅ PASS: 🟢🟢🟢 donne +2.5kg sur toutes les séries (62.5 kg)');
  } else {
    console.error('❌ FAIL: 🟢🟢🟢', planEasy);
  }

  // Cas 🟢 🟢 🟠 -> S1 +2.5kg, S2 & S3 maintien
  const resultsPartial: SetResult[] = [
    { setNumber: 1, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
    { setNumber: 2, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
    { setNumber: 3, targetReps: 8, repsDone: 8, weight: 60, feeling: 'MEDIUM' },
  ];
  const planPartial = calculateNextSession(resultsPartial, 8, 2.5);
  console.log('Plan 🟢🟢🟠:', planPartial);
  if (planPartial.progressionVerdict === 'PARTIAL_INCREASE' && planPartial.weightsPerSet[0] === 62.5 && planPartial.weightsPerSet[1] === 60) {
    console.log('✅ PASS: 🟢🟢🟠 donne S1 +2.5kg (62.5 kg) et S2/S3 à 60 kg');
  } else {
    console.error('❌ FAIL: 🟢🟢🟠', planPartial);
  }

  // Cas 🔴 (Échec) -> maintien ou deload si répété
  const resultsHard: SetResult[] = [
    { setNumber: 1, targetReps: 8, repsDone: 8, weight: 60, feeling: 'EASY' },
    { setNumber: 2, targetReps: 8, repsDone: 7, weight: 60, feeling: 'HARD' },
    { setNumber: 3, targetReps: 8, repsDone: 6, weight: 60, feeling: 'HARD' },
  ];
  const planHard = calculateNextSession(resultsHard, 8, 2.5, 0);
  console.log('Plan 🔴 (1er échec):', planHard);
  if (planHard.progressionVerdict === 'MAINTAIN' && planHard.weightsPerSet.every(w => w === 60)) {
    console.log('✅ PASS: 1er échec donne MAINTIEN (60 kg)');
  } else {
    console.error('❌ FAIL: 1er échec', planHard);
  }

  // Cas 🔴 répété (2e échec consécutif) -> Deload -10%
  const planDeload = calculateNextSession(resultsHard, 8, 2.5, 1);
  console.log('Plan 🔴 (2e échec consécutif):', planDeload);
  if (planDeload.progressionVerdict === 'DELOAD' && planDeload.weightsPerSet.every(w => w === 55)) {
    console.log('✅ PASS: 2e échec consécutif donne DELOAD -10% (55 kg)');
  } else {
    console.error('❌ FAIL: 2e échec deload', planDeload);
  }

  console.log('\n🎉 TOUS LES TESTS MOTEUR SONT VALIDES !');
}

runTests();
