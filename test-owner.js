/**
 * Acceptance tests for the 2026-09-17 owner-feedback build (PLAN.md §D).
 *
 * Written BEFORE the implementation, against the real index.html in jsdom.
 * Do not modify this file, test-owner.fixture.js or test-owner.golden.json to
 * make anything pass — change index.html / sw.js / RUNBOOK.md / README.md.
 * If a test looks wrong, say so instead of editing it.
 *
 * Timers are fake: setTimeout/setInterval/Date.now are replaced before the
 * page script runs, and tick(ms) advances them. Nothing here waits on a clock.
 *
 * Run: node test-owner.js
 */
process.env.TZ = 'America/Chicago'; // golden output was captured in this zone
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const fx = require('./test-owner.fixture.js');

const read = f => { try { return fs.readFileSync(__dirname + '/' + f, 'utf8'); } catch { return null; } };
const html = read('index.html');
const golden = JSON.parse(read('test-owner.golden.json'));

/* ---------------- harness ---------------- */

function boot(storage = null) {
  const cam = { paused: 0, resumed: 0 };
  let now = fx.T0 + 10 * 24 * 3600 * 1000;
  let seq = 0;
  let timers = [];
  const dom = new JSDOM(html, {
    url: 'http://localhost/index.html',
    runScripts: 'dangerously',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.Html5Qrcode = function () {
        return { start: () => Promise.resolve(),
          pause() { cam.paused++; }, resume() { cam.resumed++; }, stop: () => Promise.resolve() };
      };
      w.Html5QrcodeSupportedFormats = { CODABAR: 1, CODE_39: 2, CODE_128: 4,
        ITF: 8, EAN_13: 7, UPC_A: 14, QR_CODE: 11 };
      w.alert = () => {};
      w.print = () => {};
      w.prompt = () => null;
      w.Date.now = () => now;
      w.setTimeout = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
      w.clearTimeout = (id) => { timers = timers.filter(t => t.id !== id); };
      w.setInterval = (fn, ms) => {
        const id = ++seq;
        const arm = (from) => timers.push({ id, at: from + ms, fn: () => { arm(now); fn(); } });
        arm(now);
        return id;
      };
      w.clearInterval = w.clearTimeout;
      if (storage) w.localStorage.setItem('ij.v1', JSON.stringify(storage));
    },
  });
  const w = dom.window;
  w.__cam = cam;
  w.tick = (ms) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      now = t.at;
      t.fn();
    }
    now = end;
  };
  w.touch = () => w.document.dispatchEvent(new w.Event('touchstart', { bubbles: true }));
  return w;
}

const st = (w) => w.eval('state');
// Values built inside the jsdom window have that realm's prototypes, so
// deepStrictEqual against a Node literal always fails. Compare as plain data.
const plain = (x) => JSON.parse(JSON.stringify(x));
// Storage has a named-property setter: `localStorage.setItem = fn` stores an
// item, it does not replace the method. Deny writes on the prototype instead.
function denyWrites(w) {
  const orig = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  return () => { w.Storage.prototype.setItem = orig; };
}
const active = (w) => [...w.document.querySelectorAll('.screen.active')].map(e => e.id);
const $ = (w, id) => w.document.getElementById(id);

function enrollByScan(w, badge, name) {
  w.onScanSuccess(badge);
  const input = $(w, 'name-input');
  if (input) {
    input.value = name;
    input.dispatchEvent(new w.Event('input'));
    $(w, 'enroll-btn').click();
  }
}
function buy(w, i = 0) { w.document.querySelectorAll('.product-btn')[i].click(); }
function typeEntry(w, number, name) {
  $(w, 'type-number-btn').click();
  $(w, 'typed-number').value = number;
  $(w, 'typed-number').dispatchEvent(new w.Event('input'));
  $(w, 'typed-name').value = name;
  $(w, 'typed-name').dispatchEvent(new w.Event('input'));
  $(w, 'typed-continue').click();
}
function openAdmin(w) {
  w.prompt = () => '0311';
  w.showAdminPinPrompt();
  w.prompt = () => null;
}
function finishSuccess(w) { w.tick(5000); }

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(['PASS', label]); }
  catch (e) { results.push(['FAIL', label + ' — ' + (e && e.message || e)]); }
};

