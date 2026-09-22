# Owner feedback 2026-09-17 — plan

**Source:** `~/Desktop/_tasks/hands-off/2026-09-18_iron-jungle-owner-feedback-handoff.md` ·
**Baseline:** `264578d`, `main == origin/main`, six suites green (re-run 2026-09-18).
**Labels:** `VERIFIED` = I ran it this session · `TOLD` = Wyatt/owner said it · `INFERRED` = reasoning.
**Previous build plan** lives in git (`git show 4f1993e:PLAN.md`); this file replaces it.

## A. Findings from review (read before the items)

1. `VERIFIED` Baseline: `test-browser` 33/33, `test-task8` 14/14, `test-fixes` 12/12, `test-storage` 17/17,
   `test-task9` 13/13, `test-catalog` 4/4; `index.html` 2015 lines / 88,474 B; `ADMIN_PIN = '0311'` at :1402;
   groups 58/57/26/9; `serviceWorker` count 0; no undo/void/delete in `index.html`.
2. `VERIFIED` **No inactivity timeout anywhere.** The only `setTimeout`s are the success screen (:963) and the
   admin long-press (:1568). A member who scans and walks away leaves the kiosk on *their* grid with the camera
   paused; the next person's tap **bills the first member**.
3. `VERIFIED` **Admin doesn't leave `idle`.** `showAdminPinPrompt` (:1546) only calls `showScreen('admin')`, so
   `state` stays `'idle'` and the scanner keeps running. A card in view while a worker is in admin fires
   `enterLocked` and yanks them onto a member grid. Admin also never times out, which leaves Confirm and Clear exposed.
4. `VERIFIED` **The batch report never shows the badge ID.** `buildBatchReport` (:1236) groups and prints by
   `memberName` only. The worker keys by self-typed name, and two members with the same name merge into one group.
5. `VERIFIED` Midday print needs a batch: `printBatch(batchId)`. So "print at midday" = Create batch + Print, and the
   afternoon lands in a second batch. No double-billing either way, because confirmation is per batch (invariant 2).
6. `VERIFIED` The 8 photos in `Item lists and fridge/` are POS screens and the fridge. **No keytag.**
7. `VERIFIED` `RUNBOOK.md:14,20` and `README.md:55` still say `0000`.
8. `VERIFIED` **Clear all data deletes unbatched sales.** `clearAllData` refuses only when a *batch* is pending; its
   own prompt (:1533) says it "will permanently delete N unexported sale(s)". A single `CLEAR` wipes a day's un-pulled sales.

## B. §5 open questions — adjudicated

| # | Question | Answer |
|---|---|---|
| 1 | Key in once at EOD or per batch? | **Ask staff, pre-trial.** `TOLD` "i think" EOD. Item 7 works either way: both batches can be keyed at EOD. |
| 2 | Number human-readable on the tag? | `ANSWERED` 2026-09-22 (owner): **yes — printed directly under the barcode.** The typing screen said "on the front of your card"; now names the actual spot. |
| 3 | Real number shapes beyond `IJG18399`? | **Ask owner.** Blocks only a tighter regex. Build with the existing `BADGE_RE`; tighten later at the one knob. |
| 4 | Desk speed at number-by-name lookup? | **Ask owner.** Decides whether typed entry gets used, not how it's built. |
| 5 | Midday batch acceptable to staff? | **Ask staff — pre-trial gate for item 7.** If they say no, item 7 falls back to EOD-only, and the trial runs with the full-day loss window stated plainly. |
| 6 | Camera vs keyboard hazard | `VERIFIED` by code: `onScanSuccess` (:1788) and `reviveScanner` both return unless `state === 'idle'`. A `'typing'` state makes scans inert and stops revive. `INFERRED`: the rear camera can't see the on-screen keypad. Cancel/timeout → `returnToIdle()` → `resumeScanner()`. |

## C. Pre-trial call

**Ship items 1–6 before the trial. Item 7 is procedure plus one small nudge. Item 8 waits.** Argued past "no speculative features":
1–2 fix verified defects that bill the wrong member or wedge admin. 3 changes the report, and it's versioned so
it can't break invariant 3. 4–5 were asked for by the owner and decided by Wyatt. 6 fixes a failure already seen on the iPad
(2026-09-12 wifi drop). None needs an owner answer to be correct. The §5 asks go to the owner in the same visit as the iPad setup.

## D. Items

Each item is a targeted edit to `index.html` (plus a new `sw.js`). Tests are written first in a new `test-owner.js`,
using jsdom with the same `boot()` as `test-browser.js`. There are no new dependencies.

