# Gym Counter Sales Tracker — Build Spec

> **For Hermes:** Implement task-by-task, in order, committing after each.
> Nothing blocks you — start at Task 1. The `test-driven-development` skill fits
> this spec's shape: every task's "must fail if" is the test to write first.
>
> This spec was rewritten after an adversarial review ([reviews/review-plan.md](../../reviews/review-plan.md))
> found the previous version would double-bill members and lose sales silently.
> Where a task says "must fail if," that's the review finding — it is not optional
> polish, and a task is not done until that case is verified.
>
> **Two placeholders, both marked `FILL IN` in the code.** The catalog (Task 3)
> and the admin PIN (Task 8). Build against the placeholders; they're each a
> one-line edit later. Do not block on them and do not ask.

**Goal:** An offline-first iPad kiosk that captures gym counter sales legibly and
completely, so a worker can key them into the gym's member software without
deciphering handwriting. No payments. No network dependency after install.

**Scope boundaries — do not build these:** payment processing, gym-software API
integration, a product-management UI, user accounts, any server, any build step.

**Stack:** one `index.html`, vanilla JS, `localStorage`, vendored `html5-qrcode`.
No framework, no bundler, no npm install.

**Deployment is not yours.** Hosting, Guided Access, and real-device testing are
handled separately. Build and verify in a desktop browser.

---

## Architecture

Single page, four screens, one state machine:

```
idle ──scan──> locked ──tap item──> recording ──persisted──> success ──2s──> idle
                 │                                              │
                 └──"Not [Name]?"──> enroll ────────────────────┘
```

Plus an admin view behind a PIN, reachable only from `idle`.

### Storage shape

One `localStorage` key, `ij.v1`, holding:

```js
{
  schema: 1,
  members: { "<badgeId>": { name: "Jane D.", enrolledAt: "<iso>" } },
  sales: [{
    id: "<uuid>",            // crypto.randomUUID()
    badgeId: "<string>",
    memberName: "<string>",  // snapshot at sale time
    productId: "<string>",
    productName: "<string>", // snapshot — catalog renames must not rewrite history
    sku: "<string>",         // snapshot
    price: 350,              // integer cents, snapshot
    qty: 2,
    at: "<iso utc>",
    batchId: null            // set when exported
  }],
  batches: [{
    id: "<uuid>",
    createdAt: "<iso>",
    saleIds: ["<uuid>"],     // immutable once created
    status: "pending" | "processed",
    processedAt: "<iso>|null"
  }]
}
```

`ponytail:` one JSON blob rewritten per sale. Fine at this volume (tens of sales
a day, single tab enforced physically by Guided Access). If it ever runs on two
tabs or hits thousands of records, move to IndexedDB with per-record writes.

---

## Task 1 — Scaffold and vendor the scanner

**Objective:** Project skeleton with the scanner dependency committed to the repo.

**Files:** create `index.html`, `vendor/html5-qrcode.min.js`, `.gitignore`

1. `git init` if not already a repo.
2. Download `html5-qrcode` at a **pinned version** into `vendor/` and commit the
   file. Record the version and the URL it came from in a comment at the top of
   `index.html`.
3. `index.html`: doctype, viewport meta with `user-scalable=no`, a web app
   manifest link, `<script src="vendor/html5-qrcode.min.js">`, and four empty
   screen containers (`#idle`, `#locked`, `#success`, `#admin`).

**Must fail if:** the page references any CDN, or any `https://` URL in a `src`
or `href` that isn't the manifest. The offline guarantee is load-bearing — a
cache eviction that breaks scanning sends the workers back to paper on day one.

**Verify:** load `index.html`, open devtools Network, disable network, hard
reload from a local HTTP server — page renders, no failed requests.

**Commit:** `chore: scaffold + vendor html5-qrcode <version>`

---

## Task 2 — Storage layer

**Objective:** Read/write helpers that cannot silently lose a sale.

**Files:** modify `index.html`

1. `loadState()` — reads `ij.v1`, returns the default shape if absent. On a JSON
   parse failure or a `schema` mismatch: do **not** overwrite. Rename the bad key
   to `ij.v1.corrupt.<timestamp>`, start fresh, and set a flag the admin view shows.
