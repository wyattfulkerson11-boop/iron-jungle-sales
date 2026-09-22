# iPad Setup — Step by Step

**Live URL:** https://wyattfulkerson11-boop.github.io/iron-jungle-sales/

Do Part 1 at home on your laptop. Parts 2–4 are at the gym with the iPad.
Total: about 15 minutes at home, 20 at the counter.

---

## Part 1 — Before you leave (laptop, ~10 min)

### 1. Change the admin PIN ← do this first

The real PIN has been set in `index.html` since 2026-09-11. The repo is public,
so it is readable by anyone: it only gates the admin screen on the physical
iPad, at a staffed counter. To change it:

In `index.html`, find:

```js
var ADMIN_PIN = '<the PIN>';   // exactly one place sets this
```

Replace the string, commit, push. Don't repeat the PIN in any doc.

```bash
git add index.html && git commit -m "chore: set admin PIN" && git push
```

**Don't write the real PIN down anywhere in this repo** — not in this runbook,
not in the README, not in a commit message. The repository is public, and the
PIN is the only thing between a member and the Clear-all-data button.

### 2. Put in the real items

Still in `index.html`, find `const CATALOG = [`. Edit the real items (transcribed from the POS) to match
what's actually in the fridge and on the shelf.

```js
{ group: 'hydration', id: 'gatorade', name: 'Gatorade', sku: 'gatorade', price: 150 },
```

Four rules, each of which bites if you get it wrong:

- **Prices are integer cents.** `$3.50` is `350`, never `3.50`.
- **`group` must be `energy`, `protein-drinks`, `hydration`, or `food`** — the ids in
  `const GROUPS` just above. A typo throws on startup rather than quietly
  filing the item under no tab, where nobody could sell it.
- **`id` and `sku` must each be unique** across the whole catalog. They can be
  the same word as each other. The app refuses to start on a duplicate, which
  is deliberate: a duplicate would mis-charge someone.
- **Keep each group's items together in the list.** Tile colours are assigned
  by position, and that's what stops two neighbours sharing a colour.

Groups become the tabs on the purchase screen, in the order listed in `GROUPS`,
and the first one opens by default — Drinks, because the fridge outsells
everything. A group with no items gets no tab, so you can fill in one category
at a time. The grid scrolls inside its tab; 25 drinks is fine.

Commit and push the same way. **Give Pages ~2 minutes to rebuild** before you
load it on the iPad.

### 3. Confirm it still runs

```bash
node test-browser.js && node test-task8.js && node test-fixes.js
```

All three should pass. If the catalog edit broke something, you'll see it here
instead of at the counter.

---

## Part 2 — iPad setup (~10 min)

### 4. Load it in Safari

Open **Safari** (not Chrome — Add to Home Screen only works properly in Safari)
and go to:

```
https://wyattfulkerson11-boop.github.io/iron-jungle-sales/
```

### 5. Allow the camera

It will ask once. **Allow.** If you tap "Don't Allow" by mistake, fix it at
Settings → Safari → Camera → Allow, then reload.

### 6. Add to Home Screen

Share button → **Add to Home Screen** → name it "Iron Jungle" → Add.

Close Safari and **launch it from the home screen icon from now on.** This hides
the address bar so nobody can navigate away or see the URL.

### 7. Turn off auto-lock

Settings → Display & Brightness → Auto-Lock → **Never**. Plug it in and leave it
plugged in — this is why you want the long cable.

### 8. Turn on Guided Access

Settings → Accessibility → Guided Access → **On**, and set a passcode you'll
remember. Then open the app from the home screen and **triple-click the side
button** → Start.

To get out later: triple-click again and enter that passcode.

---

## Part 3 — Smoke test before anyone uses it (~5 min)

Do all of these yourself, at the counter, with the stand where it will live.

