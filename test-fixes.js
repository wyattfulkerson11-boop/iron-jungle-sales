/**
 * Regression tests for the six defects found reviewing Hermes's Tasks 1-6,
 * plus the two scanner-lifecycle bugs.
 *
 * Unlike the earlier verify-*.js files, this loads the real index.html and
 * executes its actual code. A test that redefines the function it claims to
 * check proves nothing.
 *
 * Run: node test-fixes.js
 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/g).pop()
  .replace(/^<script>/, '').replace(/<\/script>$/, '');

// --- minimal DOM ---------------------------------------------------------
function makeEl(id) {
  const el = {
    id, _html: '', textContent: '', hidden: false, disabled: false,
    style: { _v:{}, setProperty(k,v){ this._v[k]=v; }, getPropertyValue(k){ return this._v[k]||''; } }, classList: { add() {}, remove() {} },
    _handlers: {},
    addEventListener(ev, fn) { (this._handlers[ev] ||= []).push(fn); },
    click() { (this._handlers.click || []).forEach(f => f()); },
    focus() {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
  };
  return el;
}
const els = {};
const doc = {
  getElementById(id) { return (els[id] ||= makeEl(id)); },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {},
};

// --- localStorage with a failure switch ----------------------------------
let failWrites = false;
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); store.set(k, String(v)); },
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const ctx = {
  document: doc, localStorage, console,
  crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  alert: () => {}, setTimeout: () => 0, clearTimeout: () => {},
  Html5Qrcode: function () {
    return { start: () => Promise.resolve(), pause() {}, resume() {} };
  },
  // Real enum values from vendor/html5-qrcode.min.js.
  Html5QrcodeSupportedFormats: { CODABAR: 1, CODE_39: 2, CODE_128: 4,
    ITF: 8, EAN_13: 7, UPC_A: 14, QR_CODE: 11 },
  // window-level listeners (kiosk gesture hardening). Behaviour is covered in
  // test-browser.js against a real DOM; here it only has to not throw.
  addEventListener: () => {},
};
ctx.window = ctx;
vm.createContext(ctx);

// Top-level `let` bindings in a vm script are not properties of the context,
// so expose accessors for the ones the tests need to drive. Test-only shim —
// nothing is added to index.html for this.
vm.runInContext(script + `
;globalThis.__t = {
  get state(){return state}, set state(v){state=v},
  get currentBadgeId(){return currentBadgeId}, set currentBadgeId(v){currentBadgeId=v},
  get currentQty(){return currentQty}, set currentQty(v){currentQty=v},
  get scanLockoutUntil(){return scanLockoutUntil}, set scanLockoutUntil(v){scanLockoutUntil=v},
};`, ctx);
const t = ctx.__t;

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(['PASS', label]); }
  catch (e) { results.push(['FAIL', label + ' — ' + e.message]); }
};

// --- 1. escapeHtml actually escapes --------------------------------------
check('escapeHtml neutralizes markup', () => {
  const out = ctx.escapeHtml('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<'), 'angle brackets must be encoded');
  assert.strictEqual(out, '&lt;img src=x onerror=alert(1)&gt;');
});
check('escapeHtml encodes ampersand first', () => {
  assert.strictEqual(ctx.escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
});

// --- 2. name sanitization ------------------------------------------------
check('sanitizeName collapses whitespace', () => {
  assert.strictEqual(ctx.sanitizeName('  John   Doe  '), 'John Doe');
});
check('sanitizeName rejects empty and overlong', () => {
  assert.strictEqual(ctx.sanitizeName('   '), null);
  assert.strictEqual(ctx.sanitizeName('a'.repeat(41)), null);
});

// --- 3. remap actually persists (the no-op bug) --------------------------
check('remap persists a new name for the same badge', () => {
  store.clear();
  t.currentBadgeId = 'BADGE1';
  assert.ok(ctx.enrollCurrentBadge('Alice'), 'first enroll should save');
  assert.strictEqual(ctx.loadState().members.BADGE1.name, 'Alice');

  assert.ok(ctx.enrollCurrentBadge('Bob'), 'remap should save');
  const after = ctx.loadState().members.BADGE1.name;
  assert.strictEqual(after, 'Bob', 'badge must now resolve to Bob, got ' + after);
});

// --- 4. prior sales keep their snapshot ----------------------------------
check('remap does not rewrite past sales', () => {
  store.clear();
  t.currentBadgeId = 'BADGE2';
  ctx.enrollCurrentBadge('Carol');
  const s = ctx.loadState();
  s.sales.push({ id: 'x', badgeId: 'BADGE2', memberName: 'Carol', qty: 1 });
  ctx.saveState(s);
  ctx.enrollCurrentBadge('Dave');
  assert.strictEqual(ctx.loadState().sales[0].memberName, 'Carol');
  assert.strictEqual(ctx.loadState().members.BADGE2.name, 'Dave');
});

// --- 5. failed write must not report success -----------------------------
check('addSale returns false when storage fails', () => {
  store.clear();
  failWrites = true;
  const ok = ctx.addSale({ id: 'a', qty: 1 });
  failWrites = false;
  assert.strictEqual(ok, false, 'a failed write must report failure');
});
check('enrollCurrentBadge returns false when storage fails', () => {
  store.clear();
  t.currentBadgeId = 'BADGE3';
  failWrites = true;
  const ok = ctx.enrollCurrentBadge('Eve');
  failWrites = false;
  assert.strictEqual(ok, false);
});

// --- 6. scan lockout is real, not decorative -----------------------------
check('scan lockout blocks a badge still in frame', () => {
  t.state = 'idle';
  t.currentBadgeId = null;
  ctx.armScanLockout();
  assert.ok(t.scanLockoutUntil > Date.now(), 'lockout must set a future deadline');
  ctx.onScanSuccess('BADGE9');
  assert.strictEqual(t.state, 'idle', 'scan during lockout must be ignored');
  assert.strictEqual(t.currentBadgeId, null);
});
check('scan is accepted once the lockout expires', () => {
  t.state = 'idle';
  t.currentBadgeId = null;
  t.scanLockoutUntil = 0;
  ctx.onScanSuccess('BADGE9');
  assert.strictEqual(t.state, 'locked');
  assert.strictEqual(t.currentBadgeId, 'BADGE9');
});

// --- 7. quantity reaches the sale record ---------------------------------
check('sale records the stepper quantity, not a hardcoded 1', () => {
  store.clear();
  t.currentBadgeId = 'BADGE4';
  ctx.enrollCurrentBadge('Frank');
  t.state = 'recording';
  t.currentQty = 3;
  ctx.recordSale({ id: 'gatorade', name: 'Gatorade', sku: 'gatorade', price: 250 });
  const sale = ctx.loadState().sales[0];
  assert.strictEqual(sale.qty, 3, 'expected qty 3, got ' + sale.qty);
  assert.strictEqual(sale.productName, 'Gatorade');
  assert.strictEqual(sale.batchId, null);
});

// --- 8. corrupt storage is quarantined, not overwritten ------------------
check('corrupt storage is quarantined', () => {
  store.clear();
  store.set('ij.v1', '{not valid json');
  const s = ctx.loadState();
  assert.strictEqual(s.schema, 1);
  const quarantined = [...store.keys()].filter(k => k.includes('corrupt'));
  assert.ok(quarantined.length === 1, 'bad data must be preserved under a corrupt key');
});

// --- report ---------------------------------------------------------------
let failed = 0;
for (const [status, label] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${label}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