2. `saveState(state)` — wraps `setItem` in try/catch and **returns a boolean**.
   Never throws.
3. `addSale(sale)` — load, push, save; returns the save result.

**Must fail if:** `saveState` returning `false` is ignored anywhere. Every caller
checks it. A kiosk that shows "Done!" while persisting nothing is the worst
possible failure mode here — quota exhaustion and Private Browsing both produce it.

**Verify:** a `demo()` self-check with asserts — round-trips a sale; simulates a
throwing `setItem` and asserts `addSale` returns `false`; writes garbage to the
key and asserts `loadState` quarantines rather than crashes.

**Commit:** `feat: guarded localStorage layer`

---

## Task 3 — Product catalog

**Objective:** The tappable grid, driven by a hardcoded catalog.

**Files:** modify `index.html`

1. `const CATALOG = [...]` — each entry `{id, name, sku, price}`, prices in
   integer cents. **FILL IN:** seed it with ~8 plausible gym items (water,
   Gatorade, protein bar, pre-workout, shaker, etc.) at plausible prices, and
   put a comment above it saying these are placeholders to be replaced with the
   real fridge and shelf contents. `sku` can mirror `id` until real SKUs exist.
2. Validate at startup: unique `id`, unique `sku`, non-empty name. Throw loudly
   on a violation — better a blank screen in dev than a mis-SKU'd charge in prod.
3. Render a CSS grid of buttons. **Minimum 88×88pt touch targets**, name and
   price visible, high contrast. No hover states — there is no cursor.

**Skipped:** any product-management UI. Price changes are a code edit and a
refresh. Adding one is the classic weekend-build time-sink.

**Verify:** grid renders every catalog entry; duplicate SKUs throw at startup.

**Commit:** `feat: product catalog grid`

---

## Task 4 — Scanner state machine

**Objective:** Scanning that locks to exactly one member per purchase.

**Files:** modify `index.html`

1. Single `state` variable: `'idle' | 'locked' | 'recording' | 'success'`.
2. Camera starts on entering `idle`. On a valid decode:
   **pause the camera immediately**, set `state = 'locked'`, store the badge ID.
3. While `locked`: decodes are ignored entirely. The member is frozen through
   submission. A "Cancel" button returns to `idle` and resumes the camera.
4. Item buttons are `disabled` in every state except `locked`.
5. Secondary guard: a 3-second lockout after any successful read, so a badge left
   sitting in frame can't immediately re-trigger on resume.

**Must fail if:** a second badge entering frame during item selection can replace
the locked member. Pausing the camera is the primary fix; the lockout alone is
not sufficient, because a badge that stays in frame re-decodes forever.

**Verify:** with a simulated decode function — fire two decodes 100ms apart,
assert only the first is accepted; assert item buttons are disabled while `idle`.

**Commit:** `feat: scan state machine with camera lock`

---

## Task 5 — Enrollment

**Objective:** Badge → name, self-service, correctable.

**Files:** modify `index.html`

1. On `locked` with an unknown badge ID: show a name field, save to
   `state.members` on submit. Handle the `saveState` failure — don't proceed on false.
2. On `locked` with a known badge: greet by name, and show a
   **"Not [Name]?"** control that reopens the name field and remaps the badge.
3. Item buttons stay disabled until a name is linked. A member must not be able
   to skip enrollment and walk away with an anonymous sale.
4. Names are trimmed, collapsed whitespace, max 40 chars, non-empty.

**Must fail if:** the first person to scan a badge can bind it permanently with
no correction path. Typos, pranks, and shared family cards are expected, not edge cases.

**Verify:** enroll a new badge, reload, assert the name persists; remap it,
assert the new name sticks and prior sales keep their original snapshot.

**Commit:** `feat: enrollment with remap escape`

---

## Task 6 — Sale capture

**Objective:** One tap, one sale, exactly once.

**Files:** modify `index.html`

1. Item tap → `state = 'recording'` and **synchronously disable every product
   button in the same handler**, before any async work.
2. Quantity: default 1. A small +/− stepper on the locked screen, capped at 10.
   The one-item path must remain scan → tap → done, with no extra step.
3. Build the sale with `crypto.randomUUID()` and the product snapshot per the
   schema. `addSale()`. Only on `true` → `success` screen.
   On `false` → an error state that keeps the member locked so they can retry.
