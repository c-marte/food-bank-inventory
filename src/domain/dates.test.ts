import { describe, it, expect } from 'vitest';
import { addDays, daysUntil, parseLocalDate, toISODate } from './dates';
import { getLotStatus } from './status';
import { DEFAULT_CONFIG } from './config';
import type { InventoryLot } from './types';

const TODAY = '2026-07-04';

// A lot expiring `offset` days from TODAY, used to check the status mapping.
function lotExpiringIn(offset: number): InventoryLot {
  return {
    id: 'x',
    name: 'Test',
    category: 'canned',
    quantity: 1,
    unit: 'cans',
    receivedDate: TODAY,
    expiryDate: addDays(TODAY, offset),
  };
}

// ---------------------------------------------------------------------------
// The boundary assertions from the spec. These pin the highest-risk bug in the
// build (calendar-date off-by-one) and must pass before any view is built.
// ---------------------------------------------------------------------------
describe('daysUntil — boundary assertions', () => {
  it('expires today -> 0', () => {
    expect(daysUntil('2026-07-04', TODAY)).toBe(0);
  });
  it('expires tomorrow -> 1', () => {
    expect(daysUntil('2026-07-05', TODAY)).toBe(1);
  });
  it('expired yesterday -> -1', () => {
    expect(daysUntil('2026-07-03', TODAY)).toBe(-1);
  });
  it('expires today + 7 -> 7 (window edge, inclusive)', () => {
    expect(daysUntil('2026-07-11', TODAY)).toBe(7);
  });
  it('expires today + 8 -> 8', () => {
    expect(daysUntil('2026-07-12', TODAY)).toBe(8);
  });
});

describe('getLotStatus — boundary assertions', () => {
  it('expires today -> expiring_soon', () => {
    expect(getLotStatus(lotExpiringIn(0), TODAY, DEFAULT_CONFIG)).toBe('expiring_soon');
  });
  it('expires tomorrow -> expiring_soon', () => {
    expect(getLotStatus(lotExpiringIn(1), TODAY, DEFAULT_CONFIG)).toBe('expiring_soon');
  });
  it('expired yesterday -> expired', () => {
    expect(getLotStatus(lotExpiringIn(-1), TODAY, DEFAULT_CONFIG)).toBe('expired');
  });
  it('expires today + 7 -> expiring_soon (inclusive endpoint)', () => {
    expect(getLotStatus(lotExpiringIn(7), TODAY, DEFAULT_CONFIG)).toBe('expiring_soon');
  });
  it('expires today + 8 -> ok', () => {
    expect(getLotStatus(lotExpiringIn(8), TODAY, DEFAULT_CONFIG)).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Guards against the specific failure modes: UTC parsing and DST transitions.
// ---------------------------------------------------------------------------
describe('daysUntil — parse + DST guards', () => {
  it('parses as a LOCAL date (getDate matches the string, no UTC shift)', () => {
    const d = parseLocalDate('2026-07-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July, zero-indexed
    expect(d.getDate()).toBe(4); // NOT 3 — the UTC-parse off-by-one
  });

  it('spans a full month without drift', () => {
    expect(daysUntil('2026-03-31', '2026-03-01')).toBe(30);
  });

  it('is symmetric', () => {
    expect(daysUntil('2026-07-03', '2026-07-04')).toBe(-1);
    expect(daysUntil('2026-07-04', '2026-07-03')).toBe(1);
  });

  it('stays whole across the US spring-forward DST boundary (Mar 8, 2026)', () => {
    // A 23-hour day sits between these dates; Math.round keeps it a whole 2.
    expect(daysUntil('2026-03-09', '2026-03-07')).toBe(2);
  });

  it('stays whole across the US fall-back DST boundary (Nov 1, 2026)', () => {
    // A 25-hour day sits between these dates.
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2);
  });
});

describe('addDays / toISODate round-trips', () => {
  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('crosses a month boundary backward', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('is a no-op for 0', () => {
    expect(addDays('2026-07-04', 0)).toBe('2026-07-04');
  });
  it('toISODate zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
