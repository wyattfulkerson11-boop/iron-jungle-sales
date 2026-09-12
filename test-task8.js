/**
 * Acceptance tests for Task 8 (PIN-gated admin) and the three Task 7 gaps.
 *
 * These are written BEFORE the implementation. They fail until the required
 * behavior exists. Do not modify this file to make it pass — make index.html
 * satisfy it.
 *
 * Run: node test-task8.js
 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/g).pop()
  .replace(/^<script>/, '').replace(/<\/script>$/, '');

function makeEl(id) {
  return {
    id, _html: '', textContent: '', hidden: false, disabled: false,
    style: { _v:{}, setProperty(k,v){ this._v[k]=v; }, getPropertyValue(k){ return this._v[k]||''; } }, classList: { add() {}, remove() {} }, _handlers: {},
    addEventListener(ev, fn) { (this._handlers[ev] ||= []).push(fn); },
    click() { (this._handlers.click || []).forEach(f => f()); },
    focus() {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
  };
}
const els = {};
const store = new Map();
let printCalls = 0;

const ctx = {
  document: {
    getElementById: id => (els[id] ||= makeEl(id)),
    querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
  },
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
  console,
  crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  alert: () => {}, setTimeout: () => 0, clearTimeout: () => {},
  Html5Qrcode: function () {
    return { start: () => Promise.resolve(), pause() {}, resume() {} };
  },
};
ctx.window = ctx;
ctx.NO_DEMO = true;
ctx.print = () => { printCalls++; };
vm.createContext(ctx);
vm.runInContext(script + `
;globalThis.__t = {
  get state(){return state}, set state(v){state=v},
  get currentBadgeId(){return currentBadgeId}, set currentBadgeId(v){currentBadgeId=v},
  get currentQty(){return currentQty}, set currentQty(v){currentQty=v},
};`, ctx);
const t = ctx.__t;

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(['PASS', label]); }
  catch (e) { results.push(['FAIL', label + ' — ' + e.message]); }
};

// Helper: seed a member and N sales, return the state.
function seed(sales = 1) {
  store.clear();
  t.currentBadgeId = 'B1';
  ctx.enrollCurrentBadge('Alice');
  for (let i = 0; i < sales; i++) {
    t.state = 'recording';
    t.currentQty = 2;
    ctx.recordSale({ id: 'gatorade', name: 'Gatorade', sku: 'gatorade', price: 250 });
  }
  return ctx.loadState();
}

/* ---------------- Task 8: the PIN gate ---------------- */

check('ADMIN_PIN exists as a named constant', () => {
  assert.ok(typeof ctx.ADMIN_PIN === 'string' && ctx.ADMIN_PIN.length > 0,
    'expected a string ADMIN_PIN');
});

check('correct PIN unlocks admin', () => {
  ctx.resetAdminLockout();
  assert.strictEqual(ctx.tryAdminUnlock(ctx.ADMIN_PIN), true);
});

check('wrong PIN is refused', () => {
  ctx.resetAdminLockout();
  assert.strictEqual(ctx.tryAdminUnlock('9999'), false);
});

check('three wrong attempts trigger a lockout', () => {
  ctx.resetAdminLockout();
  ctx.tryAdminUnlock('1');
  ctx.tryAdminUnlock('2');
  ctx.tryAdminUnlock('3');
  // Even the CORRECT pin must be refused while locked out.
  assert.strictEqual(ctx.tryAdminUnlock(ctx.ADMIN_PIN), false,
    'correct PIN must be refused during lockout');
  assert.ok(ctx.adminLockoutRemainingMs() > 0, 'lockout must report time remaining');
});

/* ---------------- Task 7 gap: confirm guard ---------------- */

check('a processed batch cannot be confirmed twice', () => {
  seed(1);
  const b = ctx.createBatch();
  assert.ok(b, 'batch should be created');
  assert.strictEqual(ctx.confirmBatch(b.id), true, 'first confirm should succeed');
  assert.strictEqual(ctx.confirmBatch(b.id), false,
    're-confirming a processed batch must be refused');
});

/* ---------------- Task 7 gap: history + reprint ---------------- */

check('processed batches stay listed for admin (30-day history)', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.confirmBatch(b.id);
  const listed = ctx.listAdminBatches();
  assert.ok(listed.some(x => x.id === b.id),
    'a processed batch must remain listed so it can be reprinted');
});

check('batches older than 30 days drop out of the list', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.confirmBatch(b.id);
  const s = ctx.loadState();
  const old = new Date(Date.now() - 31 * 864e5).toISOString();
  s.batches[0].createdAt = old;
  s.batches[0].processedAt = old;
  ctx.saveState(s);
  assert.ok(!ctx.listAdminBatches().some(x => x.id === b.id),
    'a 31-day-old processed batch must not be listed');
});

check('a processed batch can still be reprinted with the same id', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.confirmBatch(b.id);
  const before = ctx.loadState();
  printCalls = 0;
  ctx.printBatch(b.id);
  assert.strictEqual(printCalls, 1, 'print must fire');
  const after = ctx.loadState();
  assert.deepStrictEqual(after.sales, before.sales, 'reprint must not alter sales');
  assert.strictEqual(after.batches[0].status, 'processed',
    'reprint must not change batch status');
});

/* ---------------- Task 7 gap: report completeness ---------------- */

check('print output carries a line count and a batch total', () => {
  seed(2);
  const b = ctx.createBatch();
  ctx.printBatch(b.id);
  const out = els['print-container'].innerHTML;
  // 2 sales x qty 2 x $2.50 = $10.00
  assert.ok(/\$10\.00/.test(out), 'batch total $10.00 must appear; got: ' + out.slice(0, 400));
  assert.ok(/\b2\b/.test(out), 'line count must appear');
});

check('print output shows a human-readable time, not a raw ISO string', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.printBatch(b.id);
  const out = els['print-container'].innerHTML;
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(out),
    'raw ISO timestamps must not be printed for a worker to read');
});

/* ---------------- Task 8: destructive-action guards ---------------- */

check('clear-data is refused while a batch is pending', () => {
  seed(1);
  ctx.createBatch(); // leaves it pending
  const r = ctx.clearAllData('CLEAR');
  assert.strictEqual(r.ok, false, 'must refuse while a batch is pending');
  assert.strictEqual(r.reason, 'pending');
});

check('clear-data requires the exact confirmation word', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.confirmBatch(b.id);
  assert.strictEqual(ctx.clearAllData('clear').ok, false, 'lowercase must not pass');
  assert.strictEqual(ctx.clearAllData('').ok, false, 'empty must not pass');
});

check('clear-data wipes state when confirmed correctly', () => {
  seed(1);
  const b = ctx.createBatch();
  ctx.confirmBatch(b.id);
  const r = ctx.clearAllData('CLEAR');
  assert.strictEqual(r.ok, true);
  const s = ctx.loadState();
  assert.strictEqual(s.sales.length, 0);
  assert.strictEqual(s.batches.length, 0);
});

check('unexported sale count is reported for the clear-data warning', () => {
  seed(3);
  assert.strictEqual(ctx.pendingSaleCount(), 3);
  ctx.createBatch();
  assert.strictEqual(ctx.pendingSaleCount(), 0, 'batched sales are no longer unexported');
});

let failed = 0;
for (const [status, label] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${label}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