1. **Inactivity timeout (kiosk).** `locked`, enroll and `typing` return to idle after 45 s with no touch. Every
   `touchstart`/`input` resets the timer, entering a state starts it, and idle clears it. The timer skips `recording`/`success`.
   *Must fail if:* after scan + 45 s (fake timers) state ≠ `idle`, or a product tap then records a sale; a tap at 44 s
   doesn't extend it; the timer interrupts `recording`.
2. **Admin is a real state.** On a correct PIN: `state='admin'`, `pauseScanner()`. "Back to kiosk" → `returnToIdle()`.
   Admin inactivity timeout is 3 min, reset by any touch, and it returns to idle.
   **Clear all data is also refused while any non-voided sale is unbatched** (A8), same as for a pending batch.
   *Must fail if:* `onScanSuccess('IJG18399')` while admin is open changes state or screen; admin doesn't time out;
   leaving admin doesn't resume the scanner; the `#idle-title` long-press stops opening admin (invariant 10);
   `clearAllData('CLEAR')` succeeds while an unbatched non-voided sale exists.
3. **Identity on the report, versioned.** New sale field `entry: 'scan'|'typed'`. A missing value means `'scan'`.
   `createBatch` stamps `reportV: 2` on new batches. `buildBatchReport` renders the **Member #** column, the **TYPED**
   marker and the **"✓ desk checked"** box (typed lines only) **only when `batch.reportV === 2` or any of its sales carries
`entry` or `voidedAt`**. The second condition covers a stale page that batched new sales without stamping `reportV`. Older batches keep the
   exact old HTML/text, and a golden-string test pins that output. v2 groups by `badgeId`, labelled with the name.
   Stale-client rule: in any batch, a line with `voidedAt` renders as VOID and is excluded from the total,
   whatever the `reportV`. Truly old batches can't contain one, so their output is unchanged. This covers a
   pre-deploy page still open and batching a sale that a new page voided.
   *Must fail if:* a batch with no `reportV` renders anything different from the committed golden output
   (captured from `264578d` before any edit); v2 HTML or text lacks the badge ID; a typed line lacks TYPED + the check box;
   two badges sharing a name merge.
4. **Typed entry.** An idle-screen button, "No card? Type your member number", below the scan frame (never on
   `#idle-title`). Tap → `state='typing'`, `pauseScanner()`, and a text input (`autocapitalize="characters"`,
   `autocomplete="off"`) with Continue and Cancel. Invalid per `normalizeBadgeId` → inline error, stay put. Valid →
   **the typing screen also asks for their name. The kiosk never reveals the saved name on the typed path.** On Continue:
   a number that isn't enrolled → enrol it under the typed name (first time, per Wyatt's rule). An enrolled number whose saved
   name matches (case, spacing and punctuation ignored) → `entryMode='typed'; state='idle'; enterLocked(id)` in one
   synchronous handler. **Mismatch → "That number and name don't match — please see the front desk", no item grid, nothing
   written.** This is Wyatt's "name matches a number" rule, enforced at the kiosk. Without it, typing a victim's number would
   make the kiosk *supply* the victim's name, and the desk gate would pass. Rebind is never offered on the typed path;
   typed "Not you?" returns to the typing screen. `enterIdle()` resets `entryMode='scan'`.
   Accepted residue (`INFERRED`): someone who knows both a member's number and their name can still buy as them. The
   form reveals whether a number is enrolled (enroll vs mismatch). Both stay flagged TYPED for the desk.
   **Desk gate (runbook + printout):** before keying a TYPED line, look up the Member # in the POS. If the name
   doesn't match the number's owner, **don't bill it**: circle it, leave it unkeyed, and sort it out with the member at the desk.
   The kiosk can't check this itself. It has no roster, and the desk is the check.
   *Must fail if:* an enrolled number + wrong name reaches `locked` or renders the saved name anywhere in the DOM;
   an enrolled number + matching name (different case/spacing) is refused; a scan during `typing` changes state; garbage reaches `locked`; typed "Not you?" renders the rebind form or
   writes `members`; a typed sale has `entry !== 'typed'`; the next scanned sale has `entry === 'typed'`; Cancel doesn't
   resume the scanner.
