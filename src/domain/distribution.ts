import type {
  Config,
  InventoryLot,
  ISODate,
  MovementLine,
  OutboundMovement,
  Partner,
  RequestItem,
} from './types';
import { daysUntil } from './dates';
import { getLotStatus } from './status';

// ---------------------------------------------------------------------------
// Distribution — food OUT as a pipeline of MOVEMENTS, not a log of instants.
//
//   ① PACK     box it / stage it cold            (owner: packer)
//   ② MATCH    find a taker — call the list      (owner: caller)
//   ③ HANDOFF  they pick up here, or we deliver  (owner: driver/receiver)
//
// Stage is DERIVED from what's missing, never stored. Pack/match reserve
// nothing; completing the handoff is the single commit point (rule 2):
// decrement the referenced lots, clamped at zero, expired ships 0, shortfall
// named in the reminder.
// ---------------------------------------------------------------------------

export type MovementStage = 'pack' | 'match' | 'handoff' | 'released';

/** The pipeline position, derived: the first thing still missing. */
export function getMovementStage(m: OutboundMovement): MovementStage {
  if (m.status === 'released') return 'released';
  if (!m.packed) return 'pack';
  if (!m.recipientId) return 'match';
  return 'handoff';
}

/** Lots available to promise out: non-expired AND quantity > 0. Expired food
 *  is never presented as available. Sorted soonest-expiry first. */
export function getAvailability(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
): InventoryLot[] {
  return lots
    .filter(
      (l) => l.quantity > 0 && getLotStatus(l, today, config) !== 'expired',
    )
    .sort(
      (a, b) =>
        a.expiryDate.localeCompare(b.expiryDate) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

/** Validate movement lines at creation time. Returns an error string, or null.
 *  Duplicate lotIds are rejected so handoff-time math stays per-line. */
export function validateRequestItems(
  items: RequestItem[],
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
): string | null {
  if (items.length === 0) return 'Select at least one lot to request.';

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.lotId)) return 'The same lot was selected twice.';
    seen.add(item.lotId);

    const lot = lots.find((l) => l.id === item.lotId);
    if (!lot) return 'A requested lot no longer exists.';
    if (getLotStatus(lot, today, config) === 'expired' || lot.quantity <= 0) {
      return `${lot.name} is no longer available.`;
    }
    if (item.quantity < 1) return 'Each quantity must be at least 1.';
    if (item.quantity > lot.quantity) {
      return `Requested more ${lot.name} than is available.`;
    }
  }
  return null;
}

/** Lots that must move now: on the shelf (qty > 0) and expiring_soon, soonest
 *  first. These are the push candidates — the decay door into the pipeline. */
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
 */
export function buildFefoBox(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
  maxLots = 5,
): RequestItem[] {
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

  const box: RequestItem[] = [];
  const usedCategories = new Set<string>();
  for (const lot of eligible) {
    if (box.length >= maxLots) break;
    if (usedCategories.has(lot.category)) continue;
    box.push({ lotId: lot.id, quantity: 1 });
    usedCategories.add(lot.category);
  }
  return box;
}

export interface HandoffResult {
  /** New lots array with decrements applied. */
  lots: InventoryLot[];
  /** The movement, now released, its lines carrying `released` amounts. */
  movement: OutboundMovement;
  reminder: string;
}

/**
 * Complete a handoff — the outbound commit point, mirror of the dock. Guarded:
 * only an open movement at the HANDOFF stage (packed + matched) can complete;
 * returns null otherwise. Per line: an expired lot ships 0 (never
 * decremented); otherwise released = min(quantity, onHand) and the lot
 * decrements by that (clamped, never negative). Partial fulfillment is the
 * resolution, not an error — the shortfall is named in the reminder.
 */
export function completeHandoff(
  movementId: string,
  movements: OutboundMovement[],
  lots: InventoryLot[],
  partners: Partner[],
  today: ISODate,
): HandoffResult | null {
  const movement = movements.find((m) => m.id === movementId);
  if (!movement || getMovementStage(movement) !== 'handoff') return null;

  const releasedByLot = new Map<string, number>();
  const lines: MovementLine[] = movement.lines.map((line) => {
    const lot = lots.find((l) => l.id === line.lotId);
    if (!lot) return { ...line, released: 0 };
    const expired = daysUntil(lot.expiryDate, today) < 0;
    const released = expired ? 0 : Math.min(line.quantity, lot.quantity);
    if (released > 0) releasedByLot.set(lot.id, released);
    return { ...line, released };
  });

  const nextLots = lots.map((l) => {
    const dec = releasedByLot.get(l.id);
    return dec ? { ...l, quantity: Math.max(0, l.quantity - dec) } : l;
  });

  const released: OutboundMovement = {
    ...movement,
    lines,
    status: 'released',
    releasedDate: today,
  };

  const recipient = partners.find((p) => p.id === movement.recipientId);
  return {
    lots: nextLots,
    movement: released,
    reminder: buildReminder(released, recipient, lots),
  };
}

function buildReminder(
  m: OutboundMovement,
  recipient: Partner | undefined,
  lotsBefore: InventoryLot[],
): string {
  const name = recipient?.name ?? 'recipient';
  const verb = m.mode === 'we_go' ? 'delivered to' : 'picked up by';
  const shipped = m.lines.filter((l) => (l.released ?? 0) > 0).length;
  const shortfalls = m.lines.filter((l) => (l.released ?? 0) < l.quantity);

  if (shortfalls.length === 0) {
    return `Released — ${shipped} ${shipped === 1 ? 'item' : 'items'} ${verb} ${name}.`;
  }
  const detail = shortfalls
    .map((l) => {
      const lotName = lotsBefore.find((x) => x.id === l.lotId)?.name ?? 'item';
      return `${lotName} (${l.released ?? 0} of ${l.quantity})`;
    })
    .join(', ');
  return `Released to ${name} with shortages: ${detail}.`;
}
