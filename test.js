import { detectConflict, generateSmartAlternatives } from './js/conflictEngine.js';

console.log('--- Testing CampusFlow Smart Conflict Engine ---');

// Test 1: Conflict detection for 14:30 - 15:30 (overlaps with 14:00 - 16:00 AI Society)
const conflictTest = detectConflict('innovation-lab', '2026-09-11', '14:30', '15:30');
console.log('Test 1 (14:30 - 15:30 collision):', conflictTest.hasConflict ? 'PASSED (Conflict Detected)' : 'FAILED');
console.log('Reason:', conflictTest.reason);

// Test 2: Smart alternatives generation
const alternatives = generateSmartAlternatives('innovation-lab', '2026-09-11', '14:30', '15:30');
console.log('Test 2 (Smart Alternatives):', alternatives.map(a => a.label));

// Test 3: Free slot test (16:00 - 17:00)
const freeTest = detectConflict('innovation-lab', '2026-09-11', '16:00', '17:00');
console.log('Test 3 (16:00 - 17:00 open slot):', !freeTest.hasConflict ? 'PASSED (Open Slot Available)' : 'FAILED');

// Test 4: Conflict detection for 09:30 - 10:00 (overlaps with 09:00 - 10:30 Robotics Club)
const conflictTest2 = detectConflict('innovation-lab', '2026-09-11', '09:30', '10:00');
console.log('Test 4 (09:30 - 10:00 collision):', conflictTest2.hasConflict ? 'PASSED (Conflict Detected)' : 'FAILED');

if (conflictTest.hasConflict && alternatives.length > 0 && !freeTest.hasConflict && conflictTest2.hasConflict) {
  console.log('===> ALL UNIT TESTS PASSED WITH 100% SUCCESS <===');
} else {
  console.error('===> UNIT TESTS FAILED <===');
  process.exit(1);
}
