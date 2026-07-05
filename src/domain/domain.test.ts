import { describe, it, expect } from 'vitest';
import type { Config, InventoryLot, Partner, PickupRequest } from './types';
import { addDays } from './dates';
import { getNonExpiredQuantity, isLowStock } from './status';
import { getExpiringZoneLots, getLowStockZone } from './dashboard';
import {
  confirmRequest,
  getPartnerAvailability,
  validateRequestItems,
} from './requests';
import { buildSeed } from '../data/seed';

const TODAY = '2026-07-04';

const CONFIG: Config = {
  expiringSoonWindowDays: 7,
  lowStockThresholdByCategory: {
    canned: 10,
    produce: 20,
    dairy: 12,
    grains: 18,
    protein: 15,
    other: 10,
  },
};

function lot(partial: Partial<InventoryLot> & { id: string }): InventoryLot {
  return {
    name: 'Item',
    category: 'canned',
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