| # | Do this | Should happen |
|---|---|---|
| 1 | Scan your own gym card | Name prompt appears (first time) |
| 2 | Type your name, Save | Item grid appears |
| 3 | Tap a drink | "Thanks, [name]" — the receipt stays up 5 s, then the scan screen comes back |
| 3b | Tap **Undo** on that receipt (before it closes) | The sale is gone, back to the scan screen. Check in admin later: it shows as a VOID line, not as money |
| 4 | Scan your card again | Greets you by name — no typing |
| 4b | Scan your card and **walk away without tapping** | After 45 s it returns to the scan screen by itself, camera running — the next person can't be charged for your tab |
| 5 | Tap **Not you?** | Asks "Whose card is this?" and names who it's saved as. Nothing is overwritten yet |
| 5b | On that screen tap **No, I'm [your name]** | Straight back to the greeting, name untouched |
| 5c | Tap **No card? Type your member number** | The camera pauses and a number field appears. Type your own number with a **wrong** name → it refuses and charges nothing. Type it with the right name → the item grid appears |
| 5d | From that grid tap **Not you?** | Back to the number field, not to a rename form — a typed number never renames anybody |
| 6 | Scan, then walk away without tapping | Tap **Cancel** — returns to scan screen |
| 7 | Pull the screen down hard | Nothing should refresh |
| 8 | Double-tap a product fast | **One** sale, not two |
| 9 | **Scan your barcode off your phone screen** | This is the one most likely to fail — see below |
| 10 | Force-close the app and reopen | Your test sales are still there |
| 11 | Pull a batch, then **View** it in admin | Member numbers, TYPED marks with a check box, and VOID lines if you undid anything. Print it only after you've eyeballed it |

**Aim along the width.** The reader decodes a wide strip across the middle of
the frame. Hold the keytag level and let it fill the frame side to side; the
corner brackets mark the frame, not the read zone.

**On #9:** phone-screen barcodes are the known weak point — glare, brightness,
and cracked screens all hurt. Try it at the angle the stand actually sits, with
the gym's real lighting. If it struggles, turn the phone's brightness up and tilt
away from the ceiling lights. If it *consistently* fails, that's worth knowing
before you pitch it — physical cards may be the only reliable path.

### Then clear your test data

Long-press the "Scan your gym barcode" title for about a second → enter your PIN
→ **Clear all data** → type `CLEAR`.

Start the real trial with an empty slate.

---

## Part 4 — Running the trial

**Before the first sale: print the sign and brief the staff.** Both are in
"What to watch for during the week" at the end of this document, along with the
bar the week is judged against. Do that part first — a trial nobody was asked to
take part in can't tell you anything.

**The paper sheet goes behind the counter, not on it.** It is the fallback, not
the default: a worker hands it over the moment the kiosk can't take a sale, and
writes down why. Nobody is ever turned away — but nobody is offered the pen
first, either. The week is measuring whether the iPad can carry the gym's sales,
and it can't measure that against a pen sitting in front of the member.

### How a worker pulls the sales

1. Long-press the title → PIN → admin screen
2. **Create New Batch** — snapshots everything not yet exported
3. **Print** — paper if a printer is set up, otherwise the print sheet's own
   share button makes a **PDF** you can AirDrop or mail. Use Print for any copy
   that leaves the iPad: the **Share** button sends plain text, which arrives as
   a .txt with the columns collapsed (tested 2026-09-22)
4. Key those sales into the gym software as usual
5. **Only then** tap **Confirm Keyed**

**Step 5 matters.** The batch stays "Pending" until someone confirms it. That's
what stops a member being charged twice — if the print fails or the PDF is lost,
the batch is still pending and reprints identically. Never confirm before the
sales are actually entered.

Processed batches stay visible for 30 days, so you can reprint one if needed.

### Pull twice a day, not once — opening and midday

Nothing is banked until the sheet is keyed into the gym software. Until then the
sales live in the iPad's own storage, and an iPad that dies, gets wiped, or is
factory-reset takes them with it. Two pulls a day keeps the worst case at half a
shift instead of a week.

The admin footer tells you when: **oldest waiting** is the age of the oldest sale
nobody has keyed in yet. It turns **red past six hours**. Red means stop and pull
a batch.

### The desk gate on TYPED lines

A member whose card won't scan types their member number on the idle screen. Those
lines print marked **TYPED** with an empty **desk checked** box beside them.

- Check the member number against the screen before keying the line in.
- **Tick the box by hand when it matches.** That tick is the whole point: it is
  the desk saying a human checked the one line on the sheet a member could have
  typed wrongly — on purpose or by accident.