4. `success` shows name + item + qty for 2 seconds, then returns to `idle`.

**Must fail if:** a double-tap on a lagging button produces two sales. Disabling
must happen in the same synchronous block as the first accepted tap, not in a
callback.

**Verify:** self-check fires the item handler twice in a row, asserts exactly one
sale recorded.

**Commit:** `feat: one-shot sale capture with quantity`

---

## Task 7 — Export batches

**Objective:** The worker pulls a report, keys it, confirms it. No double billing.

**This is the most important task in the spec.** Get it wrong and members get
charged twice for the same drink, which is worse than the paper system it replaces.

**Files:** modify `index.html`

1. **Create batch:** collect all sales with `batchId === null`, mint a batch ID,
   stamp it onto those sales, push the batch as `status: 'pending'`. Membership
   is immutable after creation.
2. **Print:** a `@media print` stylesheet renders exactly that batch. Columns:
   **member name · item · qty · price · time**, grouped by member and sorted by
   name, so the worker keys one member's whole tab at once instead of hopping
   accounts. Header shows batch ID, date, and total line count; footer shows the
   batch total. Call `window.print()`.
   Keep the grouping in one function — the real entry screen may want a
   different order, and that's a one-function change after the first real pull.
3. **Confirm separately.** The batch stays `pending` after printing. The admin
   view lists pending batches with an explicit "I've keyed this in" button that
   flips it to `processed`.
4. **Reprint:** any batch, pending or processed, reprints with the same batch ID
   and the same contents. A reprint never creates a new batch and never re-bills.
5. History: processed batches listed for 30 days.

**Must fail if:** sales are marked exported when the print dialog opens. The user
can cancel it, the print can fail, the PDF can be lost — and `window.print()`
returns no signal about any of that. Only the worker's explicit confirmation,
*after* keying, may mark a batch processed.

**Verify:** create a batch; assert a second create yields an empty batch (nothing
pending); assert reprinting doesn't duplicate; assert a new sale after batch
creation lands in the *next* batch, not the open one.

**Commit:** `feat: export batch lifecycle`

---

## Task 8 — Kiosk/admin split

**Objective:** The counter screen shows nothing private; destructive actions are gated.

**Files:** modify `index.html`

1. Admin PIN as a single named const. **FILL IN:** use `0000` and comment it as
   a placeholder to change before the iPad goes on the counter. Entry: a
   long-press on the page header, then the PIN. Three wrong attempts → 30s lockout.
2. Behind the PIN: pending/processed batches, create-export, confirm-processed,
   reprint, the member list with remap, the corrupt-storage flag, and clear-data.
3. **Kiosk mode shows no history and no other member's name, ever.** The success
   screen clears on its 2s timer even if nobody touches the iPad.
4. Clear-data requires: typing `CLEAR`, plus a warning naming the exact count of
   unexported sales about to be destroyed. Blocked entirely while any batch is `pending`.

**Must fail if:** any path from the idle screen reaches member history or the
clear control without the PIN. "Hidden" is not authorization — a bored member
will find a long-press.

**Verify:** assert the admin view is unreachable without the PIN; assert clear is
refused with a pending batch.

**Commit:** `feat: PIN-gated admin view`

---

## Task 9 — Kiosk polish

**Objective:** It survives being an always-on appliance.

**Files:** modify `index.html`, create `manifest.json`, `README.md`

1. `manifest.json` — standalone display, name, icon, so Add to Home Screen hides
   the URL bar.
2. Disable text selection, long-press callouts, double-tap zoom, and pull-to-refresh.
3. If camera permission is denied or unavailable: a clear message naming what the
   worker should do, not a blank screen or a spinner.
4. `README.md`: the storage schema, how to edit the catalog, how to change the
   PIN, how to change the report's column order, and the deployment constraint — **the origin can never change after data
   exists**, because `localStorage` is origin-scoped and a hostname change
   orphans every enrollment and every unexported sale.

**Commit:** `feat: kiosk manifest and hardening`

---

## Done means

All nine tasks committed, every `demo()` self-check passing, and the page loading
and completing a full scan → tap → export → confirm cycle with the network
disabled. Hand off for real-device deployment at that point — do not attempt
hosting or iPad setup yourself.
