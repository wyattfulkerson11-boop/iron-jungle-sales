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
        return {
          start: (cam, cfg) => { w.__scanCfg = { cam, cfg }; return Promise.resolve(); },
          pause() {}, resume() {}
        };
      };
      // Real enum values from vendor/html5-qrcode.min.js.
      w.Html5QrcodeSupportedFormats = { CODABAR: 1, CODE_39: 2, CODE_128: 4,
        ITF: 8, EAN_13: 7, UPC_A: 14, QR_CODE: 11 };
      w.alert = () => {};
      w.print = () => {};
      if (storage) for (const k of Object.keys(storage)) w.localStorage.setItem(k, storage[k]);
    },
  });
  return dom;
}

const results = [];
const pending = [];
// A check may return a promise (one test has to let a microtask run). Record
// the slot now so output order matches source order either way.
const check = (label, fn) => {
  const slot = results.length;
  results.push(['PASS', label]);
  const fail = (e) => { results[slot] = ['FAIL', label + ' — ' + (e && e.message || e)]; };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(v => { if (v instanceof Error) fail(v); }, fail));
    }
  } catch (e) { fail(e); }
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

/* ---- 0. the page is not blank on load ---- */
check('the idle screen is visible on a fresh load', () => {
  const w = boot().window;
  const active = [...w.document.querySelectorAll('.screen')]
    .filter(e => e.classList.contains('active')).map(e => e.id);
  assert.deepStrictEqual(active, ['idle'],
    'exactly the idle screen must be active — every other test drives a ' +
    'transition by hand, so none of them notice a blank startup');
  assert.ok(/Scan your gym barcode/.test(w.document.body.textContent),
    'the prompt must be readable');
});

check('no stray text leaks outside the app markup', () => {
  const w = boot().window;
  // A botched edit once appended `', path:` after </html>, which renders.
  const visible = w.document.body.innerText || w.document.body.textContent;
  assert.ok(!/',\s*path:/.test(visible), 'found leaked source fragment');
});

/* ---- 1. a product button is actually clickable ---- */
check('product buttons are enabled once a member is locked in', () => {
  const w = boot().window;
  w.onScanSuccess('IJG18301');
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
  enrollAndBuy(w, 'IJG18302', 'Buyer', 1);
  const sales = w.loadState().sales;
  assert.strictEqual(sales.length, 1, 'one click, one sale');
  assert.strictEqual(sales[0].productName, 'Gatorade');
});

/* ---- 3. double-tap still yields one sale, through the DOM ---- */
check('a double-tap on the live button yields exactly one sale', () => {
  const w = boot().window;
  const btns = enrollAndBuy(w, 'IJG18303', 'Double', 1);
  btns[1].click(); // second tap
  assert.strictEqual(w.loadState().sales.length, 1);
});

/* ---- 4. quantity stepper reaches the record ---- */
check('the stepper quantity lands on the sale', () => {
  const w = boot().window;
  w.onScanSuccess('IJG18304');
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
  enrollAndBuy(w1, 'IJG18305', 'Survivor', 0);
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
  assert.strictEqual(w2.loadState().members.IJG18305.name, 'Survivor');
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
  enrollAndBuy(w, 'IJG18307', 'Keep Me', 0);
  const before = w.localStorage.getItem('ij.v1');
  // NOTE: one storage assert (setItem throwing) cannot fire under jsdom, whose
  // Storage cannot be monkey-patched. It is covered in test-fixes.js instead.
  // What matters here is that the run leaves live data untouched.
  w.runSelfChecks();
  assert.strictEqual(w.localStorage.getItem('ij.v1'), before,
    'a deliberate self-check run must still restore live data');
  assert.strictEqual(w.loadState().members.IJG18307.name, 'Keep Me');
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

/* ---- 9. no qrbox: full-frame decode, and no second set of corners ---- */
check('no qrbox is set, so the library draws no shaded box of its own', () => {
  const w = boot().window;
  const { cfg } = w.__scanCfg;
  // Any qrbox does two bad things here. It turns on the library's shaded box,
  // which injects a second set of corner brackets inside .scan-frame's (the odd
  // double-corner look on the iPad), and it makes the decode region a
  // sub-rectangle that the library maps assuming object-fit: fill while our CSS
  // forces cover — so it decodes a different area than the member can see.
  assert.strictEqual(cfg.qrbox, undefined, 'qrbox must stay unset');
  // A square 250px qrbox was the original "scans nothing" bug; never go back.
  assert.notStrictEqual(cfg.qrbox, 250);
});

/* ---- 10. the REAL library accepts our start() arguments ----
 * The stub above records whatever it is handed, so it cannot tell a valid
 * config from an invalid one. It green-lit a cameraIdOrConfig with three keys
 * when the library allows exactly one, and the kiosk camera never started.
 * This test drives the actual vendored bundle and only stubs getUserMedia. */
check('real html5-qrcode accepts the scanner config and reaches getUserMedia', () => {
  const lib = fs.readFileSync(__dirname + '/vendor/html5-qrcode.min.js', 'utf8');
  const dom = new JSDOM('<div id="reader"></div>',
    { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  // jsdom has no layout engine; give the mount point the iPad's real size.
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 460 });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get: () => 460 });

  let asked = null;
  w.navigator.mediaDevices = {
    getUserMedia: (c) => { asked = c; return Promise.reject(new Error('STOP_AT_GETUSERMEDIA')); }
  };
  w.eval(lib);

  // The same arguments index.html passes. Keep these two in sync by hand —
  // the page inlines its script, so there is nothing to import.
  const inst = new w.Html5Qrcode('reader', {
    formatsToSupport: [
      w.Html5QrcodeSupportedFormats.CODE_39,
      w.Html5QrcodeSupportedFormats.CODE_128
    ]
  });
  let rejection = null;
  inst.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      videoConstraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    () => {},
    () => {}
  ).catch(e => { rejection = String((e && e.message) || e); });

  // start() validates synchronously inside its Promise executor, so one
  // microtask turn is enough to see either the rejection or the call.
  return new Promise(resolve => setImmediate(() => {
    try {
      assert.ok(
        !(rejection && /cameraIdOrConfig|qrbox|formatsToSupport|videoConstaints/i.test(rejection)),
        'config was rejected by the real library: ' + rejection
      );
      assert.ok(asked, 'start() never reached getUserMedia; rejected with: ' + rejection);
      assert.strictEqual(asked.video.facingMode, 'environment');
      assert.ok(asked.video.width.ideal >= 1280, 'high-res stream must actually be requested');
      resolve();
    } catch (e) { resolve(e); }
  }));
});

