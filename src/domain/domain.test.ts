import { describe, it, expect } from 'vitest';
import type {
  Config,
  Delivery,
  DeliveryItem,
  InventoryLot,
  OutboundMovement,
  Partner,
} from './types';
import { addDays } from './dates';
import { getNonExpiredQuantity, isLowStock } from './status';
import { getExpiringZoneLots, getLowStockZone } from './dashboard';
import {
  buildFefoBox,
  completeHandoff,
  getAvailability,
  getDyingLots,
  getMovementStage,
  validateRequestItems,
} from './distribution';
import { markWaste } from './waste';
import { categoryDefaultExpiry, getDeliveryStage, receiveDelivery } from './deliveries';
import { parseDonation } from './parseDonation';
import { inferTier } from './tier';
import { buildSeed } from '../data/seed';

describe('inferTier', () => {
  it('detects prepared food by name keyword, regardless of category', () => {
    expect(inferTier('Turkey Sandwiches', 'protein')).toBe('prepared');
    expect(inferTier('Baked Ziti', 'grains')).toBe('prepared');
    expect(inferTier('Garden Salad', 'produce')).toBe('prepared');
  });
  it('falls back to category tier for groceries', () => {
    expect(inferTier('Bananas', 'produce')).toBe('fresh');
    expect(inferTier('Whole Milk', 'dairy')).toBe('fresh');
    expect(inferTier('Black Beans', 'canned')).toBe('shelf_stable');
    expect(inferTier('White Rice', 'grains')).toBe('shelf_stable');
  });
});

const TODAY = '2026-07-04';

const CONFIG: Config = {
  expiringSoonWindowByTier: { prepared: 2, fresh: 7, shelf_stable: 21 },
  lowStockThresholdByCategory: {
    canned: 10,
    produce: 20,
    dairy: 12,
    grains: 18,
    protein: 15,
    other: 10,
  },
};

// Default tier 'fresh' (7-day window) so existing status expectations hold.
function lot(partial: Partial<InventoryLot> & { id: string }): InventoryLot {
  return {
    name: 'Item',
    category: 'canned',
    tier: 'fresh',
    quantity: 5,
    unit: 'cans',
    receivedDate: TODAY,
    expiryDate: addDays(TODAY, 30),
    ...partial,
  };
}

describe('low-stock (per category)', () => {
  it('excludes expired, includes ok + expiring_soon', () => {
    const lots = [
      lot({ id: 'a', category: 'produce', quantity: 8, expiryDate: addDays(TODAY, 30) }), // ok
      lot({ id: 'b', category: 'produce', quantity: 4, expiryDate: addDays(TODAY, 2) }), // expiring_soon
      lot({ id: 'c', category: 'produce', quantity: 99, expiryDate: addDays(TODAY, -1) }), // expired -> excluded
    ];
    expect(getNonExpiredQuantity(lots, 'produce', TODAY, CONFIG)).toBe(12);
    expect(isLowStock(lots, 'produce', TODAY, CONFIG)).toBe(true); // 12 < 20
  });

  it('is strictly-less-than: equal to threshold is NOT low', () => {
    const lots = [lot({ id: 'a', category: 'dairy', quantity: 12 })];
    expect(isLowStock(lots, 'dairy', TODAY, CONFIG)).toBe(false); // 12 == 12
  });

  it('an empty category sums to 0 and is low', () => {
    expect(getNonExpiredQuantity([], 'grains', TODAY, CONFIG)).toBe(0);
    expect(isLowStock([], 'grains', TODAY, CONFIG)).toBe(true);
  });

  it('a zero-quantity lot contributes 0', () => {
    const lots = [lot({ id: 'a', category: 'dairy', quantity: 0 })];
    expect(getNonExpiredQuantity(lots, 'dairy', TODAY, CONFIG)).toBe(0);
  });
});

