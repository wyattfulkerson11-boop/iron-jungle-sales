/**
 * Acceptance tests for Task 9 — kiosk hardening.
 *
 * Task 9 is mostly CSS, manifest and docs, so these assert on the shipped
 * files rather than runtime behavior. Written BEFORE the implementation.
 * Do not modify this file to make it pass — change index.html / manifest.json /
 * README.md instead.
 *
 * Run: node test-task9.js
 */
const assert = require('assert');
const fs = require('fs');

const read = f => {
  try { return fs.readFileSync(__dirname + '/' + f, 'utf8'); }
  catch { return null; }
};
const html = read('index.html');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(['PASS', label]); }
  catch (e) { results.push(['FAIL', label + ' — ' + e.message]); }
};

/* ---------------- manifest ---------------- */

check('manifest.json is valid JSON', () => {
  const raw = read('manifest.json');
  assert.ok(raw, 'manifest.json must exist');
  JSON.parse(raw);
});

check('manifest declares standalone display and a name', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.strictEqual(m.display, 'standalone',
    'Add to Home Screen must hide the URL bar');
  assert.ok(m.name && m.name.length > 0, 'manifest needs a name');
  assert.ok(m.start_url, 'manifest needs a start_url');
});

check('index.html links the manifest', () => {
  assert.ok(/<link[^>]+rel=["']manifest["']/.test(html));
});

/* ---------------- touch hardening ---------------- */

check('double-tap zoom is suppressed', () => {
  assert.ok(/touch-action\s*:\s*manipulation/.test(css),
    'need touch-action: manipulation so a fast double-tap does not zoom');
});

check('pull-to-refresh is suppressed', () => {
  assert.ok(/overscroll-behavior(-y)?\s*:\s*(none|contain)/.test(css),
    'a pull-to-refresh mid-sale would reload the kiosk');
});

check('long-press callout is suppressed', () => {
  assert.ok(/-webkit-touch-callout\s*:\s*none/.test(css),
    'iOS long-press callout must not appear over the kiosk');
});

check('text inputs remain selectable despite the global user-select rule', () => {
  // body sets user-select:none for the kiosk. The enrollment name field still
  // needs normal text behavior, so there must be an explicit override.
  assert.ok(/input[^{]*\{[^}]*user-select\s*:\s*(text|auto)/.test(css)
         || /user-select\s*:\s*(text|auto)[^}]*\}/.test(css.split('input').slice(1).join('input')),
    'an input rule must re-enable user-select for the name field');
});

/* ---------------- the long-press admin route must survive ---------------- */

check('admin long-press entry is still wired', () => {
  assert.ok(/id=["']idle-title["']/.test(html), '#idle-title must exist');
  assert.ok(/function wireAdminEntry/.test(html), 'wireAdminEntry must exist');
  assert.ok(/touchstart/.test(html) && /mousedown/.test(html),
    'long-press listeners must still be attached');
});

/* ---------------- camera failure is explained ---------------- */

check('a denied camera produces an actionable message', () => {
  assert.ok(/\.catch\s*\(/.test(html),
    'start() is async — its rejection must be handled');
  assert.ok(/permission/i.test(html),
    'the message must tell the worker what to actually do');
});

/* ---------------- offline invariant ---------------- */

check('no CDN or remote script/style references', () => {
  const tags = html.match(/<(script|link)[^>]*>/g) || [];
  const remote = tags.filter(t =>
    /(src|href)\s*=\s*["']https?:\/\//.test(t) && !/rel=["']manifest["']/.test(t));
  assert.strictEqual(remote.length, 0,
    'offline-first is load-bearing; found: ' + remote.join(' | '));
});

/* ---------------- README ---------------- */

check('README documents the storage key and the two placeholders', () => {
  const r = read('README.md');
  assert.ok(r, 'README.md must exist');
  assert.ok(/ij\.v1/.test(r), 'must document the localStorage key');
  assert.ok(/CATALOG/.test(r), 'must say how to edit the catalog');
  assert.ok(/ADMIN_PIN/.test(r), 'must say how to change the PIN');
});

check('README documents the origin constraint', () => {
  const r = read('README.md');
  assert.ok(/origin/i.test(r), 'must mention the origin');
  // localStorage is origin-scoped: changing host orphans every enrollment
  // and every unexported sale. This is the single most expensive deploy mistake.
  assert.ok(/orphan|lose|lost|never change|cannot change/i.test(r),
    'must state the consequence of changing the origin, not just the rule');
});

check('README explains how to change the report column order', () => {
  const r = read('README.md');
  assert.ok(/printBatch|column/i.test(r),
    'the worker\'s entry screen may want a different order');
});

let failed = 0;
for (const [status, label] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status}  ${label}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
