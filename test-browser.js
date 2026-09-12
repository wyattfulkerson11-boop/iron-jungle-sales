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

/* ---- 11. double-tap zoom is cancelled, but fast taps on controls are not ---- */
check('a fast double-tap is cancelled, except on the qty stepper', () => {
  // lastTouchEnd is module state in the page, so each scenario needs its own
  // fresh load — otherwise a "first" tap lands inside the previous one's window.
  const tapper = (w) => (el) => {
    const e = new w.Event('touchend', { bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const purchaseScreen = (w, badge) => {
    enrollAndBuy(w, badge, 'Stepper', 0);
    w.onScanSuccess(badge);
  };

  // Off-control: the scan screen, where a stray double-tap displaced the page.
  const w1 = boot().window, tap1 = tapper(w1);
  const title = w1.document.getElementById('idle-title');
  assert.strictEqual(tap1(title), false, 'first tap must pass through');
  assert.strictEqual(tap1(title), true, 'a fast second tap is cancelled');

  // A product button IS covered — this is the "double-tap a product, get one
  // sale" case, where the second tap is already discarded anyway.
  const w2 = boot().window, tap2 = tapper(w2);
  purchaseScreen(w2, 'IJG18309');
  const product = w2.document.querySelectorAll('.product-btn')[1];
  assert.strictEqual(tap2(product), false, 'first tap on a product');
  assert.strictEqual(tap2(product), true, 'fast second tap on a product is cancelled');

  // The qty stepper opts out via data-rapid — members tap "+" twice quickly and
  // preventDefault on touchend would eat the second click.
  const w3 = boot().window, tap3 = tapper(w3);
  purchaseScreen(w3, 'IJG18311');
  const plus = w3.document.getElementById('qty-plus');
  assert.ok(plus.hasAttribute('data-rapid'), '+ must opt in to rapid taps');
  assert.strictEqual(tap3(plus), false, 'first tap on +');
  assert.strictEqual(tap3(plus), false, 'fast second tap on + must NOT be cancelled');
  plus.click(); plus.click();
  assert.strictEqual(w3.document.getElementById('qty-value').textContent.trim(), '3',
    'two quick taps on + must both count');
});

/* ---- 11b. a displaced document snaps back, but not while typing ---- */
check('document scroll is pinned at 0, except while a field is focused', () => {
  const w = boot().window;
  // jsdom has no layout, so drive the handler directly by faking a displacement.
  let scrolledTo = null;
  w.scrollTo = (x, y) => { scrolledTo = [x, y]; };
  Object.defineProperty(w, 'scrollY', { value: 400, configurable: true });
  w.dispatchEvent(new w.Event('scroll'));
  assert.deepStrictEqual(scrolledTo, [0, 0], 'a displaced kiosk must snap back');

  // While the member is typing their name, iOS scrolls the input into view on
  // purpose — snapping back would hide the field.
  scrolledTo = null;
  w.onScanSuccess('IJG18310');
  w.document.getElementById('name-input').focus();
  w.dispatchEvent(new w.Event('scroll'));
  assert.strictEqual(scrolledTo, null, 'must not fight iOS while an input is focused');
});

/* ---- 12. rebinding a known card tells the truth and is escapable ---- */
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

/* ---- 13. implausible barcode reads are ignored ---- */
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

/* ---- 14. batch labels, and one report behind print/view/share ---- */
check('a batch is labelled by time and shows its last action', () => {
  const w = boot().window;
  enrollAndBuy(w, 'IJG18320', 'Batch Tester', 0);
  const b = w.createBatch();
  assert.ok(b, 'batch should be created');

  // Pending: last action is its creation.
  assert.ok(w.batchLabel(b).startsWith('Batch \u2014'), 'label reads "Batch — <when>"');
  assert.ok(!/[0-9a-f]{8}-/.test(w.batchLabel(b)), 'label must not be a raw UUID');
  assert.ok(w.lastActionLabel(b).startsWith('Created '), 'pending shows Created');

  // Confirmed: last action becomes the keying-in, not the creation.
  w.confirmBatch(b.id);
  const after = w.loadState().batches.find(x => x.id === b.id);
  assert.ok(w.lastActionLabel(after).startsWith('Keyed in '), 'processed shows Keyed in');
  assert.notStrictEqual(after.processedAt, null);

  // A batch with a broken timestamp must still render, not throw.
  assert.strictEqual(w.fmtStamp('not-a-date'), 'unknown time');
});

check('print, view and share all report the same total', () => {
  const w = boot().window;
  // Sales are built directly rather than through taps: the purchase flow has
  // its own tests and a 3s scan lockout between members, and what matters here
  // is that the report adds up. Two members, one buying twice with qty 2, so
  // grouping, quantity and totals all get exercised.
  const mk = (id, name, item, price, qty) => assert.ok(w.addSale({
    id, badgeId: 'IJG1840' + id, memberName: name,
    productId: item, productName: item, sku: item,
    price, qty, at: new Date().toISOString(), batchId: null
  }), 'sale ' + id + ' should save');
  mk('s1', 'Alice A.', 'Gatorade', 250, 1);
  mk('s2', 'Alice A.', 'Protein Bar', 300, 2);
  mk('s3', 'Bob B.', 'Bottled Water', 150, 1);
  const b = w.createBatch();

  const r = w.buildBatchReport(b.id);
  const expected = 250 * 1 + 300 * 2 + 150 * 1; // 1000c — qty must be counted
  assert.strictEqual(r.lineCount, 3, 'three sale lines');
  assert.strictEqual(r.totalCents, expected, 'total must multiply by qty');

  // The same money must appear in both renderings — a printed sheet and a
  // shared copy disagreeing about what a member owes is the worst outcome here.
  const money = w.formatPrice(expected);
  assert.ok(r.html.includes(money), 'HTML report carries the total');
  assert.ok(r.text.includes(money), 'text report carries the total');
  assert.ok(r.text.includes('Alice A.') && r.text.includes('Bob B.'),
    'text report names both members');
  assert.ok(r.html.includes(r.shortId), 'report carries the short id to match a saved sheet');
  assert.strictEqual(w.buildBatchReport('no-such-batch'), null);
});

check('View opens the report on screen and Close puts it away', () => {
  const w = boot().window;
  enrollAndBuy(w, 'IJG18323', 'Viewer', 0);
  const b = w.createBatch();
  const panel = w.document.getElementById('batch-view');
  assert.strictEqual(panel.hidden, true, 'hidden until asked for');

  w.viewBatch(b.id);
  assert.strictEqual(panel.hidden, false, 'View shows the panel');
  assert.ok(w.document.getElementById('batch-view-body').textContent.includes('Viewer'),
    'the report is actually rendered on screen, not just into #print-container');
  assert.ok(w.document.getElementById('batch-view-title').textContent.startsWith('Batch \u2014'));

  w.closeBatchView();
  assert.strictEqual(panel.hidden, true, 'Close hides it again');
});

check('Share is hidden when the platform cannot share, and a cancel is silent', () => {
  const w = boot().window;
  enrollAndBuy(w, 'IJG18324', 'Sharer', 0);
  const b = w.createBatch();

  // jsdom has no navigator.share, which is the desktop/unsupported case.
  assert.strictEqual(w.canShareBatch(), false);
  w.viewBatch(b.id);
  assert.strictEqual(w.document.getElementById('batch-view-share').hidden, true,
    'Share must not be offered where it cannot work');
  assert.ok(!w.document.getElementById('admin-batches').innerHTML.includes('shareBatch('),
    'no Share button in the row either');

  // With the API present, the batch text is handed over...
  let got = null;
  w.navigator.share = (payload) => { got = payload; return Promise.resolve(); };
  assert.strictEqual(w.canShareBatch(), true);
  w.shareBatch(b.id);
  assert.ok(got && got.text.includes('Sharer'), 'shares the batch text');

  // ...and a worker dismissing the sheet must not raise an alert.
  let alerted = false;
  w.alert = () => { alerted = true; };
  const abort = new Error('dismissed'); abort.name = 'AbortError';
  w.navigator.share = () => Promise.reject(abort);
  w.shareBatch(b.id);
  return new Promise(r => setImmediate(() => {
    try { assert.strictEqual(alerted, false, 'a dismissed share is not an error'); r(); }
    catch (e) { r(e); }
  }));
});

/* ---- 18. the gym's logo is present and accessible ---- */
check("the gym's logo is on the scan screen and the batch report", () => {
  const w = boot().window;
  const brand = w.document.querySelector('#idle .brand');
  assert.ok(brand, 'the scan screen carries the logo');
  assert.strictEqual(brand.getAttribute('src'), 'logo.png',
    'a local file, not a link to the gym website — the kiosk is offline-first');
  assert.ok(/Iron Jungle/i.test(brand.getAttribute('alt') || ''),
    'logo needs real alt text, not an empty attribute');
  // width/height attributes are what stop the scan screen jumping on load.
  assert.ok(brand.getAttribute('width') && brand.getAttribute('height'),
    'intrinsic size must be declared to avoid layout shift');

  enrollAndBuy(w, 'IJG18330', 'Logo Tester', 0);
  const b = w.createBatch();
  const r = w.buildBatchReport(b.id);
  assert.ok(r.html.includes('logo.png'), 'printed and viewed reports carry the logo');
  // The shared text copy has no images, so it must still say the gym's name.
  assert.ok(r.text.includes('Iron Jungle'), 'text report still names the gym');
});

/* ---- 19. a suspended camera is revived, not left frozen ---- */
// jsdom reports visibilityState 'prerender' / hidden:true, unlike a real
// browser, so tests that drive the visibilitychange path say so explicitly.
function visible(w) {
  Object.defineProperty(w.document, 'hidden', { value: false, configurable: true });
}
function fakeVideo(w, readyState) {
  let played = 0;
  const video = w.document.createElement('video');
  Object.defineProperty(video, 'paused', { value: true, configurable: true });
  video.play = () => { played++; return Promise.resolve(); };
  video.srcObject = { getVideoTracks: () => [{ readyState: readyState || 'live' }] };
  w.document.getElementById('reader').appendChild(video);
  return () => played;
}

check('a frozen preview is played again when the page comes back', () => {
  const w = boot().window;
  visible(w);
  const played = fakeVideo(w);
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.strictEqual(played(), 1, 'a frozen preview must be played again');
});

check('a window focus also revives the camera', () => {
  // visibilitychange does not always fire for a partially obscured page, which
  // is how the overscroll pull froze it in the first place.
  const w = boot().window;
  const played = fakeVideo(w);
  w.dispatchEvent(new w.Event('focus'));
  assert.strictEqual(played(), 1, 'focus must revive too');
});

check('an ended camera track rebuilds the scanner rather than replaying a corpse', () => {
  const w = boot().window;
  visible(w);
  let starts = 0;
  w.Html5Qrcode = function () {
    starts++;
    return { start: () => Promise.resolve(), pause() {}, resume() {}, stop: () => Promise.resolve() };
  };
  const played = fakeVideo(w, 'ended');
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  return new Promise(r => setImmediate(() => {
    try {
      assert.strictEqual(played(), 0, 'an ended track must not be played');
      assert.strictEqual(starts, 1, 'a fresh scanner is stood up instead');
      r();
    } catch (e) { r(e); }
  }));
});

check('a scanner whose stop() is missing or throws still gets rebuilt', () => {
  // scannerInstance is nulled before stop() is called, so an exception
  // escaping there would leave the kiosk with no scanner and nothing to
  // rebuild it — a dead camera for the rest of the shift.
  const w = boot().window;
  let starts = 0;
  w.Html5Qrcode = function () {
    starts++;
    return { start: () => Promise.resolve(), pause() {}, resume() {} }; // no stop()
  };
  w.restartScanner(); // the boot instance also has no stop()
  return new Promise(r => setImmediate(() => {
    try { assert.ok(starts >= 1, 'must recover despite stop() throwing'); r(); }
    catch (e) { r(e); }
  }));
});

check('reviving mid-purchase does not steal the camera back', () => {
  const w = boot().window;
  visible(w);
  w.onScanSuccess('IJG18340');
  assert.ok(w.document.getElementById('locked').classList.contains('active'),
    'should be on the purchase screen');
  const played = fakeVideo(w);
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.strictEqual(played(), 0,
    'the camera is paused on purpose mid-purchase and must stay paused');
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
