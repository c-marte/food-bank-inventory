import { describe, it, expect } from 'vitest';
import type {
  Config,
  Delivery,
  DeliveryItem,
  InventoryLot,
  Partner,
  PickupRequest,
} from './types';
import { addDays } from './dates';
import { getNonExpiredQuantity, isLowStock } from './status';
import { getExpiringZoneLots, getLowStockZone } from './dashboard';
import {
  confirmRequest,
  getPartnerAvailability,
  validateRequestItems,
} from './requests';
import { markWaste } from './waste';
import { categoryDefaultExpiry, receiveDelivery } from './deliveries';
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

describe('partner availability', () => {
  it('excludes expired and zero-quantity lots', () => {
    const lots = [
      lot({ id: 'ok', expiryDate: addDays(TODAY, 30) }),
      lot({ id: 'expired', expiryDate: addDays(TODAY, -1) }),
      lot({ id: 'zero', quantity: 0 }),
    ];
    const avail = getPartnerAvailability(lots, TODAY, CONFIG);
    expect(avail.map((l) => l.id)).toEqual(['ok']);
  });
});

describe('confirmRequest — rule 2: confirm decrements', () => {
  const partners: Partner[] = [{ id: 'partner-1', name: 'Northside' }];

  it('decrements referenced lots and queues a clean reminder', () => {
    const lots = [lot({ id: 'l1', name: 'Beans', quantity: 10 })];
    const requests: PickupRequest[] = [
      { id: 'r1', partnerId: 'partner-1', status: 'requested', items: [{ lotId: 'l1', quantity: 4 }] },
    ];
    const res = confirmRequest('r1', lots, requests, partners, TODAY, CONFIG)!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(6); // 10 - 4
    expect(res.request.status).toBe('confirmed');
    expect(res.reminder).toBe('Reminder queued: notify Northside — pickup confirmed (1 item).');
  });

  it('clamps at zero and reports a shortfall in the reminder', () => {
    const lots = [lot({ id: 'l1', name: 'Bananas', quantity: 5 })];
    const requests: PickupRequest[] = [
      { id: 'r1', partnerId: 'partner-1', status: 'requested', items: [{ lotId: 'l1', quantity: 8 }] },
    ];
    const res = confirmRequest('r1', lots, requests, partners, TODAY, CONFIG)!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(0); // max(0, 5 - 8)
    expect(res.reminder).toBe(
      'Reminder queued: notify Northside — pickup confirmed with shortages: Bananas (5 of 8).',
    );
  });

  it('never ships expired food: fulfill 0, do not decrement', () => {
    const lots = [lot({ id: 'l1', name: 'Milk', quantity: 4, expiryDate: addDays(TODAY, -1) })];
    const requests: PickupRequest[] = [
      { id: 'r1', partnerId: 'partner-1', status: 'requested', items: [{ lotId: 'l1', quantity: 2 }] },
    ];
    const res = confirmRequest('r1', lots, requests, partners, TODAY, CONFIG)!;
    expect(res.lots.find((l) => l.id === 'l1')!.quantity).toBe(4); // untouched
    expect(res.fulfillments[0].fulfilled).toBe(0);
  });

  it('is idempotent-guarded: confirming a confirmed request is a no-op (null)', () => {
    const lots = [lot({ id: 'l1', quantity: 10 })];
    const requests: PickupRequest[] = [
      { id: 'r1', partnerId: 'partner-1', status: 'confirmed', items: [{ lotId: 'l1', quantity: 4 }] },
    ];
    expect(confirmRequest('r1', lots, requests, partners, TODAY, CONFIG)).toBeNull();
  });

  it('does not mutate the input lots array (immutable update)', () => {
    const lots = [lot({ id: 'l1', quantity: 10 })];
    const requests: PickupRequest[] = [
      { id: 'r1', partnerId: 'partner-1', status: 'requested', items: [{ lotId: 'l1', quantity: 4 }] },
    ];
    confirmRequest('r1', lots, requests, partners, TODAY, CONFIG);
    expect(lots[0].quantity).toBe(10); // original untouched
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
    status: 'expected', expectedDate: TODAY, items,
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
