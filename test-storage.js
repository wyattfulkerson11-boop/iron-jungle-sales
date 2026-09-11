/**
 * Storage layer self-check — pure Node.js (no jsdom needed).
 * Tests the three storage functions' core behaviors:
 *   - round-trip a sale
 *   - addSale returns false when setItem throws
 *   - garbage/quarantine handling
 */

const STORAGE_KEY = 'ij.v1';

// Minimal localStorage shim
let store = {};
let willThrow = false;
global.localStorage = {
  getItem: (k) => (store[k] !== undefined ? String(store[k]) : null),
  setItem: (k, v) => {
    if (willThrow) throw new Error('QuotaExceededError');
    store[k] = String(v);
  },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] || null,
};

function defaultState() {
  return { schema: 1, members: {}, sales: [], batches: [] };
}

let corrupted = false;

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return defaultState(); }
  if (!raw) return defaultState();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    quarantine(STORAGE_KEY); corrupted = true; return defaultState();
  }
  if (!parsed || parsed.schema !== 1) {
    quarantine(STORAGE_KEY); corrupted = true; return defaultState();
  }
  const state = defaultState();
  state.members = parsed.members && typeof parsed.members === 'object' ? parsed.members : {};
  state.sales = Array.isArray(parsed.sales) ? parsed.sales : [];
  state.batches = Array.isArray(parsed.batches) ? parsed.batches : [];
  return state;
}

function quarantine(key) {
  try {
    const raw = localStorage.getItem(key);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const badKey = key + '.corrupt.' + stamp;
    if (raw !== null) localStorage.setItem(badKey, raw);
    localStorage.removeItem(key);
  } catch (e) { /* best-effort */ }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (e) { return false; }
}

function addSale(sale) {
  const state = loadState();
  state.sales.push(sale);
  return saveState(state);
}

/* === RED PHASE: verify these tests fail when functions are missing / GREEN PHASE: run === */
const results = [];
function assert(cond, label) { results.push({ ok: !!cond, label }); if (!cond) console.error('  FAIL:', label); }

// 1. Default state shape
localStorage.clear();
const s1 = loadState();
assert(s1.schema === 1, 'default schema is 1');
assert(Array.isArray(s1.sales), 'sales is array');
assert(Array.isArray(s1.batches), 'batches is array');

// 2. Round-trip a sale
const sale = { id: 's-test-1', badgeId: 'B1', memberName: 'Jane D.', productId: 'water', productName: 'Water', sku: 'water', price: 200, qty: 1, at: new Date().toISOString(), batchId: null };
const saved = addSale(sale);
assert(saved === true, 'addSale returns true on success');

const s2 = loadState();
assert(s2.sales.length === 1, 'one sale in state');
assert(s2.sales[0].id === 's-test-1', 'sale ID round-trips');
assert(s2.sales[0].memberName === 'Jane D.', 'sale memberName persists');

// 3. Simulate quota failure
willThrow = true;
const sale2 = { id: 's-test-2', badgeId: 'B2', memberName: 'Bob', productId: 'bar', productName: 'Protein Bar', sku: 'bar', price: 300, qty: 1, at: new Date().toISOString(), batchId: null };
const failed = addSale(sale2);
assert(failed === false, 'addSale returns false when setItem throws');
willThrow = false;

const s3 = loadState();
assert(s3.sales.length === 1, 'failed save did NOT persist sale 2');
assert(s3.sales[0].id === 's-test-1', 'sale 1 still intact');

// 4. Garbage in the key -> quarantine, not crash
localStorage.setItem(STORAGE_KEY, '{not valid json!!');
corrupted = false;
const s4 = loadState();
assert(corrupted === true, 'corrupted flag set after garbage value');
assert(s4.sales.length === 0, 'fresh sales after garbage');
assert(s4.schema === 1, 'fresh schema after garbage');

let quarantined = false;
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i);
  if (k && k.indexOf(STORAGE_KEY + '.corrupt.') === 0) quarantined = true;
}
assert(quarantined, 'garbage is quarantined under ij.v1.corrupt.*');

// 5. Schema mismatch
localStorage.clear();
corrupted = false;
localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 99, sales: [{ id: 'orphan' }] }));
const s5 = loadState();
assert(corrupted === true, 'corrupted flag on schema mismatch');
assert(s5.schema === 1, 'fresh start on schema mismatch');
assert(s5.sales.length === 0, 'no orphan sales on schema mismatch');

const pass = results.filter(r => r.ok).length;
const total = results.length;
console.log('\nStorage tests: ' + pass + '/' + total + ' passed');
if (pass !== total) {
  results.filter(r => !r.ok).forEach(r => console.error('  NOT OK:', r.label));
  process.exit(1);
}
console.log('ALL PASSED');