/* ============ Item 1 — kiosk inactivity timeout ============ */

check('1a locked screen returns to idle after 45 s untouched', () => {
  const w = boot();
  enrollByScan(w, 'IJG18301', 'Walker');
  assert.strictEqual(st(w), 'locked');
  w.tick(45000);
  assert.strictEqual(st(w), 'idle', 'a walked-away member must not leave their tab open');
  assert.deepStrictEqual(active(w), ['idle']);
});

check('1b the next person cannot buy on the walked-away tab', () => {
  const w = boot();
  enrollByScan(w, 'IJG18301', 'Walker');
  w.tick(45000);
  const btn = w.document.querySelector('#locked .product-btn');
  if (btn) btn.click();
  assert.strictEqual(w.loadState().sales.length, 0);
});

check('1c a touch at 44 s extends the timeout', () => {
  const w = boot();
  enrollByScan(w, 'IJG18301', 'Slow');
  w.tick(44000);
  w.touch();
  w.tick(44000);
  assert.strictEqual(st(w), 'locked', 'activity must reset the timer');
  w.tick(1000);
  assert.strictEqual(st(w), 'idle');
});

check('1d the enroll screen also times out', () => {
  const w = boot();
  w.onScanSuccess('IJG18309');
  assert.ok($(w, 'name-input'), 'enroll form shown');
  w.tick(45000);
  assert.strictEqual(st(w), 'idle');
});

check('1e returning to idle by timeout resumes the camera', () => {
  const w = boot();
  enrollByScan(w, 'IJG18301', 'Cam');
  const before = w.__cam.resumed;
  w.tick(45000);
  assert.ok(w.__cam.resumed > before, 'scanner must resume after timeout');
});

/* ============ Item 2 — admin is a real state ============ */

check('2a opening admin sets state admin and pauses the scanner', () => {
  const w = boot();
  const before = w.__cam.paused;
  openAdmin(w);
  assert.strictEqual(st(w), 'admin');
  assert.ok(w.__cam.paused > before, 'camera must pause in admin');
});

check('2b a scan while admin is open does nothing', () => {
  const w = boot();
  openAdmin(w);
  w.onScanSuccess('IJG18399');
  assert.strictEqual(st(w), 'admin');
  assert.deepStrictEqual(active(w), ['admin'], 'worker must not be yanked onto a member grid');
});

check('2c admin times out after 3 min untouched, and a touch extends it', () => {
  const w = boot();
  openAdmin(w);
  w.tick(170000);
  w.touch();
  w.tick(170000);
  assert.strictEqual(st(w), 'admin', 'touch must reset the admin timer');
  w.tick(10000);
  assert.strictEqual(st(w), 'idle');
  assert.deepStrictEqual(active(w), ['idle']);
});

check('2d Back to kiosk returns to idle and resumes the scanner', () => {
  const w = boot();
  openAdmin(w);
  const before = w.__cam.resumed;
  w.returnToIdle();
  assert.strictEqual(st(w), 'idle');
  assert.ok(w.__cam.resumed > before);
});

check('2e Clear all data is refused while an unbatched sale is waiting', () => {
  const w = boot(fx.legacyState());
  w.confirmBatch('legacy-pending');
  enrollByScan(w, 'IJG18301', 'Alice A.');
  buy(w);
  finishSuccess(w);
  const r = w.clearAllData('CLEAR');
  assert.strictEqual(r.ok, false, 'a day of un-pulled sales must not be one word from gone');
  assert.strictEqual(r.reason, 'waiting');
  assert.strictEqual(w.loadState().sales.length, 5);
});

