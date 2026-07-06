import type {
  Config,
  InventoryLot,
  ISODate,
  Partner,
  PickupRequest,
  RequestItem,
} from './types';
import { getLotStatus } from './status';

// ---------------------------------------------------------------------------
// Partner availability + the confirm/decrement flow (rule 2: CONFIRM DECREMENTS).
//
// All functions are pure over (lots, requests, today, config). confirmRequest
// returns a NEW lots array with decrements applied — nothing is mutated in
// place — so React re-renders and derived views recompute automatically.
// ---------------------------------------------------------------------------

/** Lots a partner may request: non-expired AND quantity > 0. Expired food is
 *  never presented as available. Sorted soonest-expiry first (move it first). */
export function getPartnerAvailability(
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

/** Validate request items at creation time. Returns an error string, or null if
 *  valid. Duplicate lotIds are rejected so confirm-time math stays per-item. */
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

export interface Fulfillment {
  lotId: string;
  name: string;
  requested: number;
  fulfilled: number;
}

export interface ConfirmResult {
  /** New lots array with decrements applied (clamped at zero). */
  lots: InventoryLot[];
  /** The request, now status: 'confirmed'. */
  request: PickupRequest;
  /** Single "Reminder queued: ..." line. */
  reminder: string;
  fulfillments: Fulfillment[];
}

/**
 * Confirm a pickup request. Idempotent-guarded: only a 'requested' request can
 * be confirmed. Returns null for a missing or already-'confirmed' request.
 *
 * Per item:
 *   - lot now expired  -> fulfill 0, do NOT decrement (expired food never ships)
 *   - otherwise        -> fulfilled = min(requested, onHand); onHand -= fulfilled
 *                         (== max(0, onHand - requested); never negative)
 *
 * Partial fulfillment is a success, not an error; any shortfall is named in the
 * reminder line so staff can warn the partner before they drive over.
 */
export function confirmRequest(
  requestId: string,
  lots: InventoryLot[],
  requests: PickupRequest[],
  partners: Partner[],
  today: ISODate,
  config: Config,
): ConfirmResult | null {
  const request = requests.find((r) => r.id === requestId);
  if (!request || request.status !== 'requested') return null;

  // Compute per-lot decrements. Duplicate lotIds are rejected at creation, so a
  // simple per-item map from lotId to fulfilled amount is exact.
  const fulfilledByLot = new Map<string, number>();
  const fulfillments: Fulfillment[] = [];

  for (const item of request.items) {
    const lot = lots.find((l) => l.id === item.lotId);
    if (!lot) {
      fulfillments.push({
        lotId: item.lotId,
        name: 'Unknown lot',
        requested: item.quantity,
        fulfilled: 0,
      });
      continue;
    }
    const expired = getLotStatus(lot, today, config) === 'expired';
    const fulfilled = expired ? 0 : Math.min(item.quantity, lot.quantity);
    if (fulfilled > 0) fulfilledByLot.set(lot.id, fulfilled);
    fulfillments.push({
      lotId: lot.id,
      name: lot.name,
      requested: item.quantity,
      fulfilled,
    });
  }

  const nextLots = lots.map((l) => {
    const dec = fulfilledByLot.get(l.id);
    if (!dec) return l;
    return { ...l, quantity: Math.max(0, l.quantity - dec) };
  });

  const nextRequest: PickupRequest = { ...request, status: 'confirmed' };
  const partnerName =
    partners.find((p) => p.id === request.partnerId)?.name ?? 'partner';
  const reminder = buildReminder(partnerName, fulfillments);

  return { lots: nextLots, request: nextRequest, reminder, fulfillments };
}

function buildReminder(partnerName: string, fulfillments: Fulfillment[]): string {
  const shortfalls = fulfillments.filter((f) => f.fulfilled < f.requested);
  if (shortfalls.length === 0) {
    const n = fulfillments.length;
    return `Reminder queued: notify ${partnerName} — released (${n} ${
      n === 1 ? 'item' : 'items'
    }).`;
  }
  const detail = shortfalls
    .map((f) => `${f.name} (${f.fulfilled} of ${f.requested})`)
    .join(', ');
  return `Reminder queued: notify ${partnerName} — released with shortages: ${detail}.`;
}
