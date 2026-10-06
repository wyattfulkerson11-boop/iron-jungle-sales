# FINISH — Iron Jungle kiosk

Converted 2026-10-06 from `PREDEPLOY-CHECKLIST.md` (IDs map to its items 1–34).
Run: `node ~/.claude/skills/finisher/check.mjs FINISH.md`
Format: one `- R<n> claim`, then exactly one of `proof:` (shell, exit 0 = pass), `manual:` (who
confirms), `after:` (date or launch+Nd). `where: path :: literal text` anchors go stale if the text
is gone. Everything before section H must be green before the iPad goes on the counter; H gates
permanent use. Dropped from the source: 35 (cosmetic icon, not a gate).

owner: Chris, Jen
url: https://wyattfulkerson11-boop.github.io/iron-jungle-sales/
banned: certified, certification

## A. Build and release

- R1 test-owner passes
  proof: node test-owner.js
- R2 The other six suites and verify-task4 pass
  proof: node test-browser.js && node test-task8.js && node test-fixes.js && node test-storage.js && node test-task9.js && node test-catalog.js && node verify-task4.js
- R3 An untested push can't reach the counter: a pre-push hook runs every suite
  proof: test -x .git/hooks/pre-push && grep -q test-owner .git/hooks/pre-push
- R4 The live site serves HEAD's app
  proof: curl -sfL https://wyattfulkerson11-boop.github.io/iron-jungle-sales/index.html | diff -q - index.html
- R5 The counter iPad runs the current BUILD
  where: index.html :: var BUILD =
  manual: Wyatt
- R6 main is pushed
  proof: [ -z "$(git log origin/main..main --oneline)" ]

## B. Defects from the 2026-10-06 review

- R7 Going idle (incl. the admin timeout) closes an open batch view
  where: test-browser.js :: going idle closes an open batch view
  where: index.html :: closeBatchView();
  proof: node test-browser.js
- R8 Confirm keyed asks before marking a batch processed
  where: test-browser.js :: Confirm keyed asks first, and a cancel changes nothing
  proof: node test-browser.js
- R9 The RUNBOOK clear-test-data steps confirm batches before Clear all data
  where: RUNBOOK.md :: ### Then clear your test data
  proof: sed -n '/### Then clear your test data/,/^---/p' RUNBOOK.md | grep -q "Confirm keyed"

## C. On the device

- R10 Walk-away, typed entry, Undo, void, report, clear guard, offline and rollback re-run on the current BUILD
  manual: Wyatt
- R11 Phone-screen barcodes and physical keytags scan to the same ID
  manual: Wyatt
- R12 AirPrint reaches the desk printer
  manual: Wyatt
- R13 Survives a full shift plus overnight: camera live, plugged in, Guided Access
  manual: Wyatt
- R14 Storage limit re-measured on the counter iPad after the current BUILD
  manual: Wyatt

## D. Data safety

- R15 A failed save never shows success
  where: index.html :: if (addSale(sale)) {
  proof: node test-fixes.js && node test-storage.js
- R16 Clear all data is refused while anything is waiting or pending
  where: index.html :: return { ok: false, reason: 'waiting' };
  proof: node test-owner.js
- R17 A Processed batch can't be voided
  where: test-owner.js :: 5f void is refused on a Processed batch
  proof: node test-owner.js
- R18 Owner signs off on the overnight loss window (midday to next opening lives only on the iPad)
  manual: Chris
- R19 Owner signs off on no backup of enrollments or unbatched sales
  manual: Chris
- R20 Owner agrees to the kiosk living on Wyatt's GitHub, or the origin moves before the first real sale
  where: RUNBOOK.md :: **Never change the URL after the kiosk holds real sales.**
  manual: Chris

## E. Security and abuse

- R21 Owner confirms the public admin PIN isn't used for anything else
  where: index.html :: var ADMIN_PIN =
  manual: Chris
- R22 Owner accepts the typed path's risk, given the desk lookup speed (Q3)
  manual: Chris
- R23 Public planning and owner-strategy docs are acceptable
  manual: Wyatt
- R24 ?selftest=1 on the live device is accepted (Guided Access hides the address bar)
  where: index.html :: [?&]selftest=1
  manual: Wyatt

## F. Catalog

- R25 Sampled prices match the POS
  where: index.html :: const CATALOG = [
  manual: Wyatt
- R26 The other ~119 items checked against the remaining POS photos
  manual: Wyatt

## G. Owner, staff and counter

- R27 The owner conversation has happened; Q2–Q5 answered
  where: OWNER-NOTES.md :: **Q2 — Do member numbers ever look different
  manual: Chris
- R28 Owner agrees to paper behind the counter and to the pass bar before day 1
  manual: Chris
- R29 Desk manual printed with "Who to ask" filled in
  where: manual.html :: <h2>12. Who to ask</h2>
  manual: Wyatt
- R30 Sign beside the iPad; paper sheet, exception log and clipboard behind the counter
  manual: Wyatt
- R31 The manager holds the admin PIN and the Guided Access code
  manual: Chris
- R32 Clean slate on the device: admin shows "Nothing waiting" and no batches
  manual: Wyatt

## H. After the trial

- R33 Days 3–5 meet the bar: ≤5 exceptions a day, no cause 3+ times in one day
  where: RUNBOOK.md :: **5 or fewer a day, averaged over days 3, 4 and 5
  after: launch+5d
- R34 The TYPED share has been measured and the owner has heard it (flag past ~25%)
  after: launch+7d