- **The kiosk does not check that the number exists.** A number it has never
  seen is signed up on the spot under whatever name was typed, and prints like
  any other TYPED line. It only refuses a number it *already knows* when the
  name doesn't match. So a mistyped number looks completely normal on the
  sheet — your check against the gym software is the only thing that catches
  it. If it doesn't match, don't key it.

A voided line prints struck through with **VOID** and is already excluded from
the total — don't key it, and don't chase it. If a line was voided *after* you
keyed it in, correct it in the gym software.

### If something goes wrong

| Symptom | Fix |
|---|---|
| Camera unavailable | Settings → Safari → Camera → Allow, then reopen |
| Screen frozen | Triple-click side button, exit Guided Access, reopen from home screen |
| Scanner won't read a card | Hold it **level and centered, filling the frame's width** — the reader looks at a wide strip across the middle, not the corners. Then try the physical card instead of the phone; check the lens isn't smudged |
| Camera unavailable + a message in brackets | That bracketed text is the real reason. Send it to me — it is not always a permission problem |
| Scan preview frozen / nothing reads | It should recover by itself when the app comes back to the foreground. If it does not, close the app from the home screen and reopen |
| "Could not save that sale" | Storage is full — pull a batch, confirm it, then clear old data |
| **"Another copy of the kiosk is open"** | The app is open twice (a Safari tab *and* the home-screen icon, most likely). Close the other one and reload this one. Nothing is lost — the kiosk refuses to write rather than let two copies overwrite each other's sales |
| Someone's name is wrong | Scan their badge → **Not [name]?** → retype |

Sales are **not** lost by closing the app or restarting the iPad. They live on
the device until someone clears them.

---

## The one thing you must not do

**Never change the URL after the kiosk holds real sales.**

The data is stored per-origin — tied to that exact hostname. Move it to a
different domain and the new address opens to an empty app: every enrollment and
every uncollected sale silently gone, no error, no way to get them back.

If you ever do need to move it, pull and confirm a batch **first**, so nothing is
sitting uncollected.

---

## Rolling back

**Never deploy a build older than `8e8d159a13b89712bfff21d5f654ea9dfb3cb805`.**

That commit is the rollback floor. It is the oldest version that still *reads*
everything a newer build can write: member numbers, typed lines and voided lines
all show up correctly on its sheets. Anything older is archive only — it would
print a sheet with the TYPED and VOID marks missing, and the worker would key in
lines that were never meant to be keyed in, or miss the one line needing a check.

Rolling back is: `git revert` or `git checkout <hash>` for `index.html`, push,
wait ~2 min for Pages, then confirm **build** in the admin footer changed. A
force-reload proves nothing — see below.

## Killing the service worker (if a deploy won't land)

The app installs a service worker so it opens with no network. That also means a
force-reload is not evidence: the worker serves its cached copy from in front of
the network. Always check **build** in the admin footer first.

If the worker is wedged and the footer still shows the old build, deploy this as
`sw.js` in the repo root, wait ~2 min for Pages, open the kiosk once, then delete
the file and push that:

```js
// KILL SWITCH — deploy, open the kiosk once, then delete this file.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ij-shell-')) await caches.delete(key);
    }
    await self.registration.unregister();
  })());
});
```

Reopen the app from the home screen. Sales are not touched: the kill switch
deletes only the cached app shell, never `ij.v1` (checked in Chrome 2026-09-18).
Until the real `sw.js` is back, the kiosk just can't open without wifi.

---

## Storage — the iPad is not an archive

Measured on the counter iPad 2026-09-22: **10.4 MB**, about **54 days** at the
owner's ~200 sales a day. The admin footer shows how full it is; **Check limit**
re-measures it on any device.

You do not have to manage this day to day. When a batch is confirmed, batches
keyed in more than **30 days** ago are deleted along with their sales, so the
device settles at about a month of history (~55% full). Members are never
deleted by this — nobody has to enrol again.

- **Clear keyed-in history** (admin): drops every batch already keyed in, right
  now, when you need room. Pending batches, waiting sales and members all stay.
