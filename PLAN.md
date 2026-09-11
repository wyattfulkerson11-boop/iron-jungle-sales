# Iron Jungle — Counter Sales Capture

**Sources:** [council report](/Users/wyattfulkerson/Desktop/_tasks/hands-off/2026-09-09_ask-the-council-report.md) · [codex plan review](reviews/review-plan.md) · [IDEA.md](IDEA.md)

Replace the paper honor-system sheet with an always-on iPad at the counter.
Member scans their existing gym barcode, taps an item, done. A worker pulls a
legible report whenever they want to key sales into the gym's member software.

**Settlement doesn't change.** No payments, no integration with the gym's
software, no server. That's what keeps this weekend-scale and the gym's risk at zero.

---

## Decisions already made — not reopening

- **Build it.** The council's validation-first argument was heard and answered.
- **Which software the gym runs is out of scope.** The artifact produces a
  legible record; the worker keys it into whatever they already use. The only
  thing the software's identity would have changed is whether to build at all.
- **iPad kiosk, not a QR-to-phone form.** Fastest path out the door wins.

---

## What the review changed

Codex reviewed the original plan ([reviews/review-plan.md](reviews/review-plan.md)) — 20 findings. Stripping
the build-or-don't-build ones, six real defects remain, and all six are in the
code, not the premise:

1. **Export was a print button, not a lifecycle.** `window.print()` gives no
   success signal. Cancel the dialog or lose the PDF and sales either vanish or
   get billed twice. Worst finding in the set; fixed as a batch that stays
   pending until the worker confirms after keying.
2. **CDN scanner contradicts "offline-first."** One cache eviction and scanning
   dies — the exact first-friction failure that sends workers back to paper.
   Vendored and pinned instead.
3. **No scan state machine.** A bystander's badge could replace the locked
   member mid-purchase. The camera now pauses on a valid read; the council's
   3-second lockout is the backup, not the fix.
4. **No sale IDs, no quantity, no double-tap guard.** Two taps on a lagging
   button produced two indistinguishable charges.
5. **Silent storage failure.** A failed `setItem` still showed "Done!" — the
   worst possible failure mode on a kiosk.
6. **Product data not snapshotted.** Renaming a catalog item rewrote history.

**Dropped as over-scoped:** IndexedDB with per-record transactions, cross-tab
lease coordination, a formal retention policy, a void/adjustment audit chain,
clock-drift warnings, encrypted backups. This is a gym counter — tens of sales a
day, one tab, Guided Access. One JSON blob in `localStorage` with a guarded
write, and the ceiling is noted in the spec.

---

## The split

| | **Hermes** | **Claude** |
|---|---|---|
| **Owns** | The entire build — 9 tasks | Deployment, real-iPad testing, the acceptance run |
| **Why** | Fully specified, verifiable task-by-task, no judgment calls left in it. Subagent-driven-development executes exactly this shape of work. | Needs the physical device, iOS camera behavior, hosting, and adversarial testing against glare and cracked phone screens. |
| **Not** | Hosting or iPad setup. | Writing the app — every line is Hermes's. |

Hermes can start now. Nothing blocks it.

**One thing to fill in:** the item list. `CATALOG` in the spec is a placeholder
with fake prices — replace it with the real fridge and shelf items whenever
convenient. Hermes builds against the placeholder; swapping it is a one-const edit.

---

## Phase 1 — Build · **Hermes** · ~6–8h

Full spec: [.hermes/plans/2026-09-11_gym-sales-tracker.md](.hermes/plans/2026-09-11_gym-sales-tracker.md).
Nine tasks, each carrying a "must fail if" clause tied to a review finding so
the spec can't be satisfied with a happy path.

| | Task | The point |
|---|---|---|
| 1 | Scaffold + vendor scanner | No CDN. Offline is load-bearing. |
| 2 | Guarded storage layer | A failed write must block the success screen. |
| 3 | Catalog grid | Stable IDs + SKUs, 88pt touch targets. |
| 4 | Scan state machine | Camera pauses on read; one member per purchase. |
| 5 | Enrollment + remap | "Not [Name]?" — typos and shared cards are expected. |
| 6 | One-shot sale + quantity | Buttons die synchronously on first tap. |
| 7 | **Export batches** | The double-billing fix. Most important task here. |
| 8 | PIN-gated admin | Kiosk screen never shows another member's name. |
| 9 | Kiosk hardening | Manifest, no zoom, camera-denied message. |

---

## Phase 2 — Deploy & prove · **Claude** · ~3h on the real iPad

Hermes verifies with `localStorage` asserts in a desktop browser. That passes
while the real kiosk fails on glare, focus, and iOS permission prompts.

- **Host:** private repo → Pages, HTTPS, stable origin. The origin can never
  change after data exists — `localStorage` is origin-scoped, and a hostname
  change orphans every enrollment and every unexported sale.
- **Install:** Add to Home Screen, Guided Access, auto-lock off, long cable,
  stand angle and lighting set at the actual counter.
- **Break it on purpose:**
  - cold start, WiFi off, after clearing ordinary cache
  - physical card *and* phone screen — dim, cracked, glared
  - double-scan · badge left in frame · bystander badge mid-purchase
  - double-tap a lagging item button
  - cancel the print dialog → batch must still be pending
  - reprint a batch → no double charge
  - storage quota full → success screen must not appear
  - device restart mid-shift · bad enrollment recovered via remap
- **One-page runbook** for the front desk: unstick it, pull the report, who to call.

Leave the paper sheet on the counter for the first week. It costs nothing and
it's the fallback if the iPad has a bad day.