5. **Void while Pending.** Two surfaces, one function `voidSale(id)`. It reloads state and is allowed only if the sale is
   unbatched or its batch is `pending`, and not already voided. The first void wins and is never rewritten. It sets `voidedAt` and
   `voidedBy: 'member-undo'|'admin'` (both shown on the report), **never removes the sale from `saleIds`** (invariant 1 holds),
   and saves. A failed save means no "voided" message.
   (a) The success screen shows "Wrong item? Undo" and stays 5 s instead of 2 s. The success timeout keeps its handle and the
   sale id. Undo and every early exit clear it, and the callback no-ops unless `state==='success'` for that same sale.
   (b) In admin, each Pending batch's view lists its lines with a Void button, and "Waiting" (unbatched) sales get one too.
   The report renders a voided line struck through with **VOID**, excluded from line count and total.
   Processed batch → `voidSale` returns false and changes nothing.
   Runbook: always key from a fresh View/print at keying time, not the midday paper.
   *Must fail if:* a voided line counts in the total; voiding a sale in a processed batch changes any byte of its reprint;
   a denied write reports success; a double tap throws or double-writes; `saleIds` shrinks; a second void rewrites
   `voidedAt`/`voidedBy`; Undo → scan → open grid → 5 s later the stale timer sends the kiosk to idle.
6. **Service worker, network-first.** `sw.js` at the repo root, scope `./` (same origin, invariant 5 unaffected).
   Versioned cache `ij-shell-v<N>`. `install` precaches `./`, `index.html`, `logo.png`, `manifest.json` and the vendored scanner.
   If `addAll` fails, install fails and the page behaves exactly like today. `activate` deletes other `ij-shell-*` caches, then
   calls `clients.claim()`. Fetch for a navigation is network with a 3 s timeout, falling back to cached `index.html`
   (this covers `start_url` variants); assets use the same timeout, then cache. Successful network responses refresh the cache.
   Registration is guarded by `'serviceWorker' in navigator`. `install` calls `skipWaiting()`.
   Why one online reload is enough (`INFERRED`, proven in E3): every SW version is network-first for navigations, so even an
   *old* worker hands the page the *new* `index.html` online. Only a `sw.js` change needs activation, and `skipWaiting` does
   that. The new cache is fully populated in `install` before `activate` deletes the old one, so the last-known-good shell
   is always the newest complete one. The admin footer shows `BUILD` and the controlling worker's cache name.
   **SW rollback is not a revert.** Reverting `sw.js` leaves the installed worker in place. The rollback is a committed
   kill-switch `sw.js` (in `install`: `skipWaiting`; in `activate`: delete every `ij-shell-*` cache, then
   `self.registration.unregister()`). Network-first navigation means the browser fetches it on the next online launch. It's kept
   in RUNBOOK, ready to paste, and rehearsed in E3.
   Multi-context guard: a `storage` event (another same-origin page wrote `ij.v1`) makes this page reload itself if it's idle,
   and otherwise show "Another copy of the kiosk is open — close it", blocking writes until reload.
   *Must fail if (jsdom):* a dispatched `storage` event for `ij.v1` lets the page record a sale without reloading.
   *Must fail if (manual, real browsers, no new deps):* desktop Chrome DevTools → Offline → reload doesn't render; a push of
   version N+1 isn't served after one online reload; a throttled 10 s network doesn't fall back within ~3 s; the iPad
   home-screen app doesn't open with wifi off after one online launch.
7. **Loss window: procedure + one nudge.** RUNBOOK: whoever is on the desk at **shift change (or noon)** does
   Create batch → Print, and puts the sheet in the tray. That paper is the copy that survives a dead iPad. Share → Mail to the gym
   inbox is optional, used only once receipt has been checked (E3). Leave the batch Pending; at EOD View fresh, key both, confirm each.
   Nudge: admin shows the **age of the oldest waiting sale**, in red when it's over 6 h, so a missed checkpoint is visible
   the next time anyone opens admin. Admin also shows **storage used** (`ij.v1` length against the quota measured in E3a; 2.5 M chars until then), in red at 40%.
   That stops well short of the deadlock item 2 creates near a full quota (a sale can't save, and Clear is refused while sales
   are unbatched). Red means build the item 8 prune next.
   Fix the `0000` doc lines at the same time.
   Being plain about the limits: enrollments aren't in any batch, so a lost iPad means members re-enter their names once.
   *Must fail if:* the oldest-waiting age is wrong or ignores voided/batched sales; (on device) AirPrint doesn't reach the
   desk printer (`UNMEASURED` until E3).
