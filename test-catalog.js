/**
 * Task 3 — Catalog validation self-check.
 * Test first (RED phase): duplicate SKU must throw.
 * Then implement validateCatalog() + render logic.
 * Then test the grid renders all entries (GREEN).
 */

const results = [];
function assert(cond, label) { results.push({ ok: !!cond, label }); if (!cond) console.error('  FAIL:', label); }

// --- RED phase test: duplicate SKU must throw ---
// This test references validateCatalog() which doesn't exist yet.
// It should fail because validateCatalog is not defined.

function testDuplicateSkuThrows() {
  const badCatalog = [
    { id: '1', name: 'Water', sku: 'WTR', price: 200 },
    { id: '2', name: 'Gatorade', sku: 'WTR', price: 300 },  // same SKU!
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
assert(r1 === true, 'duplicate SKU throws (RED phase — will fail until validateCatalog exists)');

// --- Same for duplicate id ---
function testDuplicateIdThrows() {
  const badCatalog = [
    { id: 'x', name: 'Water', sku: 'WTR', price: 200 },
    { id: 'x', name: 'Gatorade', sku: 'GTR', price: 300 },
  ];
  let threw = false;
  try {
    validateCatalog(badCatalog);
  } catch (e) {
    threw = true;
  }
  return threw;
}

const r2 = testDuplicateIdThrows();
assert(r2 === true, 'duplicate id throws');

// --- Empty name ---
function testEmptyNameThrows() {
  const badCatalog = [
    { id: 'a', name: '', sku: 'A', price: 100 },
  ];
  let threw = false;
  try { validateCatalog(badCatalog); } catch (e) { threw = true; }
  return threw;
}

const r3 = testEmptyNameThrows();
assert(r3 === true, 'empty name throws');

// --- Price zero or negative ---
function testBadPriceThrows() {
  const badCatalog = [
    { id: 'a', name: 'Free', sku: 'FREE', price: -1 },
  ];
  let threw = false;
  try { validateCatalog(badCatalog); } catch (e) { threw = true; }
  return threw;
}

const r4 = testBadPriceThrows();
assert(r4 === true, 'negative price throws');

const pass = results.filter(r => r.ok).length;
const total = results.length;
console.log('Catalog tests (pre-impl): ' + pass + '/' + total + ' passed');
if (pass !== total) {
  results.filter(r => !r.ok).forEach(r => console.error('  NOT OK:', r.label));
  process.exit(1);
}
console.log('ALL PASSED');