describe('Zone A — expiring soon', () => {
  it('includes only expiring_soon lots with quantity > 0, soonest first', () => {
    const lots = [
      lot({ id: 'far', expiryDate: addDays(TODAY, 30) }), // ok -> excluded
      lot({ id: 'exp', expiryDate: addDays(TODAY, -1) }), // expired -> excluded
      lot({ id: 'zero', quantity: 0, expiryDate: addDays(TODAY, 2) }), // qty 0 -> excluded
      lot({ id: 'soon5', expiryDate: addDays(TODAY, 5) }),
      lot({ id: 'soon1', expiryDate: addDays(TODAY, 1) }),
    ];
    const zone = getExpiringZoneLots(lots, TODAY, CONFIG);
    expect(zone.map((l) => l.id)).toEqual(['soon1', 'soon5']);
  });

  it('is empty when nothing qualifies (zone renders its empty state)', () => {
    const lots = [lot({ id: 'far', expiryDate: addDays(TODAY, 30) })];
    expect(getExpiringZoneLots(lots, TODAY, CONFIG)).toEqual([]);
  });
});

describe('Zone B — low stock, most urgent (lowest fill ratio) first', () => {
  it('orders by current/threshold and excludes healthy categories', () => {
    const lots = [
      lot({ id: 'p', category: 'protein', quantity: 8 }), // 8/15 = 0.53
      lot({ id: 'd', category: 'dairy', quantity: 5 }), // 5/12 = 0.42
      lot({ id: 'c', category: 'canned', quantity: 50 }), // 50/10 -> healthy, excluded
      // grains, produce, other are all empty -> 0.0 (tie, sorted by category name)
    ];
    const zone = getLowStockZone(lots, TODAY, CONFIG);
    expect(zone.map((e) => e.category)).toEqual(['grains', 'other', 'produce', 'dairy', 'protein']);
    expect(zone.find((e) => e.category === 'dairy')).toMatchObject({ current: 5, threshold: 12 });
  });
});

describe('availability', () => {
  it('excludes expired and zero-quantity lots', () => {
    const lots = [
      lot({ id: 'ok', expiryDate: addDays(TODAY, 30) }),
      lot({ id: 'expired', expiryDate: addDays(TODAY, -1) }),
      lot({ id: 'zero', quantity: 0 }),
    ];
    const avail = getAvailability(lots, TODAY, CONFIG);
    expect(avail.map((l) => l.id)).toEqual(['ok']);
  });
});

