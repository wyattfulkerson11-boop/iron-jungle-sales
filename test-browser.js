/**
 * Real-DOM tests, via jsdom.
 *
 * The other suites use a hand-written stub DOM whose querySelectorAll returns
 * [], so no test ever CLICKED anything. Two bugs lived through 56 passing
 * tests because of that:
 *
 *   1. renderProductGrid hardcoded btn.disabled = true and nothing ever
 *      re-enabled it — the kiosk could not record a sale at all.
 *   2. The dev self-checks auto-ran on page load. demoStorage() clears
 *      localStorage and writes garbage, so every reload quarantined the live
 *      data as corrupt and started empty.
 *
 * These tests drive the actual rendered page. Run: node test-browser.js
 */
const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

function boot(url = 'http://localhost/index.html', storage = null) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => null;
      // The scanner needs a camera; stub it so the page boots headless.
      w.Html5Qrcode = function () {
        return { start: () => Promise.resolve(), pause() {}, resume() {} };
      };
      w.alert = () => {};
      w.print = () => {};
      if (storage) for (const k of Object.keys(storage)) w.localStorage.setItem(k, storage[k]);
    },
  });
  return dom;
}

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(['PASS', label]); }
  catch (e) { results.push(['FAIL', label + ' — ' + e.message]); }
};

function enrollAndBuy(w, badge, name, productIndex) {
  w.onScanSuccess(badge);
  const input = w.document.getElementById('name-input');
  input.value = name;
  input.dispatchEvent(new w.Event('input'));
  w.document.getElementById('enroll-btn').click();
  const btns = w.document.querySelectorAll('.product-btn');
  btns[productIndex].click();
  return btns;
}

/* ---- 1. a product button is actually clickable ---- */
check('product buttons are enabled once a member is locked in', () => {
  const w = boot().window;
  w.onScanSuccess('B1');
  const input = w.document.getElementById('name-input');
  input.value = 'Tester';
  input.dispatchEvent(new w.Event('input'));
  w.document.getElementById('enroll-btn').click();
  const btns = w.document.querySelectorAll('.product-btn');
  assert.strictEqual(btns.length, 8, 'grid should render');
  assert.strictEqual(btns[0].disabled, false,
    'buttons must be clickable while locked — hardcoding disabled=true killed the kiosk');
});

/* ---- 2. a real click records exactly one sale ---- */
check('clicking a product button records a sale', () => {
  const w = boot().window;
  enrollAndBuy(w, 'B2', 'Buyer', 1);
  const sales = w.loadState().sales;
  assert.strictEqual(sales.length, 1, 'one click, one sale');
  assert.strictEqual(sales[0].productName, 'Gatorade');
});

/* ---- 3. double-tap still yields one sale, through the DOM ---- */
check('a double-tap on the live button yields exactly one sale', () => {
  const w = boot().window;
  const btns = enrollAndBuy(w, 'B3', 'Double', 1);
  btns[1].click(); // second tap
  assert.strictEqual(w.loadState().sales.length, 1);
});

/* ---- 4. quantity stepper reaches the record ---- */
check('the stepper quantity lands on the sale', () => {
  const w = boot().window;
  w.onScanSuccess('B4');
  const input = w.document.getElementById('name-input');
  input.value = 'Q';
  input.dispatchEvent(new w.Event('input'));
  w.document.getElementById('enroll-btn').click();
  w.document.getElementById('qty-plus').click();
  w.document.getElementById('qty-plus').click();
  w.document.querySelectorAll('.product-btn')[0].click();
  assert.strictEqual(w.loadState().sales[0].qty, 3);
});

/* ---- 5. THE BIG ONE: a reload must not destroy data ---- */
check('a page reload preserves sales and members', () => {
  const w1 = boot().window;
  enrollAndBuy(w1, 'B5', 'Survivor', 0);
  assert.strictEqual(w1.loadState().sales.length, 1, 'sale should exist before reload');

  // Carry the stored bytes into a brand-new page load, as a refresh would.
  const carried = {};
  for (let i = 0; i < w1.localStorage.length; i++) {
    const k = w1.localStorage.key(i);
    carried[k] = w1.localStorage.getItem(k);
  }
  const w2 = boot('http://localhost/index.html', carried).window;
  assert.strictEqual(w2.loadState().sales.length, 1,
    'a reload must not lose sales — self-checks must not run on load');
  assert.strictEqual(w2.loadState().members.B5.name, 'Survivor');
});

/* ---- 6. no false corruption banner on a clean load ---- */
check('a clean load shows no corrupt-storage banner in admin', () => {
  // `corrupted` is a script-scoped let, so check the user-visible effect.
  const w = boot().window;
  w.renderAdmin();
  const banner = w.document.getElementById('admin-batches').innerHTML;
  assert.ok(!/quarantined/i.test(banner),
    'auto-running demoStorage() raised this banner on every boot, crying wolf');
});

/* ---- 7. self-checks are opt-in and non-destructive ---- */
check('self-checks do not run on load', () => {
  const w = boot().window;
  // demoStorage() leaves a test sale behind if it ran without restoring.
  assert.strictEqual(w.loadState().sales.length, 0,
    'a fresh page must not have run the destructive self-checks');
});

check('a deliberate self-check run restores live data', () => {
  const w = boot().window;
  enrollAndBuy(w, 'B7', 'Keep Me', 0);
  const before = w.localStorage.getItem('ij.v1');
  // NOTE: one storage assert (setItem throwing) cannot fire under jsdom, whose
  // Storage cannot be monkey-patched. It is covered in test-fixes.js instead.
  // What matters here is that the run leaves live data untouched.
  w.runSelfChecks();
  assert.strictEqual(w.localStorage.getItem('ij.v1'), before,
    'a deliberate self-check run must still restore live data');
  assert.strictEqual(w.loadState().members.B7.name, 'Keep Me');
});

/* ---- 8. admin stays unreachable without the PIN ---- */
check('admin screen is not reachable without a correct PIN', () => {
  const w = boot().window;
  w.prompt = () => '9999';
  const title = w.document.getElementById('idle-title');
  title.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  // long-press timer is 800ms; simulate by calling the gate directly too
  assert.strictEqual(w.tryAdminUnlock('9999'), false);
  assert.ok(!w.document.getElementById('admin').classList.contains('active'));
});

let failed = 0;
for (const [status, label] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${label}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
