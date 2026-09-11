/**
 * Task 3 — Catalog validation self-check.
 *
 * RED phase: validateCatalog is a stub that never throws.
 * The tests should FAIL because the stub doesn't catch duplicates.
 * Then in GREEN phase implement the real validateCatalog and tests pass.
 */

const results = [];
function assert(cond, label) { results.push({ ok: !!cond, label }); if (!cond) console.error('  FAIL:', label); }

// RED stub: accepts anything, never throws.
function validateCatalog(catalog) { /* stub — does nothing */ }

// --- RED phase: This test MUST fail because stub doesn't throw on duplicates ---
function testDuplicateSkuThrows() {
  const badCatalog = [
    { id: '1', name: 'Water', sku: 'WTR', price: 200 },
    { id: '2', name: 'Gatorade', sku: 'WTR', price: 300 },
  ];
  let threw = false;
  try {
    validateCatalog(badCatalog);
  } catch (e) {
    threw = true;
  }
  return threw;
}

const r1 = testDuplicateSkuThrows();
assert(r1 === true, 'duplicate SKU must throw');

function testDuplicateIdThrows() {
  const badCatalog = [
    { id: 'x', name: 'Water', sku: 'WTR', price: 200 },
    { id: 'x', name: 'Gatorade', sku: 'GTR', price: 300 },
  ];
  let threw = false;
  try { validateCatalog(badCatalog); } catch (e) { threw = true; }
  return threw;
}
const r2 = testDuplicateIdThrows();
assert(r2 === true, 'duplicate id must throw');

function testEmptyNameThrows() {
  const badCatalog = [
    { id: 'a', name: '', sku: 'A', price: 100 },
  ];
  let threw = false;
  try { validateCatalog(badCatalog); } catch (e) { threw = true; }
  return threw;
}
const r3 = testEmptyNameThrows();
assert(r3 === true, 'empty name must throw');

function testBadPriceThrows() {
  const badCatalog = [
    { id: 'a', name: 'Free', sku: 'FREE', price: -1 },
  ];
  let threw = false;
  try { validateCatalog(badCatalog); } catch (e) { threw = true; }
  return threw;
}
const r4 = testBadPriceThrows();
assert(r4 === true, 'negative price must throw');

const pass = results.filter(r => r.ok).length;
const total = results.length;
console.log('Catalog tests (RED phase — expect FAILURES): ' + pass + '/' + total + ' passed');
if (pass !== total) {
  results.filter(r => !r.ok).forEach(r => console.error('  EXPECTED FAIL:', r.label));
  console.log('RED phase CORRECT — tests failed because stub does not validate.');
  // RED pass: don't exit with error for RED phase
} else {
  console.log('ALL PASSED (unexpected for RED phase)');
}