describe('movement pipeline — derived stage + handoff commit (rule 2)', () => {
  const partners: Partner[] = [
    { id: 'partner-1', name: 'Northside', kind: 'meal_program' },
    { id: 'partner-3', name: 'Rosa M.', kind: 'family' },
  ];

  const movement = (p: Partial<OutboundMovement> & { id: string }): OutboundMovement => ({
    lines: [{ lotId: 'l1', quantity: 4 }],
    packed: true,
    recipientId: 'partner-1',
    mode: 'we_go',
    status: 'open',
    createdDate: TODAY,
    ...p,
  });

  it('stage is derived from what is missing, never stored', () => {
    expect(getMovementStage(movement({ id: 'm', packed: false }))).toBe('pack');
    expect(getMovementStage(movement({ id: 'm', packed: false, recipientId: undefined }))).toBe('pack');
    expect(getMovementStage(movement({ id: 'm', recipientId: undefined }))).toBe('match');
    expect(getMovementStage(movement({ id: 'm' }))).toBe('handoff');
    expect(getMovementStage(movement({ id: 'm', status: 'released' }))).toBe('released');
  });

  it('handoff decrements referenced lots and names the mode in the reminder', () => {
    const lots = [lot({ id: 'l1', name: 'Beans', quantity: 10 })];
    const res = completeHandoff('m1', [movement({ id: 'm1' })], lots, partners, TODAY)!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(6); // 10 - 4
    expect(res.movement.status).toBe('released');
    expect(res.movement.releasedDate).toBe(TODAY);
    expect(res.reminder).toBe('Released — 1 item delivered to Northside.');
  });

  it('they_come handoff reads as picked up', () => {
    const lots = [lot({ id: 'l1', quantity: 10 })];
    const res = completeHandoff(
      'm1',
      [movement({ id: 'm1', recipientId: 'partner-3', mode: 'they_come' })],
      lots, partners, TODAY,
    )!;
    expect(res.reminder).toBe('Released — 1 item picked up by Rosa M..');
  });

  it('clamps at zero and names the shortfall', () => {
    const lots = [lot({ id: 'l1', name: 'Bananas', quantity: 5 })];
    const res = completeHandoff(
      'm1',
      [movement({ id: 'm1', lines: [{ lotId: 'l1', quantity: 8 }] })],
      lots, partners, TODAY,
    )!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(0); // max(0, 5 - 8)
    expect(res.reminder).toBe('Released to Northside with shortages: Bananas (5 of 8).');
  });

  it('never ships expired food: releases 0, does not decrement', () => {
    const lots = [lot({ id: 'l1', name: 'Milk', quantity: 4, expiryDate: addDays(TODAY, -1) })];
    const res = completeHandoff(
      'm1',
      [movement({ id: 'm1', lines: [{ lotId: 'l1', quantity: 2 }] })],
      lots, partners, TODAY,
    )!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(4); // untouched
    expect(res.movement.lines[0].released).toBe(0);
  });

  it('is stage-guarded: unpacked, unmatched, or already-released → null', () => {
    const lots = [lot({ id: 'l1', quantity: 10 })];
    expect(completeHandoff('m1', [movement({ id: 'm1', packed: false })], lots, partners, TODAY)).toBeNull();
    expect(completeHandoff('m1', [movement({ id: 'm1', recipientId: undefined })], lots, partners, TODAY)).toBeNull();
    expect(completeHandoff('m1', [movement({ id: 'm1', status: 'released' })], lots, partners, TODAY)).toBeNull();
  });

  it('does not mutate the input arrays (immutable update)', () => {
    const lots = [lot({ id: 'l1', quantity: 10 })];
    const movements = [movement({ id: 'm1' })];
    completeHandoff('m1', movements, lots, partners, TODAY);
    expect(lots[0].quantity).toBe(10);
    expect(movements[0].status).toBe('open');
  });
});

