# iPad Setup — Step by Step

**Live URL:** https://wyattfulkerson11-boop.github.io/iron-jungle-sales/

Do Part 1 at home on your laptop. Parts 2–4 are at the gym with the iPad.
Total: about 15 minutes at home, 20 at the counter.

---

## Part 1 — Before you leave (laptop, ~10 min)

### 1. Change the admin PIN ← do this first

The repo is public, so `0000` is readable by anyone. It only gates the admin
screen on the physical iPad, but change it anyway.

In `index.html`, find:

```js
const ADMIN_PIN = '0000';
```

Pick something you'll remember and that isn't a date. Then:

```bash
git add index.html && git commit -m "chore: set admin PIN" && git push
```

### 2. Put in the real items

Still in `index.html`, find `const CATALOG = [`. Replace the eight placeholders
with what's actually in the fridge and on the shelf. Prices are **integer cents** —
`$3.50` is `350`, not `3.50`.

```js
{ id: 'gatorade', name: 'Gatorade', sku: 'gatorade', price: 250 },
```

`id` and `sku` can be the same word. Keep each `id` unique — the app refuses to
start on a duplicate, which is deliberate: a duplicate would mis-charge someone.

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
| 3 | Tap a drink | "Thanks, [name]" then back to scan screen after 2s |
| 4 | Scan your card again | Greets you by name — no typing |
| 5 | Tap **Not [your name]?** | Name prompt comes back |
| 6 | Scan, then walk away without tapping | Tap **Cancel** — returns to scan screen |
| 7 | Pull the screen down hard | Nothing should refresh |
| 8 | Double-tap a product fast | **One** sale, not two |
| 9 | **Scan your barcode off your phone screen** | This is the one most likely to fail — see below |
| 10 | Force-close the app and reopen | Your test sales are still there |

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

**Leave the paper sheet on the counter all week.** It costs nothing and it's the
fallback if the iPad has a bad day. You're proving the iPad captures *more*, not
proving the paper is gone.

### How a worker pulls the sales

1. Long-press the title → PIN → admin screen
2. **Create New Batch** — snapshots everything not yet exported
3. **Print** — save it as a PDF or print it
4. Key those sales into the gym software as usual
5. **Only then** tap **Confirm Keyed**

**Step 5 matters.** The batch stays "Pending" until someone confirms it. That's
what stops a member being charged twice — if the print fails or the PDF is lost,
the batch is still pending and reprints identically. Never confirm before the
sales are actually entered.

Processed batches stay visible for 30 days, so you can reprint one if needed.

### If something goes wrong

| Symptom | Fix |
|---|---|
| Camera unavailable | Settings → Safari → Camera → Allow, then reopen |
| Screen frozen | Triple-click side button, exit Guided Access, reopen from home screen |
| Scanner won't read a card | Hold it **level and centered, filling the frame's width** — the reader looks at a wide strip across the middle, not the corners. Then try the physical card instead of the phone; check the lens isn't smudged |
| Camera unavailable + a message in brackets | That bracketed text is the real reason. Send it to me — it is not always a permission problem |
| "Could not save that sale" | Storage is full — pull a batch, confirm it, then clear old data |
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

## What to watch for during the week

The pitch is loss prevention, so the number that matters is the comparison:
what the iPad captured vs. what the paper sheet captured over the same days. Keep
the printed batches — that's your evidence at the end of the week.
