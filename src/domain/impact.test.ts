import { describe, it, expect } from 'vitest';
import type {
  Delivery,
  InventoryLot,
  OutboundMovement,
  Partner,
  WasteEvent,
} from './types';
import { addDays, yearStartDate } from './dates';
import { getImpactStats } from './impact';

const TODAY = '2026-07-06';

const partners: Partner[] = [
  { id: 'p-kitchen', name: 'Northside Kitchen', kind: 'meal_program' },
  { id: 'p-family', name: 'Rosa M.', kind: 'family' },
];

function lot(receivedDaysAgo: number, id: string): InventoryLot {
  return {
    id,
    name: 'Item',
    category: 'canned',
    tier: 'shelf_stable',
    quantity: 5,
    unit: 'cans',
    receivedDate: addDays(TODAY, -receivedDaysAgo),
    expiryDate: addDays(TODAY, 300),
  };
}

function released(
  id: string,
  recipientId: string,
  releasedDaysAgo: number,
  units: number,
): OutboundMovement {
  return {
    id,
    lines: [{ lotId: `${id}-lot`, quantity: units, released: units }],
    packed: true,
    recipientId,
    status: 'released',
    createdDate: addDays(TODAY, -releasedDaysAgo - 1),
    releasedDate: addDays(TODAY, -releasedDaysAgo),
  };
}

function delivery(id: string, donorName: string, receivedDaysAgo: number): Delivery {
  return {
    id,
    donorName,
    kind: 'individual',
    status: 'received',
    expectedDate: addDays(TODAY, -receivedDaysAgo),
    receivedDate: addDays(TODAY, -receivedDaysAgo),
    mode: 'they_come',
    items: [],
  };
}

function waste(id: string, daysAgo: number, quantity: number): WasteEvent {
  return { id, lotId: 'x', lotName: 'Bread', unit: 'loaves', quantity, date: addDays(TODAY, -daysAgo) };
}

describe('getImpactStats', () => {
  const since30 = addDays(TODAY, -30);

  it('counts donations logged within the window only', () => {
    const lots = [lot(5, 'a'), lot(29, 'b'), lot(31, 'c')]; // c is outside 30d
    const stats = getImpactStats(lots, [], [], partners, [], TODAY, since30);
    expect(stats.donationsLogged).toBe(2);
  });

  it('splits released movements by recipient kind (shelters vs. families)', () => {
    const movements = [
      released('m1', 'p-kitchen', 2, 5),
      released('m2', 'p-family', 3, 3),
      released('m3', 'p-kitchen', 40, 9), // outside 30d
    ];
    const stats = getImpactStats([], [], movements, partners, [], TODAY, since30);
    expect(stats.sentToShelters).toBe(1);
    expect(stats.familyBoxesPacked).toBe(1);
  });

  it('only counts RELEASED movements, never open ones', () => {
    const open: OutboundMovement = {
      id: 'open-1',
      lines: [{ lotId: 'x', quantity: 4 }],
      packed: true,
      recipientId: 'p-kitchen',
      status: 'open',
      createdDate: TODAY,
    };
    const stats = getImpactStats([], [], [open], partners, [], TODAY, since30);
    expect(stats.sentToShelters).toBe(0);
  });

  it('counts DISTINCT donors, deduping repeat visits', () => {
    const deliveries = [
      delivery('d1', 'Trader Joe’s', 3),
      delivery('d2', 'Trader Joe’s', 10), // same donor again
      delivery('d3', 'Whole Foods', 5),
      delivery('d4', 'Old Donor', 45), // outside window
    ];
    const stats = getImpactStats([], deliveries, [], partners, [], TODAY, since30);
    expect(stats.donorsCount).toBe(2);
  });

  it('ignores deliveries still expected (not yet received)', () => {
    const stillExpected: Delivery = {
      id: 'exp-1',
      donorName: 'Somebody',
      kind: 'individual',
      status: 'expected',
      expectedDate: TODAY,
      mode: 'they_come',
      items: [],
    };
    const stats = getImpactStats([], [stillExpected], [], partners, [], TODAY, since30);
    expect(stats.donorsCount).toBe(0);
  });

  it('computes a diversion rate from real released vs. wasted units', () => {
    const movements = [released('m1', 'p-kitchen', 2, 27)]; // 27 released
    const wasteEvents = [waste('w1', 5, 3)]; // 3 wasted -> 27/(27+3) = 90%
    const stats = getImpactStats([], [], movements, partners, wasteEvents, TODAY, since30);
    expect(stats.diversionRatePct).toBe(90);
  });

  it('returns null diversion rate when there is no released-or-wasted activity', () => {
    const stats = getImpactStats([], [], [], partners, [], TODAY, since30);
    expect(stats.diversionRatePct).toBeNull();
  });

  it('YTD (since Jan 1) includes more than a rolling 30-day window', () => {
    const lots = [lot(10, 'a'), lot(100, 'b')]; // b is outside 30d, inside YTD (Jul 6 - 100d ~ Mar)
    const ytdSince = yearStartDate(TODAY);
    const statsYTD = getImpactStats(lots, [], [], partners, [], TODAY, ytdSince);
    const stats30 = getImpactStats(lots, [], [], partners, [], TODAY, since30);
    expect(statsYTD.donationsLogged).toBe(2);
    expect(stats30.donationsLogged).toBe(1);
  });

  it('yearStartDate returns January 1 of the given date’s year', () => {
    expect(yearStartDate('2026-07-06')).toBe('2026-01-01');
  });
});