8. **DONE 2026-09-22, trigger fired early.** The owner's real volume is ~200 sales/day (`TOLD`: 7-8 sheets x ~25),
   4x the guess, and a simulated 200-sale day measured 474 chars/sale (`VERIFIED`). The iPad's real limit measured
   **10.4 MB / ~54 days** (`VERIFIED` on device). So pruning shipped now: confirmed batches older than 30 days are
   deleted when a batch is confirmed, plus a manual "Clear keyed-in history"; members are never touched, and the
   printed/PDF copy is the archive. Steady state ~55% full; the admin readout warns at 75%. Until then the existing guard holds: a denied write never looks like success (invariant 4). "Backup now" JSON + restore (trigger: a real loss despite item 7, because restore is the dangerous
   half). Tighter `BADGE_RE` (trigger: Q3 answered). Home-screen monogram (trigger: owners send one).

## E0. Release order (one commit each, each deployable and revertable on its own)

1. **Readers first, and this is the rollback floor.** `createBatch`/`pendingSaleCount`/clear skip `voidedAt`; the report renders
   VOID and v2 fields when present. Nothing writes them yet. Once any later commit has written `entry`/`voidedAt`/`reportV`,
   **never revert below this commit.** A revert above it is data-safe, because the floor already reads everything later commits write.
   Proven by test, not asserted: `test-owner.js` carries a fixed v2 fixture (scanned + typed + voided sales, one Pending and one
   Processed batch). The floor-reader tests (totals exclude VOID, reprint shows VOID, Confirm works, a new sale still records)
   must pass **at the floor commit itself**. The floor's hash goes into RUNBOOK as "never revert below".
2. Items 1–2 (timeouts, admin state, clear guard) plus BUILD.
3. Item 3 writers (`entry`, `reportV`).
4. Item 4 (typed). 5. Item 5 (void). 6. Item 6 (SW + storage guard), last, because it's the delivery layer.
Each commit: suites green → push → BUILD matches on iPad → a quick smoke of what that commit touched. Full E3 after the last one.
Feature flags are rejected: every commit is a revert unit, and there's one kiosk.

## E. Verification before trial (fresh output, not claims)

1. All six existing suites plus `test-owner.js` green; `git diff --stat` shows targeted edits (no regenerated
   `index.html`); no existing test file touched.
1a. Close every Safari tab on the iPad that has the kiosk URL open. A pre-deploy page predates any guard, so this
   procedural fence is the only one possible against it. `UNMEASURED`: whether the home-screen app shares storage with Safari on
   this iOS version. The fence makes the answer irrelevant.
2. `const BUILD = '<yyyy-mm-dd.n>'` is shown in the admin footer and bumped every commit. After push, wait ~30 s,
   force-reload, and don't start E3 until admin shows the new BUILD.
3. **On the iPad, under Guided Access, before the production slate:** first check admin for smoke-test batches and write
   down what's there. Then: scan → walk away 45 s → idle; open admin, hold a card to the camera → nothing happens; admin
   untouched 3 min → idle; type garbage → rejected; typed "Not you?" → typing screen; type a real test number → buy two items →
   Undo one → create batch → View shows Member #, TYPED, check box and a VOID line; Void another from admin; **AirPrint to the
   desk printer**; Share → Mail and check on the receiving end that the batch ID, line count and TYPED are present; wifi off →
   close app → reopen → kiosk loads.
3a. **Capacity, measured on the iPad:** in admin-free dev mode, a one-off console snippet writes filler under a *scratch* key
   until `setItem` throws, records the char count, and removes the key (never touching `ij.v1`). That real quota replaces the
   assumed 2.5 M budget in item 7. `test-owner.js` also renders a 500-line batch and asserts the report builds and the total
   is correct (a large-batch soak).
3b. **Rollback drill on the iPad, with test data still in place:** deploy the floor commit → BUILD matches → the typed/voided test
   batch still shows VOID, the right total and TYPED, and a new scan sale records → redeploy HEAD. Then push the kill-switch `sw.js`
   → online launch → confirm no worker is controlling the page (admin shows none) → restore the real `sw.js`.
4. **Clean slate:** confirm every test batch → Clear all data (`CLEAR`). Then admin must show "Nothing waiting" and no
   batches. Only after that does the iPad go on the counter.

## Changelog

