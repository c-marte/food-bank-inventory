import type {
  Category,
  Delivery,
  DeliveryItem,
  InventoryLot,
  ISODate,
} from './types';
import { addDays } from './dates';
import { inferTier } from './tier';

// ---------------------------------------------------------------------------
// Deliveries — food IN, the symmetric mirror of pickups (food OUT).
//
//   Pickup:   promise (requested) -> confirm  -> DECREMENTS referenced lots
//   Delivery: promise (expected)  -> receive  -> CREATES new lots
//
// The promise is captured when the donor calls ("~6 trays pasta, ~40
// sandwiches, arriving 3pm"). The app guesses expiry from category. The dock
// is the one human checkpoint: verify counts, verify the printed date, toss
// what's unusable, then confirm — which creates one NEW lot per line (rule 1:
// never merge, even identical names).
// ---------------------------------------------------------------------------

/** Rough shelf life by category — the app's guess at promise time. Always
 *  verified against the physical item at the dock; never trusted blindly. */
const SHELF_LIFE_DAYS: Record<Category, number> = {
  canned: 365,
  grains: 180,
  dairy: 7,
  produce: 4,
  protein: 60,
  other: 21,
};

export function categoryDefaultExpiry(
  category: Category,
  today: ISODate,
): ISODate {
  return addDays(today, SHELF_LIFE_DAYS[category]);
}

/** Build a fresh draft line for the promise / dock editors. */
export function makeDeliveryItem(
  today: ISODate,
  makeId: () => string,
  partial: Partial<DeliveryItem> = {},
): DeliveryItem {
  const category = partial.category ?? 'other';
  const name = partial.name ?? '';
  return {
    id: makeId(),
    name,
    category,
    tier: partial.tier ?? inferTier(name, category),
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'units',
    expiryDate: partial.expiryDate ?? categoryDefaultExpiry(category, today),
    ...partial,
  };
}

export interface ReceiveResult {
  /** New lots array with the received lots appended. */
  lots: InventoryLot[];
  /** The delivery, now status: 'received', holding the verified items. */
  delivery: Delivery;
  created: number;
  reminder: string;
}

/**
 * Receive a delivery at the dock. Takes the VERIFIED items from the dock editor
 * (which may differ from the promise — counts adjusted, dates fixed, rejects
 * removed). Creates one new lot per valid line. Idempotent-guarded: only an
 * 'expected' delivery can be received; returns null otherwise.
 */
export function receiveDelivery(
  deliveryId: string,
  items: DeliveryItem[],
  deliveries: Delivery[],
  lots: InventoryLot[],
  today: ISODate,
  makeId: () => string,
): ReceiveResult | null {
  const delivery = deliveries.find((d) => d.id === deliveryId);
  if (!delivery || delivery.status !== 'expected') return null;

  const kept = items.filter(
    (it) => it.quantity > 0 && it.name.trim() !== '' && it.expiryDate,
  );

  const newLots: InventoryLot[] = kept.map((it) => ({
    id: makeId(),
    name: it.name.trim(),
    category: it.category,
    tier: it.tier,
    quantity: it.quantity,
    unit: it.unit.trim() || 'units',
    receivedDate: today,
    expiryDate: it.expiryDate,
  }));

  const nextLots = [...lots, ...newLots];
  const nextDelivery: Delivery = {
    ...delivery,
    status: 'received',
    receivedDate: today,
    items: kept,
  };
  const created = newLots.length;
  const reminder =
    created === 0
      ? `${delivery.donorName} delivery closed — nothing usable to log.`
      : `Logged: ${created} lot${created === 1 ? '' : 's'} received from ${delivery.donorName}.`;

  return { lots: nextLots, delivery: nextDelivery, created, reminder };
}
