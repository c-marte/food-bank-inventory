import type {
  Config,
  DistributionLine,
  DistributionRecord,
  InventoryLot,
  ISODate,
  Partner,
} from './types';
import { daysUntil } from './dates';
import { getLotStatus } from './status';

// ---------------------------------------------------------------------------
// Distribution — food OUT, decay-forward. The shelf pushes what's dying to a
// meal program; the app builds FEFO family boxes; both RELEASE immediately
// (rule 2: decrement the referenced lots, clamped at zero) and log what left.
// Expired food never ships — released is 0 for an aged-out lot, no decrement.
// ---------------------------------------------------------------------------

export interface ReleaseItem {
  lotId: string;
  quantity: number;
}

/** Lots that must move now: on the shelf (qty > 0) and expiring_soon, soonest
 *  first. These are the push candidates. */
export function getDyingLots(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
): InventoryLot[] {
  return lots
    .filter(
      (l) => l.quantity > 0 && getLotStatus(l, today, config) === 'expiring_soon',
    )
    .sort(
      (a, b) =>
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * Build a FEFO (first-expire-first-out) family box: the soonest-expiring
 * groceries, one unit each, at most one per category for variety. Prepared
 * food is excluded — it routes to meal programs, not family grocery boxes.
 * The app deciding what leaves is the outflow mirror of "why select at all?".
 */
export function buildFefoBox(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
  maxLots = 5,
): ReleaseItem[] {
  const eligible = lots
    .filter(
      (l) =>
        l.quantity > 0 &&
        l.tier !== 'prepared' &&
        getLotStatus(l, today, config) !== 'expired',
    )
    .sort(
      (a, b) =>
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );

  const box: ReleaseItem[] = [];
  const usedCategories = new Set<string>();
  for (const lot of eligible) {
    if (box.length >= maxLots) break;
    if (usedCategories.has(lot.category)) continue;
    box.push({ lotId: lot.id, quantity: 1 });
    usedCategories.add(lot.category);
  }
  return box;
}

export interface ReleaseResult {
  /** New lots array with decrements applied. */
  lots: InventoryLot[];
  distribution: DistributionRecord;
  reminder: string;
}

/**
 * Release lots to a recipient — immediate, one step. Per item: an expired lot
 * ships 0 (never decremented); otherwise released = min(requested, onHand) and
 * the lot decrements by that (== max(0, onHand - requested)). Returns a new
 * lots array (immutable), a distribution record, and a reminder line.
 */
export function releaseLots(
  recipient: Partner,
  mode: DistributionRecord['mode'],
  items: ReleaseItem[],
  households: number,
  lots: InventoryLot[],
  today: ISODate,
  makeId: () => string,
): ReleaseResult {
  const releasedByLot = new Map<string, number>();
  const lines: DistributionLine[] = [];

  for (const item of items) {
    const lot = lots.find((l) => l.id === item.lotId);
    if (!lot) continue;
    // Expired food never ships (expiry vs. today, no tier window needed here).
    const expired = daysUntil(lot.expiryDate, today) < 0;
    const released = expired ? 0 : Math.min(item.quantity, lot.quantity);
    if (released > 0) releasedByLot.set(lot.id, released);
    lines.push({
      lotId: lot.id,
      name: lot.name,
      unit: lot.unit,
      requested: item.quantity,
      released,
    });
  }

  const nextLots = lots.map((l) => {
    const dec = releasedByLot.get(l.id);
    return dec ? { ...l, quantity: Math.max(0, l.quantity - dec) } : l;
  });

  const distribution: DistributionRecord = {
    id: makeId(),
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientKind: recipient.kind,
    mode,
    lines,
    households: recipient.kind === 'family' ? households : 0,
    date: today,
  };

  return { lots: nextLots, distribution, reminder: buildReminder(distribution) };
}

function buildReminder(d: DistributionRecord): string {
  const released = d.lines.filter((l) => l.released > 0);
  const n = released.length;
  const shortfalls = d.lines.filter((l) => l.released < l.requested);

  if (d.recipientKind === 'family') {
    return `Family box packed — ${n} ${n === 1 ? 'item' : 'items'} off the shelf.`;
  }

  if (shortfalls.length === 0) {
    return `Reminder queued: notify ${d.recipientName} — released (${n} ${
      n === 1 ? 'item' : 'items'
    }).`;
  }
  const detail = shortfalls
    .map((l) => `${l.name} (${l.released} of ${l.requested})`)
    .join(', ');
  return `Reminder queued: notify ${d.recipientName} — released with shortages: ${detail}.`;
}