/* ---- 11. rebinding a known card tells the truth and is escapable ---- */
check('"Not you?" does not silently overwrite the member who owns the card', () => {
  const w = boot().window;
  enrollAndBuy(w, 'IJG18308', 'Wyatt F.', 0);
  w.onScanSuccess('IJG18308');
  const locked = w.document.getElementById('locked');
  assert.ok(locked.textContent.includes('Wyatt F.'), 'greets the known member');

  w.document.getElementById('not-me-btn').click();
  // It must not claim this is a first enrollment — the card is already known.
  assert.ok(!locked.textContent.includes('First time'),
    'rebind screen must not say "First time"');
  assert.ok(locked.textContent.includes('Wyatt F.'),
    'rebind screen must name who the card is currently saved as');
  // Nothing is written just by opening the rebind screen.
  assert.strictEqual(w.loadState().members.IJG18308.name, 'Wyatt F.');

  // And there is a way back that costs one tap, not an identity.
  w.document.getElementById('its-me-btn').click();
  assert.ok(locked.textContent.includes('Wyatt F.'), 'back to the greeting');
  assert.strictEqual(w.loadState().members.IJG18308.name, 'Wyatt F.',
    'a mis-tap must leave the stored member untouched');
});

/* ---- 12. implausible barcode reads are ignored ---- */
check('a misread barcode cannot become a badge ID', () => {
  const w = boot().window;
  const n = w.normalizeBadgeId;
  assert.strictEqual(n('IJG18399'), 'IJG18399', 'a real keytag passes through');
  assert.strictEqual(n('  ijg18399 '), 'IJG18399', 'trimmed and upper-cased');
  assert.strictEqual(n('*IJG18399*'), 'IJG18399', 'Code 39 delimiters stripped');
  assert.strictEqual(n(''), null);
  assert.strictEqual(n('12'), null, 'a two-digit partial read is not a badge');
  assert.strictEqual(n('IJG 18399'), null, 'embedded space is not a badge');
  assert.strictEqual(n(null), null);
  // and the guard is actually wired into the scan path
  const before = w.document.getElementById('locked').classList.contains('active');
  w.onScanSuccess('12');
  assert.strictEqual(w.document.getElementById('locked').classList.contains('active'), before,
    'a junk read must not advance the kiosk to the purchase screen');
});

Promise.all(pending).then(() => {
  let failed = 0;
  for (const [status, label] of results) {
    if (status === 'FAIL') failed++;
    console.log(`${status}  ${label}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