**Round 1 (Codex):**
- Took: void during Pending, not just unbatched. It's now an admin surface too, marks VOID, keeps membership, and is refused once Processed.
- Took: invariant 3. The report is now versioned (`reportV: 2`), with a golden test pinning the legacy output. Noting the change isn't enough.
- Took: a desk gate for TYPED lines (a check box on the printout, plus a runbook rule to not bill a mismatch).
- Took, and verified in code: admin keeps `state='idle'` with the scanner live. Admin is now its own state, with a timeout.
- Took: SW lifecycle spelled out. Playwright is dropped in favor of manual real-browser checks, so no new dependency.
- Took: loss-window owner, trigger and missed-run visibility (age of the oldest waiting sale). Staff acceptance is now a pre-trial ask.
- Took: device test uses retained test data, then an explicit clean slate. Mail counts only after receipt is checked. A BUILD marker is added.
- Rejected: nothing this round.

**Round 2 (Codex, security/integrity):**
- Took: typed path must not supply the saved name. Typed entry now asks for the name and blocks a mismatch
  before the grid. This is Wyatt's own rule, and the reviewer showed the desk gate alone was vacuous for an enrolled number.
- Took, verified at :1533: Clear all data now refuses while unbatched sales exist.
- Took: success timer handle + sale-id guard; void is first-write-wins with `voidedBy`; voided lines render VOID in any
  batch (stale-client case).
- Rejected: moving the PIN off the repo / persisted lockout. The repo being public with the PIN readable is a settled, documented
  tradeoff (the PIN locks the physical device at a staffed counter), §9 forbids renaming it, and a device-local PIN that's
  lost with storage would lock the gym out of its own sales. Docs will stop restating the PIN.
- Rejected: a revision-checked single-writer store. The kiosk is one Guided Access context. The real multi-writer case is a stale
  pre-deploy page, and that's covered by the VOID-in-any-batch rule and E2 (don't use it until BUILD matches).
- Rejected: crash between `addSale` and the success screen. They are adjacent synchronous statements, and a duplicate from a retry
  is exactly what admin Void (item 5b) corrects. A required void *reason* is also out: friction at the counter, and `voidedBy` +
  VOID on the report are the audit.

**Round 3 (Codex, ops):**
- Took: rollback safety via release order. A readers-first commit is the rollback floor, so no build that runs after v2 data exists
  can misread a void.
- Took: `skipWaiting` + why network-first makes one reload sufficient; worker cache name shown in admin.
- Took, the cheap half of the multi-writer finding: a `storage`-event guard. Two live contexts reload or block instead of silently
  overwriting. Still rejected: revision leases. A stale pre-deploy page predates any guard it could run, and E2 covers it.
- Took: staged commits (E0) instead of flags. Storage-used readout; measured growth (362 chars/sale) with a pruning trigger.
- Rejected: operator-verified "paper copy" status. `window.print()` gives no delivery signal, so a stored "printed" flag would
  record the tap, not the paper. The runbook's EOD tray check is the honest control.
- Rejected: a full health panel (online source, last save error…). BUILD, worker cache, waiting age and storage use cover the
  decisions staff actually make. A failed save already alerts at the counter.

**Round 4 (Codex, ops):**
- Took: rollback proven by a v2 fixture test that must pass at the floor commit; floor hash pinned in RUNBOOK.
- Took: measure the real iPad quota (scratch key) and add a 500-line batch soak test. Real volume comes from week 1.
- Took: a procedural fence for stale Safari contexts (close tabs before the first v2 deploy).
- Rejected (third time): revision/minimum-writer fencing. Code already running before the fence can't obey it, and new-vs-new
  is covered by the `storage` guard.
- Rejected: retaining the N-1 SW cache. Network-first means a broken N is broken online too. The fix is a revert commit, and nobody at
  the counter can judge "N is broken, promote N-1". The SW also ships last, after the app changes have passed E3.
- Rejected (again): a "copy in tray" attestation, for the same reason as round 3. A tap isn't paper. EOD tray check stays in the runbook.

**Round 5 (Codex, ops), final:**
- Took: SW rollback = a kill-switch worker that unregisters and clears caches, rehearsed on the iPad. A plain revert can't remove an installed worker.
- Took: a batch containing any `entry`/`voidedAt` sale renders v2 regardless of `reportV`, so a stale writer can't hide TYPED/VOID.
- Took: rollback drill on the real iPad path (E3b) before the clean slate.
- Took: the near-quota deadlock is real (my own Clear guard causes it). The red warning is now at 40% of the measured quota, far from it.
- Rejected (third time): per-batch `copyVerifiedAt`. Same reason as before: an attestation tap isn't paper.
- Open, not resolved by this loop: §5 Q1–Q5 need the owner/staff; sales volume is `UNMEASURED` until week 1.