describe('validateRequestItems', () => {
  const lots = [lot({ id: 'l1', name: 'Beans', quantity: 5, expiryDate: addDays(TODAY, 30) })];
  it('rejects duplicate lotIds', () => {
    expect(
      validateRequestItems([{ lotId: 'l1', quantity: 1 }, { lotId: 'l1', quantity: 1 }], lots, TODAY, CONFIG),
    ).toMatch(/twice/);
  });
  it('rejects over-request', () => {
    expect(validateRequestItems([{ lotId: 'l1', quantity: 6 }], lots, TODAY, CONFIG)).toMatch(/more/);
  });
  it('accepts a valid request', () => {
    expect(validateRequestItems([{ lotId: 'l1', quantity: 5 }], lots, TODAY, CONFIG)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The seed must populate BOTH zones on load, for any `today`, so async
// reviewers always see a live dashboard.
// ---------------------------------------------------------------------------
describe('seed data populates both zones (deterministic across dates)', () => {
  for (const today of ['2026-07-04', '2026-01-01', '2026-12-28', '2027-02-27']) {
    it(`both zones non-empty when today = ${today}`, () => {
      const seed = buildSeed(today);
      expect(getExpiringZoneLots(seed.lots, today, seed.config).length).toBeGreaterThan(0);
      expect(getLowStockZone(seed.lots, today, seed.config).length).toBeGreaterThan(0);
    });
  }

  it('includes a zero-quantity lot and a shared-name lot pair', () => {
    const seed = buildSeed(TODAY);
    expect(seed.lots.some((l) => l.quantity === 0)).toBe(true);
    const milk = seed.lots.filter((l) => l.name === 'Whole Milk');
    expect(milk.length).toBe(2);
    expect(milk[0].expiryDate).not.toBe(milk[1].expiryDate);
  });
});

// ---------------------------------------------------------------------------
// Waste — the third verb. Partial allowed, clamped, recorded as an event.
// ---------------------------------------------------------------------------
describe('markWaste', () => {
  it('partial waste decrements and records the event', () => {
    const lots = [lot({ id: 'l1', name: 'Bananas', unit: 'bunches', quantity: 8 })];
    const res = markWaste('l1', 3, lots, TODAY, 'w1')!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(5);
    expect(res.wasted).toBe(3);
    expect(res.event).toMatchObject({
      id: 'w1', lotId: 'l1', lotName: 'Bananas', unit: 'bunches', quantity: 3, date: TODAY,
    });
  });

  it('full waste zeroes the lot but keeps the row (never deleted)', () => {
    const lots = [lot({ id: 'l1', quantity: 4 })];
    const res = markWaste('l1', 4, lots, TODAY, 'w1')!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(0);
    expect(res.lots.length).toBe(1);
  });

  it('over-waste clamps at what is on hand', () => {
    const lots = [lot({ id: 'l1', quantity: 4 })];
    const res = markWaste('l1', 99, lots, TODAY, 'w1')!;
    expect(res.wasted).toBe(4);
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(0);
  });

  it('rejects zero/negative quantity, unknown lot, and empty lot', () => {
    const lots = [lot({ id: 'l1', quantity: 4 }), lot({ id: 'l0', quantity: 0 })];
    expect(markWaste('l1', 0, lots, TODAY, 'w1')).toBeNull();
    expect(markWaste('l1', -2, lots, TODAY, 'w1')).toBeNull();
    expect(markWaste('missing', 1, lots, TODAY, 'w1')).toBeNull();
    expect(markWaste('l0', 1, lots, TODAY, 'w1')).toBeNull();
  });

  it('does not mutate the input lots array', () => {
    const lots = [lot({ id: 'l1', quantity: 8 })];
    markWaste('l1', 3, lots, TODAY, 'w1');
    expect(lots[0].quantity).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Deliveries — food in. Receive creates NEW lots (mirror of confirm's decrement).
// ---------------------------------------------------------------------------
describe('receiveDelivery', () => {
  const makeDelivery = (items: DeliveryItem[]): Delivery => ({
    id: 'd1', donorName: "Sal's Catering", kind: 'catering',
    status: 'expected', expectedDate: TODAY, mode: 'we_go', items,
  });
  const item = (p: Partial<DeliveryItem> & { id: string }): DeliveryItem => ({
    name: 'Baked Ziti', category: 'grains', tier: 'prepared', quantity: 6, unit: 'trays',
    expiryDate: addDays(TODAY, 2), ...p,
  });
  let n = 0;
  const makeId = () => `new-${++n}`;

  it('creates one NEW lot per verified line and appends them', () => {
    n = 0;
    const items = [item({ id: 'i1' }), item({ id: 'i2', name: 'Sandwiches', category: 'protein', quantity: 24, unit: 'sandwiches' })];
    const existing = [lot({ id: 'l1', quantity: 5 })];
    const res = receiveDelivery('d1', items, [makeDelivery(items)], existing, TODAY, makeId)!;
    expect(res.created).toBe(2);
    expect(res.lots.length).toBe(3);
    expect(res.lots.find((l) => l.name === 'Baked Ziti')).toMatchObject({
      quantity: 6, unit: 'trays', category: 'grains', receivedDate: TODAY, expiryDate: addDays(TODAY, 2),
    });
    expect(res.delivery.status).toBe('received');
    expect(res.reminder).toBe("Logged: 2 lots received from Sal's Catering.");
  });

  it('never merges identical-name lines — two lines, two lots', () => {
    n = 0;
    const items = [item({ id: 'i1', name: 'Milk', category: 'dairy' }), item({ id: 'i2', name: 'Milk', category: 'dairy', expiryDate: addDays(TODAY, 9) })];
    const res = receiveDelivery('d1', items, [makeDelivery(items)], [], TODAY, makeId)!;
    expect(res.lots.filter((l) => l.name === 'Milk').length).toBe(2);
  });

  it('drops tossed/empty/nameless lines', () => {
    n = 0;
    const items = [item({ id: 'i1' }), item({ id: 'i2', quantity: 0 }), item({ id: 'i3', name: '  ' })];
    const res = receiveDelivery('d1', items, [makeDelivery(items)], [], TODAY, makeId)!;
    expect(res.created).toBe(1);
  });

  it('is idempotent-guarded: receiving a received delivery is a no-op (null)', () => {
    const items = [item({ id: 'i1' })];
    const d: Delivery = { ...makeDelivery(items), status: 'received' };
    expect(receiveDelivery('d1', items, [d], [], TODAY, makeId)).toBeNull();
  });

  it('does not mutate the input lots array', () => {
    n = 0;
    const items = [item({ id: 'i1' })];
    const existing = [lot({ id: 'l1', quantity: 5 })];
    receiveDelivery('d1', items, [makeDelivery(items)], existing, TODAY, makeId);
    expect(existing.length).toBe(1);
  });

  it('category default expiry is in the future and category-sensitive', () => {
    expect(categoryDefaultExpiry('produce', TODAY)).toBe(addDays(TODAY, 4));
    expect(categoryDefaultExpiry('canned', TODAY)).toBe(addDays(TODAY, 365));
  });
});

// ---------------------------------------------------------------------------
// parseDonation — the real NL parser behind the (simulated) capture layer.
// ---------------------------------------------------------------------------
describe('parseDonation', () => {
  it('parses a multi-item spoken sentence with units, names, and a date hint', () => {
    const items = parseDonation(
      '6 trays of baked ziti, 24 turkey sandwiches good till tomorrow, and 8 bowls of garden salad',
      TODAY,
    );
    expect(items).toEqual([
      { name: 'Baked Ziti', quantity: 6, unit: 'trays', category: 'grains', expiryDate: undefined },
      { name: 'Turkey Sandwiches', quantity: 24, unit: 'units', category: 'protein', expiryDate: addDays(TODAY, 1) },
      { name: 'Garden Salad', quantity: 8, unit: 'bowls', category: 'produce', expiryDate: undefined },
    ]);
  });

  it('handles number words and "a dozen"', () => {
    expect(parseDonation('a dozen eggs', TODAY)[0]).toMatchObject({ name: 'Eggs', quantity: 12, unit: 'units', category: 'protein' });
    expect(parseDonation('two gallons of milk', TODAY)[0]).toMatchObject({ name: 'Milk', quantity: 2, unit: 'gallons', category: 'dairy' });
  });

  it('keeps the item name when the word after the count is not a unit', () => {
    expect(parseDonation('10 cans black beans', TODAY)[0]).toMatchObject({ name: 'Black Beans', quantity: 10, unit: 'cans', category: 'canned' });
    expect(parseDonation('5 jars peanut butter', TODAY)[0]).toMatchObject({ name: 'Peanut Butter', category: 'protein' });
  });

  it('parses relative and N-day expiry hints', () => {
    expect(parseDonation('bread good for 3 days', TODAY)[0].expiryDate).toBe(addDays(TODAY, 3));
    expect(parseDonation('milk expires today', TODAY)[0].expiryDate).toBe(addDays(TODAY, 0));
  });

  it('defaults a missing count to 1 and returns [] for empty input', () => {
    expect(parseDonation('bananas', TODAY)[0]).toMatchObject({ name: 'Bananas', quantity: 1, category: 'produce' });
    expect(parseDonation('   ', TODAY)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Distribution — food out, decay-forward. Release decrements immediately.
// ---------------------------------------------------------------------------
describe('distribution — dying lots + FEFO box (the pipeline doors)', () => {
  it('getDyingLots: only expiring_soon with qty > 0, soonest first', () => {
    const lots = [
      lot({ id: 'ok', tier: 'fresh', expiryDate: addDays(TODAY, 30) }),
      lot({ id: 'exp', tier: 'fresh', expiryDate: addDays(TODAY, -1) }),
      lot({ id: 'zero', tier: 'fresh', quantity: 0, expiryDate: addDays(TODAY, 1) }),
      lot({ id: 'soon3', tier: 'fresh', expiryDate: addDays(TODAY, 3) }),
      lot({ id: 'soon1', tier: 'fresh', expiryDate: addDays(TODAY, 1) }),
    ];
    expect(getDyingLots(lots, TODAY, CONFIG).map((l) => l.id)).toEqual(['soon1', 'soon3']);
  });

  it('buildFefoBox: soonest-expiring groceries, one per category, no prepared/expired', () => {
    const lots = [
      lot({ id: 'prep', category: 'grains', tier: 'prepared', expiryDate: addDays(TODAY, 1) }),
      lot({ id: 'expd', category: 'dairy', tier: 'fresh', expiryDate: addDays(TODAY, -1) }),
      lot({ id: 'prod1', category: 'produce', tier: 'fresh', expiryDate: addDays(TODAY, 2) }),
      lot({ id: 'prod2', category: 'produce', tier: 'fresh', expiryDate: addDays(TODAY, 4) }),
      lot({ id: 'dairy', category: 'dairy', tier: 'fresh', expiryDate: addDays(TODAY, 3) }),
    ];
    const box = buildFefoBox(lots, TODAY, CONFIG);
    // prod1 (soonest produce) + dairy; prod2 skipped (produce taken), prep/expd excluded
    expect(box.map((i) => i.lotId)).toEqual(['prod1', 'dairy']);
    expect(box.every((i) => i.quantity === 1)).toBe(true);
  });
});

describe('seed movements populate every pipeline stage', () => {
  it('one movement at pack, one at match, one at handoff — all lines valid', () => {
    const seed = buildSeed(TODAY);
    const open = seed.movements.filter((m) => m.status === 'open');
    const stages = open.map(getMovementStage).sort();
    expect(stages).toEqual(['handoff', 'match', 'pack']);
    // every OPEN movement's lines reference a real, stocked lot (historical,
    // already-released movements intentionally reference synthetic lot ids —
    // they're aggregate-only impact history, never looked up against the
    // live shelf).
    for (const m of open) {
      for (const line of m.lines) {
        const l = seed.lots.find((x) => x.id === line.lotId);
        expect(l).toBeDefined();
        expect(l!.quantity).toBeGreaterThanOrEqual(line.quantity);
      }
    }
    // assignees and recipients resolve, across ALL movements (open + historical)
    for (const m of seed.movements) {
      if (m.assigneeId) expect(seed.team.some((t) => t.id === m.assigneeId)).toBe(true);
      if (m.recipientId) expect(seed.partners.some((p) => p.id === m.recipientId)).toBe(true);
    }
  });

  it('seeded deliveries carry a transport mode and a resolvable assignee', () => {
    const seed = buildSeed(TODAY);
    for (const d of seed.deliveries) {
      expect(['they_come', 'we_go']).toContain(d.mode);
      if (d.assigneeId) expect(seed.team.some((t) => t.id === d.assigneeId)).toBe(true);
    }
    // the catering surplus is a we-go trip (a volunteer drives out)
    expect(seed.deliveries.find((d) => d.donorName === "Sal's Catering")!.mode).toBe('we_go');
  });
});

describe('getDeliveryStage — derived, honest, three real states', () => {
  const TODAY = '2026-07-06';
  function delivery(expectedOffset: number, status: 'expected' | 'received'): Delivery {
    return {
      id: 'd1',
      donorName: 'Test Donor',
      kind: 'individual',
      status,
      expectedDate: addDays(TODAY, expectedOffset),
      mode: 'they_come',
      items: [],
    };
  }

  it('future expectedDate -> scheduled', () => {
    expect(getDeliveryStage(delivery(3, 'expected'), TODAY)).toBe('scheduled');
  });
  it('expectedDate is today, still expected -> en_route', () => {
    expect(getDeliveryStage(delivery(0, 'expected'), TODAY)).toBe('en_route');
  });
  it('expectedDate already passed, still expected -> en_route (overdue counts as en route)', () => {
    expect(getDeliveryStage(delivery(-2, 'expected'), TODAY)).toBe('en_route');
  });
  it('status received -> received, regardless of date', () => {
    expect(getDeliveryStage(delivery(5, 'received'), TODAY)).toBe('received');
    expect(getDeliveryStage(delivery(-5, 'received'), TODAY)).toBe('received');
  });
});