check('2f Clear is allowed when the only waiting sale is voided', () => {
  const w = boot(fx.legacyState());
  w.confirmBatch('legacy-pending');
  enrollByScan(w, 'IJG18301', 'Alice A.');
  buy(w);
  $(w, 'undo-btn').click();
  assert.strictEqual(w.clearAllData('CLEAR').ok, true);
});

/* ============ Item 3 — identity on the report, versioned ============ */

check('3a legacy batches render byte-identical to 264578d (invariant 3)', () => {
  const w = boot(fx.legacyState());
  for (const id of Object.keys(golden)) {
    const r = w.buildBatchReport(id);
    assert.strictEqual(r.html, golden[id].html, id + ' HTML changed');
    assert.strictEqual(r.text, golden[id].text, id + ' text changed');
    assert.strictEqual(r.totalCents, golden[id].totalCents);
    assert.strictEqual(r.lineCount, golden[id].lineCount);
  }
});

check('3b a scanned sale records entry "scan"; new batches get reportV 2', () => {
  const w = boot();
  enrollByScan(w, 'IJG18311', 'Scanner');
  buy(w);
  assert.strictEqual(w.loadState().sales[0].entry, 'scan');
  const b = w.createBatch();
  assert.strictEqual(b.reportV, 2);
  assert.strictEqual(w.loadState().batches[0].reportV, 2, 'reportV must be persisted');
});

