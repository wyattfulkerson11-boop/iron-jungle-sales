# Iron Jungle Sales Tracker

Offline-first kiosk for gym counter sales. One `index.html`, vanilla JS,
`localStorage`, and a vendored `html5-qrcode` scanner. No server, no build
step, no network dependency after install.

## Storage

All data lives in a single `localStorage` key, `ij.v1`, rewritten as one JSON
blob per sale. The shape is:

```js
{
  schema: 1,
  members: { "<badgeId>": { name: "Jane D.", enrolledAt: "<iso>" } },
  sales: [{
    id: "<uuid>",
    badgeId: "<string>",
    memberName: "<string>",   // snapshot at sale time
    productId: "<string>",
    productName: "<string>",  // snapshot — catalog renames never rewrite history
    sku: "<string>",          // snapshot
    price: 350,               // integer cents, snapshot
    qty: 2,
    at: "<iso utc>",
    entry: "scan" | "typed",  // how the member identified. Absent = recorded
                              // before typed entry existed = a scan
    voidedAt: "<iso>",        // absent = live. A void is stamped, never deleted,
    voidedBy: "member-undo" | "admin",  // and the first stamp is never rewritten
    batchId: null             // set when exported
  }],
  batches: [{
    id: "<uuid>",
    createdAt: "<iso>",
    saleIds: ["<uuid>"],      // immutable once created — a void never shrinks it
    status: "pending" | "processed",
    processedAt: "<iso>|null",
    reportV: 2                // absent = the legacy sheet layout
  }]
}
```

A batch's sheet is the v2 layout when `reportV === 2`, or when *any* of its
sales carries `entry` or `voidedAt` — so a page running the old code cannot hide
a TYPED or VOID line by batching it. A batch with neither renders the original
layout byte-for-byte, which is what makes an already-keyed batch reprint
identically. A void is only allowed while its batch is `pending`, and it is
excluded from the printed line count and total (the struck-through line stays on
the sheet, marked VOID).

On a JSON parse failure or a `schema` mismatch, the app never overwrites the
key — it renames it to `ij.v1.corrupt.<timestamp>`, starts fresh, and shows a
warning on the admin screen.

## Editing the catalog

The tappable grid is driven by the `CATALOG` array near the top of the script
in `index.html`. Replace the placeholder items with the real fridge and shelf
contents. Each entry is `{ id, name, sku, price }` with `price` in integer
cents ($3.50 = 350). `sku` may mirror `id` until real SKUs exist. The catalog
is validated at startup — duplicate `id`, duplicate `sku`, or an empty `name`
throws and blanks the screen in dev rather than mis-charging a member. A price
change is a one-line code edit plus a refresh; there is no product-management UI.

## Changing the admin PIN

`ADMIN_PIN` is a single named `var` in `index.html`, currently a four-digit
placeholder. Change it before the iPad goes on the counter, and **never write
the real one down in this repo** — it is public. The admin screen is reached by
a long-press (~800ms) on the idle title, then the PIN; three wrong attempts
trigger a 30s lockout.

## Changing the report column order

The worker keys each member's tab by hand, so the report groups sales by member
and sorts by name. The grouping and both renderings live in one place —
`buildBatchReport` (and `buildV2Report` for sheets carrying member numbers,
typed lines or voids) in `index.html` — so this is a one-function change.
Nothing printed or shared can differ from what the admin sees on screen: both
come out of `buildBatchReport`.

## Typed member numbers, voids and the loss window

- A member with no working card types their number on the idle screen. An
  unknown number enrolls; a known number must be typed with the name on file or
  the sale is refused. Typed lines print with **TYPED** and a **desk checked**
  box — the desk ticks it after checking the number against the POS, because a
  typed number is the one line a member could get wrong on purpose.
- A mistake is undone with **Undo** on the receipt (5 s) or **Void** in admin
  while the batch is still Pending. The line stays on the sheet struck through
  and marked **VOID**, and is excluded from the line count and the total, so the
  sheet and the POS ask for the same money. A confirmed batch can no longer be
  voided — correct it in the gym software instead.
- The admin footer shows **oldest waiting**, the age of the oldest sale nobody
  has keyed in yet. Past 6 hours it turns red: un-batched sales are the money at
  risk, and the fix is to pull a batch.

## Deployment constraint — the origin can never change

`localStorage` is origin-scoped: the data key is bound to the exact
scheme + hostname + port the page was served from. If the hostname changes
after the kiosk already holds data, the new origin gets an empty `ij.v1` and
every enrollment and every unexported sale is orphaned — silently lost, with
no error and no migration path. This is the single most expensive possible
deploy mistake. Pick the final origin (hostname) before the first real sale,
and never change it after data exists.
