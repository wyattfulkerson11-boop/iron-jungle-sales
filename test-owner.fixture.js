/**
 * Fixed data for test-owner.js. Do not edit — test-owner.golden.json was
 * captured from these exact records against index.html at 264578d.
 */
const T0 = Date.parse('2026-09-15T15:00:00Z');
const iso = (mins) => new Date(T0 + mins * 60000).toISOString();

function sale(id, badgeId, memberName, productName, price, qty, mins, batchId) {
  return { id, badgeId, memberName, productId: productName.toLowerCase().replace(/\W+/g, '-'),
    productName, sku: productName.toLowerCase().replace(/\W+/g, '-'), price, qty,
    at: iso(mins), batchId };
}

/** Pre-change data: no `entry`, no `voidedAt`, no `reportV`. */
function legacyState() {
  return {
    schema: 1,
    members: {
      IJG18301: { name: 'Alice A.', enrolledAt: iso(-100) },
      IJG18302: { name: 'Bob B.', enrolledAt: iso(-90) },
      IJG18303: { name: 'Alice A.', enrolledAt: iso(-80) }
    },
    sales: [
      sale('L1', 'IJG18301', 'Alice A.', 'Bang', 275, 1, 0, 'legacy-processed'),
      sale('L2', 'IJG18302', 'Bob B.', 'Quest Bar', 275, 2, 5, 'legacy-processed'),
      sale('L3', 'IJG18303', 'Alice A.', 'Water', 150, 1, 9, 'legacy-processed'),
      sale('L4', 'IJG18302', 'Bob B.', 'Celsius Single Drink', 325, 1, 60, 'legacy-pending')
    ],
    batches: [
      { id: 'legacy-processed', createdAt: iso(30), saleIds: ['L1', 'L2', 'L3'],
        status: 'processed', processedAt: iso(40) },
      { id: 'legacy-pending', createdAt: iso(70), saleIds: ['L4'],
        status: 'pending', processedAt: null }
    ]
  };
}

/**
 * Post-change data, as later commits will write it. The rollback floor
 * (commit 1 of PLAN.md §E0) must read all of it correctly.
 */
function v2State() {
  const s = legacyState();
  s.members.IJG18304 = { name: 'Cara C.', enrolledAt: iso(100) };
  s.sales.push(
    Object.assign(sale('V1', 'IJG18304', 'Cara C.', 'Bang', 275, 1, 120, 'v2-pending'), { entry: 'typed' }),
    Object.assign(sale('V2', 'IJG18302', 'Bob B.', 'Quest Bar', 275, 1, 121, 'v2-pending'),
      { entry: 'scan', voidedAt: iso(122), voidedBy: 'member-undo' }),
    Object.assign(sale('V3', 'IJG18302', 'Bob B.', 'Water', 150, 3, 125, 'v2-pending'), { entry: 'scan' }),
    Object.assign(sale('V4', 'IJG18304', 'Cara C.', 'Water', 150, 1, 130, null), { entry: 'typed' }),
    Object.assign(sale('V5', 'IJG18301', 'Alice A.', 'Bang', 275, 1, 131, null),
      { entry: 'scan', voidedAt: iso(132), voidedBy: 'admin' })
  );
  s.batches.push({ id: 'v2-pending', createdAt: iso(126), saleIds: ['V1', 'V2', 'V3'],
    status: 'pending', processedAt: null, reportV: 2 });
  return s;
}

module.exports = { T0, iso, sale, legacyState, v2State };