check('3c v2 report shows Member # in HTML and text', () => {
  const w = boot(fx.v2State());
  const r = w.buildBatchReport('v2-pending');
  for (const out of [r.html, r.text]) {
    assert.ok(out.includes('IJG18304') && out.includes('IJG18302'), 'badge IDs must be on the sheet');
  }
  assert.ok(/Member #/.test(r.html), 'column header');
});

check('3d typed lines carry TYPED and a desk-check box; scanned lines do not', () => {
  const w = boot(fx.v2State());
  const r = w.buildBatchReport('v2-pending');
  assert.strictEqual((r.text.match(/TYPED/g) || []).length, 1, 'exactly one typed line (V1)');
  assert.strictEqual((r.html.match(/TYPED/g) || []).length, 1);
  assert.ok(/desk checked/i.test(r.html), 'check box for the desk');
});

check('3e two badges sharing a name are separate groups on v2', () => {
  const w = boot();
  enrollByScan(w, 'IJG18321', 'Sam S.'); buy(w); finishSuccess(w);
  enrollByScan(w, 'IJG18322', 'Sam S.'); buy(w); finishSuccess(w);
  const r = w.buildBatchReport(w.createBatch().id);
  const lines = r.text.split('\n').filter(l => l.includes('Sam S.'));
  assert.strictEqual(lines.length, 2, 'one header per badge, not one merged "Sam S."');
});

check('3f stale writer: an unversioned batch holding new-style sales renders v2', () => {
  const s = fx.v2State();
  delete s.batches.find(b => b.id === 'v2-pending').reportV;
  const w = boot(s);
  const r = w.buildBatchReport('v2-pending');
  assert.ok(r.text.includes('TYPED') && r.text.includes('VOID') && r.text.includes('IJG18304'),
    'a pre-deploy page batching typed/voided sales must not hide them');
});

/* ============ Item 4 — typed entry ============ */

check('4a the typed-entry button is on the idle screen and not on #idle-title', () => {
  const w = boot();
  const btn = $(w, 'type-number-btn');
  assert.ok(btn && $(w, 'idle').contains(btn));
  assert.ok(!$(w, 'idle-title').contains(btn), 'invariant 10: the title is the admin long-press');
});

check('4b opening typed entry pauses the scanner and makes scans inert', () => {
  const w = boot();
  const before = w.__cam.paused;
  $(w, 'type-number-btn').click();
  assert.strictEqual(st(w), 'typing');
  assert.ok(w.__cam.paused > before);
  w.onScanSuccess('IJG18399');
  assert.strictEqual(st(w), 'typing', 'a scan mid-typing must not fire');
});

check('4c garbage is rejected in place', () => {
  const w = boot();
  typeEntry(w, '12', 'Someone');
  assert.strictEqual(st(w), 'typing');
  assert.ok(!$(w, 'typed-error').hidden && $(w, 'typed-error').textContent.trim().length > 0);
  assert.deepStrictEqual(plain(w.loadState().members), {});
});

check('4d unknown number + name enrols, locks in, and the sale is TYPED', () => {
  const w = boot();
  typeEntry(w, 'ijg18331', 'New Person');
  assert.strictEqual(st(w), 'locked');
  assert.strictEqual(w.loadState().members.IJG18331.name, 'New Person');
  buy(w);
  const sale = w.loadState().sales[0];
  assert.strictEqual(sale.entry, 'typed');
  assert.strictEqual(sale.badgeId, 'IJG18331');
});

check('4e enrolled number + wrong name is blocked and never reveals the saved name', () => {
  const w = boot(fx.legacyState());
  const before = JSON.stringify(w.loadState());
  typeEntry(w, 'IJG18302', 'Mallory');
  assert.notStrictEqual(st(w), 'locked');
  assert.ok(!w.document.body.innerHTML.includes('Bob B.'), 'saved name must not appear anywhere');
  assert.strictEqual(JSON.stringify(w.loadState()), before, 'nothing written');
  assert.strictEqual(w.document.querySelectorAll('.product-btn').length, 0, 'no grid');
});

check('4f enrolled number + matching name (case/spacing/punctuation) is accepted', () => {
  const w = boot(fx.legacyState());
  typeEntry(w, 'IJG18302', '  bob   b ');
  assert.strictEqual(st(w), 'locked');
});

check('4g typed "Not you?" returns to typing and never rebinds', () => {
  const w = boot(fx.legacyState());
  typeEntry(w, 'IJG18302', 'Bob B.');
  $(w, 'not-me-btn').click();
  assert.strictEqual(st(w), 'typing');
  assert.ok(!$(w, 'name-input'), 'rebind form must not render on the typed path');
  assert.strictEqual(w.loadState().members.IJG18302.name, 'Bob B.');
});

check('4h the next scanned sale after a typed one is "scan"', () => {
  const w = boot();
  typeEntry(w, 'IJG18332', 'Typed One');
  buy(w); finishSuccess(w);
  enrollByScan(w, 'IJG18333', 'Scanned One');
  buy(w);
  const sales = w.loadState().sales;
  assert.strictEqual(sales[0].entry, 'typed');
  assert.strictEqual(sales[1].entry, 'scan');
});

check('4i Cancel from typing returns to idle and resumes the camera', () => {
  const w = boot();
  $(w, 'type-number-btn').click();
  const before = w.__cam.resumed;
  $(w, 'typed-cancel').click();
  assert.strictEqual(st(w), 'idle');
  assert.ok(w.__cam.resumed > before);
});

check('4j the typing screen times out to idle', () => {
  const w = boot();
  $(w, 'type-number-btn').click();
  w.tick(45000);
  assert.strictEqual(st(w), 'idle');
});

/* ============ Item 5 — void while Pending ============ */

check('5a Undo on the success screen voids the sale as member-undo', () => {
  const w = boot();
  enrollByScan(w, 'IJG18341', 'Oops');
  buy(w);
  assert.strictEqual(st(w), 'success');
  $(w, 'undo-btn').click();
  const s = w.loadState().sales[0];
  assert.ok(s.voidedAt, 'voidedAt set');
  assert.strictEqual(s.voidedBy, 'member-undo');
  assert.strictEqual(st(w), 'idle');
});

check('5b the success screen lasts 5 s, not 2 s', () => {
  const w = boot();
  enrollByScan(w, 'IJG18342', 'Reader');
  buy(w);
  w.tick(4900);
  assert.strictEqual(st(w), 'success');
  w.tick(100);
  assert.strictEqual(st(w), 'idle');
});

check('5c a stale success timer cannot kick the next member out', () => {
  const w = boot();
  enrollByScan(w, 'IJG18343', 'First');
  buy(w);
  $(w, 'undo-btn').click();
  w.tick(3100); // clear the scan lockout
  enrollByScan(w, 'IJG18344', 'Second');
  assert.strictEqual(st(w), 'locked');
  w.tick(2000); // the first sale's 5 s would have elapsed here
  assert.strictEqual(st(w), 'locked', 'stale success timeout fired');
});

check('5d voided sales never enter a new batch and are not counted waiting', () => {
  const w = boot();
  enrollByScan(w, 'IJG18345', 'V');
  buy(w);
  $(w, 'undo-btn').click();
  assert.strictEqual(w.pendingSaleCount(), 0);
  assert.strictEqual(w.createBatch(), null, 'nothing to batch');
});

check('5e admin void in a Pending batch: VOID line, excluded from total, membership intact', () => {
  const w = boot(fx.legacyState());
  const before = w.buildBatchReport('legacy-pending');
  assert.strictEqual(w.voidSale('L4', 'admin'), true);
  const b = w.loadState().batches.find(x => x.id === 'legacy-pending');
  assert.deepStrictEqual(plain(b.saleIds), ['L4'], 'invariant 1: saleIds never shrink');
  const r = w.buildBatchReport('legacy-pending');
  assert.strictEqual(r.totalCents, 0);
  assert.strictEqual(r.lineCount, 0);
  assert.ok(r.text.includes('VOID') && r.html.includes('VOID'));
  assert.notStrictEqual(r.html, before.html);
});

check('5f void is refused on a Processed batch and changes nothing', () => {
  const w = boot(fx.legacyState());
  const before = JSON.stringify(w.loadState());
  assert.strictEqual(w.voidSale('L1', 'admin'), false);
  assert.strictEqual(JSON.stringify(w.loadState()), before);
  assert.strictEqual(w.buildBatchReport('legacy-processed').html, golden['legacy-processed'].html);
});

check('5g first void wins; a second is refused and does not rewrite', () => {
  const w = boot(fx.legacyState());
  assert.strictEqual(w.voidSale('L4', 'member-undo'), true);
  const first = w.loadState().sales.find(s => s.id === 'L4');
  w.tick(60000);
  assert.strictEqual(w.voidSale('L4', 'admin'), false);
  const again = w.loadState().sales.find(s => s.id === 'L4');
  assert.strictEqual(again.voidedAt, first.voidedAt);
  assert.strictEqual(again.voidedBy, 'member-undo');
});

check('5h a denied write on void does not report success', () => {
  const w = boot(fx.legacyState());
  const restore = denyWrites(w);
  assert.strictEqual(w.voidSale('L4', 'admin'), false);
  restore();
  assert.ok(!w.loadState().sales.find(s => s.id === 'L4').voidedAt);
});

check('5i Undo with a denied write never shows the sale as undone', () => {
  const w = boot();
  enrollByScan(w, 'IJG18346', 'Deny');
  buy(w);
  let msg = '';
  w.alert = (m) => { msg = String(m); };
  const restore = denyWrites(w);
  $(w, 'undo-btn').click();
  restore();
  assert.ok(/could not undo/i.test(msg), 'must tell the member it failed');
  // Visible text only: the page's <script> sits inside <body>, and its comments say "undone".
  const shown = [...w.document.querySelectorAll('.screen')].map(e => e.textContent).join(' ');
  assert.ok(!/\bundone\b/i.test(shown), 'must not claim success');
  assert.strictEqual(st(w), 'idle');
});

/* ============ Item 6 — service worker + multi-context guard ============ */

check('6a sw.js exists: versioned cache, skipWaiting, claim, old-cache cleanup, network-first', () => {
  const sw = read('sw.js');
  assert.ok(sw, 'sw.js missing');
  assert.ok(/ij-shell-v\d+/.test(sw), 'versioned cache name');
  assert.ok(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw));
  assert.ok(/caches\.delete/.test(sw), 'activate deletes other ij-shell-* caches');
  assert.ok(/navigate/.test(sw) && /3000/.test(sw), 'navigation fallback with a 3 s timeout');
  for (const f of ['index.html', 'logo.png', 'manifest.json', 'vendor/']) {
    assert.ok(sw.includes(f), 'precache ' + f);
  }
});

