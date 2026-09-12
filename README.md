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
    batchId: null             // set when exported
  }],
  batches: [{
    id: "<uuid>",
    createdAt: "<iso>",
    saleIds: ["<uuid>"],      // immutable once created
    status: "pending" | "processed",
    processedAt: "<iso>|null"
  }]
}
```

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

`ADMIN_PIN` is a single named const in `index.html`, currently the placeholder
`0000`. Change it before the iPad goes on the counter. The admin screen is
reached by a long-press (~800ms) on the idle title, then the PIN; three wrong
attempts trigger a 30s lockout.

## Changing the report column order

The worker keys each member's tab by hand, so the printed report groups sales
by member and sorts by name. If the real entry screen wants a different order,
edit the single `printBatch` function in `index.html` — the grouping logic
lives in one place so this is a one-function change.

## Deployment constraint — the origin can never change

`localStorage` is origin-scoped: the data key is bound to the exact
scheme + hostname + port the page was served from. If the hostname changes
after the kiosk already holds data, the new origin gets an empty `ij.v1` and
every enrollment and every unexported sale is orphaned — silently lost, with
no error and no migration path. This is the single most expensive possible
deploy mistake. Pick the final origin (hostname) before the first real sale,
and never change it after data exists.
