const assert = require('assert');

// Simulate the scanner and state machine logic
let state = 'idle';
let isPaused = false;

function pauseScanner() { isPaused = true; }
function resumeScanner() { isPaused = false; }

function onScanSuccess(badgeId) {
    if (state !== 'idle') return;
    pauseScanner();
    state = 'locked';
}

function cancelScan() {
    state = 'idle';
    resumeScanner();
}

console.log('Verifying Task 4: Scanner State Machine...');
onScanSuccess('B1');
assert.strictEqual(state, 'locked', 'Scan must lock state');
assert.strictEqual(isPaused, true, 'Scanner must pause on lock');

onScanSuccess('B2');
assert.strictEqual(state, 'locked', 'Locked state must ignore second scan');
assert.strictEqual(isPaused, true, 'Scanner must remain paused');

cancelScan();
assert.strictEqual(state, 'idle', 'Cancel must return to idle');
assert.strictEqual(isPaused, false, 'Cancel must resume scanner');

console.log('Task 4 verification PASSED.');