check('6b registration is guarded and relative', () => {
  assert.ok(/'serviceWorker'\s+in\s+navigator/.test(html));
  assert.ok(/serviceWorker\.register\(\s*['"]\.?\/?sw\.js['"]/.test(html));
});

check('6c RUNBOOK carries the kill-switch worker', () => {
  const rb = read('RUNBOOK.md');
  assert.ok(/unregister\(\)/.test(rb) && /caches\.delete/.test(rb));
});

check('6d another context writing ij.v1 blocks sales here until reload', () => {
  const w = boot();
  let reloaded = 0;
  w.reloadPage = () => { reloaded++; };
  enrollByScan(w, 'IJG18361', 'Two Tabs');
  w.dispatchEvent(new w.StorageEvent('storage', { key: 'ij.v1' }));
  buy(w);
  assert.strictEqual(w.loadState().sales.length, 0, 'a second writer must not silently race this one');
});

check('6e the same event while idle reloads the page', () => {
  const w = boot();
  let reloaded = 0;
  w.reloadPage = () => { reloaded++; };
  w.dispatchEvent(new w.StorageEvent('storage', { key: 'ij.v1' }));
  assert.strictEqual(reloaded, 1);
});

/* ============ Item 7 — loss-window nudge + docs ============ */

check('7a oldestWaitingMs ignores voided and batched sales', () => {
  const s = fx.v2State();
  const w = boot(s);
  const now = w.Date.now();
  const st2 = w.loadState();
  st2.sales.find(x => x.id === 'V4').at = new Date(now - 7 * 3600e3).toISOString();
  st2.sales.find(x => x.id === 'V5').at = new Date(now - 9 * 3600e3).toISOString(); // voided
  w.saveState(st2);
  assert.strictEqual(w.oldestWaitingMs(), 7 * 3600e3);
  w.createBatch();
  assert.strictEqual(w.oldestWaitingMs(), null);
});

check('7b admin shows BUILD and a red waiting age past 6 h', () => {
  const w = boot();
  enrollByScan(w, 'IJG18371', 'Old');
  buy(w); finishSuccess(w);
  w.tick(6 * 3600e3 + 1000);
  openAdmin(w);
  const admin = $(w, 'admin');
  assert.ok(admin.textContent.includes(w.eval('BUILD')), 'BUILD visible in admin');
  assert.ok(admin.querySelector('.age-warn'), 'overdue waiting sales are flagged');
});

check('7c docs no longer claim the PIN is 0000 and do not restate the real one', () => {
  for (const f of ['RUNBOOK.md', 'README.md']) {
    const d = read(f);
    assert.ok(!/\b0000\b/.test(d), f + ' still says 0000');
    assert.ok(!/\b0311\b/.test(d), f + ' must not restate the PIN');
  }
});

/* ============ E0 — the rollback floor reads v2 data ============ */

check('E0a floor: v2 totals exclude VOID and Confirm works', () => {
  const w = boot(fx.v2State());
  const r = w.buildBatchReport('v2-pending');
  assert.strictEqual(r.totalCents, 275 * 1 + 150 * 3, 'V2 is voided');
  assert.strictEqual(r.lineCount, 2);
  assert.strictEqual(w.confirmBatch('v2-pending'), true);
});

check('E0b floor: waiting count and new batch skip the voided unbatched sale', () => {
  const w = boot(fx.v2State());
  assert.strictEqual(w.pendingSaleCount(), 1, 'V4 waits, V5 is voided');
  const b = w.createBatch();
  assert.deepStrictEqual(plain(b.saleIds), ['V4']);
});

check('E0c floor: a new scanned sale still records on v2 data', () => {
  const w = boot(fx.v2State());
  w.onScanSuccess('IJG18301');
  buy(w);
  assert.strictEqual(w.loadState().sales.length, 10);
});

/* ============ E3a — large-batch soak ============ */

check('E3a a 500-line batch builds with the right total', () => {
  const w = boot();
  const s = w.loadState();
  for (let i = 0; i < 500; i++) {
    s.sales.push(Object.assign(fx.sale('S' + i, 'IJG2' + String(i % 60).padStart(4, '0'),
      'Member ' + (i % 60), 'Bang', 275, 1 + (i % 3), i, null), { entry: i % 7 ? 'scan' : 'typed' }));
  }
  assert.strictEqual(w.saveState(s), true);
  const b = w.createBatch();
  const r = w.buildBatchReport(b.id);
  const expected = s.sales.reduce((t, x) => t + x.price * x.qty, 0);
  assert.strictEqual(r.lineCount, 500);
  assert.strictEqual(r.totalCents, expected);
});

/* ============ Added at verification, 2026-09-18 ============ */

check('V1 every precached shell entry is a real file (a 404 fails the whole install)', () => {
  const sw = read('sw.js');
  const m = sw && sw.match(/SHELL\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'SHELL list not found');
  const entries = m[1].match(/'[^']*'|"[^"]*"/g).map(s => s.slice(1, -1));
  for (const e of entries) {
    if (e === './') continue;
    assert.ok(!e.endsWith('/'), e + ' is a directory — Pages serves 404 for it');
    assert.ok(fs.existsSync(__dirname + '/' + e), e + ' does not exist');
  }
  assert.ok(entries.some(e => /^vendor\/.+\.js$/.test(e)), 'the scanner library must be precached');
});

check('V2 a card still in frame is ignored when the receipt closes', () => {
  const w = boot();
  enrollByScan(w, 'IJG18381', 'Left It');
  buy(w);
  finishSuccess(w);
  assert.strictEqual(st(w), 'idle');
  w.onScanSuccess('IJG18381');
  assert.strictEqual(st(w), 'idle', 'the card left on the counter must not reopen the tab');
  w.tick(3000);
  w.onScanSuccess('IJG18381');
  assert.strictEqual(st(w), 'locked', 'a deliberate scan after the lockout still works');
});

check('V3 admin Void asks first; declining voids nothing', () => {
  const w = boot(fx.legacyState());
  openAdmin(w);
  w.viewBatch('legacy-pending');
  const btn = $(w, 'batch-view-body').querySelector('[data-void="L4"]');
  assert.ok(btn, 'Void button on a pending batch line');
  let asked = 0;
  w.confirm = () => { asked++; return false; };
  btn.click();
  assert.strictEqual(asked, 1, 'must confirm before an irreversible void');
  assert.ok(!w.loadState().sales.find(s => s.id === 'L4').voidedAt);
  w.confirm = () => true;
  $(w, 'batch-view-body').querySelector('[data-void="L4"]').click();
  assert.strictEqual(w.loadState().sales.find(s => s.id === 'L4').voidedBy, 'admin');
});

check('V4 no function is declared twice in index.html (the later one silently wins)', () => {
  const names = [...html.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepStrictEqual(dup, []);
});

check('V5 the shared text has no monospace column padding (AirDrop makes a .txt)', () => {
  const w = boot(fx.v2State());
  const r = w.buildBatchReport('v2-pending');
  for (const line of r.text.split('\n')) {
    assert.ok(!/\S {3,}\S/.test(line),
      'padded columns collapse in a proportional font: ' + JSON.stringify(line));
  }
  assert.ok(/— \$\d/.test(r.text), 'each item line names its price after a dash');
});

/* ---------------- report ---------------- */

let failed = 0;
for (const [status, label] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${label}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