- **The printed sheet or PDF is the permanent record.** After 30 days a batch
  cannot be reprinted from the iPad. Keep the paper.
- If the storage figure turns red (75%), pull and confirm what's waiting, then
  clear keyed-in history.

---

## What to watch for during the week

The pitch is loss prevention, and the paper sheet is behind the counter, so the
number that matters is no longer a comparison — it's a count of **exceptions**:
every time the kiosk couldn't take a sale and paper had to come out, and what
caused it. A count with causes attached is worth more than a percentage, because
each line of it is either something to fix or something to accept.

Keep the printed batches. Those plus the exception log are the evidence at the
end of the week.

### The trial only works if members are actually asked

A silent iPad gets walked past. Two things prevent that, and both cost nothing:

**1. Print the sign.** Open `sign.html` on the laptop, Cmd+P, print at 100%.
Laminate it or stand it in a frame right beside the iPad, where someone at the
fridge can read it.

**2. Say the sentence.** Every worker on shift, to anyone who walks up with a
drink in their hand:

> "Scan your barcode on the iPad there — it's the same as writing your name."

That's the whole script. Don't explain the system and don't apologise for it. If
they're stuck, point at the sign. If they're stuck *and* the kiosk won't take the
sale, that's an exception — hand over the paper and log it.

### When to hand over the paper

Hand it over immediately, no argument, no troubleshooting at the counter, any
time the kiosk can't complete the sale:

- the camera won't start, or won't read the card and the number isn't known
- the screen is frozen, or says **"Another copy of the kiosk is open"**
- the iPad is dead, updating, or missing
- the member refuses, is in a hurry, or is annoyed — **hand it over, don't
  persuade.** A member is never the person who pays for this trial.

Then write one line in the log below. The line takes five seconds and is the
single most valuable thing produced all week.

### The exception log

One line per handover. Keep it on the clipboard with the paper.

| Day | Time | What happened | Kiosk or paper in the end |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |

"What happened" in plain words — "camera wouldn't focus", "said another copy was
open", "guy didn't want to" — is enough. Don't try to categorise it.

### Write the bar down *before* Monday

A trial with no threshold agreed in advance produces an argument, not a result.
So it's set here, before the first sale, and it does not move afterwards.

**The number:** exceptions per day — lines in the log above.

**The bar:** **5 or fewer a day, averaged over days 3, 4 and 5, with no single
cause appearing three or more times in one day.** Days 1 and 2 are thrown out on
purpose: they're the learning curve, and judging the week on them judges the
novelty rather than the system.

The second half of that bar matters as much as the first. Five scattered
one-offs is a system working with normal friction. Three of the same thing in
one day is a defect wearing a low number.

**Decided in advance, so it can't be argued afterwards:**

| Days 3–5 | What it means | What happens next |
|---|---|---|
| **≤5/day, no repeating cause** | It carries the gym's sales. | Keep it. The week's remaining questions are about the catalog and the counter, not about whether this works. |
| **≤5/day, but one cause repeats** | It works, and one specific thing is broken. | Fix that one thing. Don't re-run the whole week for it. |
| **6–15/day** | Real friction, not yet fatal. | Fix the top two causes in the log, re-run one week. Don't scrap it and don't ship it. |
| **Over 15/day, or any outage nobody noticed for hours** | Not ready for a counter. | Stop. Back to the owner with the log — it says exactly why, which is worth more than the verdict. |

### The other number: how many lines are TYPED

Now that the pen isn't on the counter, this finally means something. A member
whose card won't scan has to type their number, so the **TYPED** share is a real
measurement instead of the near-zero it would be with paper in front of them.

Count it off the printed batches at the end of the week: TYPED lines ÷ all lines.

This isn't part of the bar — it's the number that decides whether this is
net-positive *at the counter*, because every TYPED line is a member number a
worker has to look up in the gym software by hand. Past about a quarter of all
lines, the desk gate is carrying more weight than anyone planned for, and that's
worth saying to the owner plainly whatever the exception count says.

And watch the tone of it: a TYPED line that turns out to be a wrong number is the
failure this whole design is most exposed to, because it looks completely normal
on the sheet. If the desk check catches one, that's not a bad week — that's the
control doing its job, and it's worth writing down.
