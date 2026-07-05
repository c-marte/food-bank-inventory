import type { InventoryLot, ISODate, WasteEvent } from './types';

// ---------------------------------------------------------------------------
// Waste — the third verb on a lot (after "send to partner" and "adjust").
//
// Physical sequence: the shelf-keeper pulls the food, tosses it, then records
// it here. Recording decrements the lot (clamped at zero, partial allowed —
// half the bananas can be fine) and emits a WasteEvent so spoilage is
// measurable. The lot row itself is never deleted (lot-not-item rule).
// ---------------------------------------------------------------------------

export interface WasteResult {
  /** New lots array with the decrement applied. */
  lots: InventoryLot[];
  /** How much actually came off the shelf: min(requested, on hand). */
  wasted: number;
  event: WasteEvent;
}

/**
 * Record `quantity` units of a lot as waste. Pure: returns new arrays, mutates
 * nothing. Returns null when there is nothing to do — unknown lot, a
 * non-positive quantity, or a lot already at zero.
 */
export function markWaste(
  lotId: string,
  quantity: number,
  lots: InventoryLot[],
  today: ISODate,
  eventId: string,
): WasteResult | null {
  if (!Number.isFinite(quantity) || quantity < 1) return null;

  const lot = lots.find((l) => l.id === lotId);
  if (!lot || lot.quantity <= 0) return null;

  const wasted = Math.min(Math.floor(quantity), lot.quantity);
  const nextLots = lots.map((l) =>
    l.id === lotId ? { ...l, quantity: l.quantity - wasted } : l,
  );

  return {
    lots: nextLots,
    wasted,
    event: {
      id: eventId,
      lotId,
      lotName: lot.name,
      unit: lot.unit,
      quantity: wasted,
      date: today,
    },
  };
}
