// ---------------------------------------------------------------------------
// Core domain types.
//
// Two one-way-door invariants live in the code that uses these types, and are
// worth stating where the types are defined:
//
//   1. LOT, NOT ITEM. Every intake event creates a NEW InventoryLot. Lots are
//      never merged by name, because two donations of the same food can carry
//      different expiry dates. Grouping by name is a display concern only.
//
//   2. CONFIRM DECREMENTS. Confirming a pickup reduces the referenced lots'
//      quantity (clamped at zero). A confirm that does not decrement shows
//      phantom stock — the exact failure this product exists to prevent.
// ---------------------------------------------------------------------------

/** A local calendar date, 'YYYY-MM-DD'. No time component, ever. */
export type ISODate = string;

export type Category =
  | 'canned'
  | 'produce'
  | 'dairy'
  | 'grains'
  | 'protein'
  | 'other';

/** Derived from expiryDate vs. today ONLY. Quantity never affects status.
 *  Computed at render, never stored. */
export type LotStatus = 'ok' | 'expiring_soon' | 'expired';

export interface InventoryLot {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  receivedDate: ISODate;
  expiryDate: ISODate;
}

export interface Partner {
  id: string;
  name: string;
}

export interface RequestItem {
  lotId: string;
  quantity: number;
}

export interface PickupRequest {
  id: string;
  partnerId: string;
  items: RequestItem[];
  status: 'requested' | 'confirmed';
}

/** A recorded discard: food physically pulled from the shelf and tossed.
 *  First-class, not a silent quantity edit — spoilage is the product's #1
 *  success metric, and you can't measure what you don't record. */
export interface WasteEvent {
  id: string;
  lotId: string;
  /** Snapshot for display — the lot's name/unit at the time of the event. */
  lotName: string;
  unit: string;
  quantity: number;
  date: ISODate;
}

export interface Config {
  /** Per-category low-stock threshold. Sum of non-expired quantity strictly
   *  below this flags the category as low. */
  lowStockThresholdByCategory: Record<Category, number>;
  /** Inclusive endpoint. daysUntil in [0, window] is expiring_soon. */
  expiringSoonWindowDays: number;
}

export const CATEGORIES: Category[] = [
  'canned',
  'produce',
  'dairy',
  'grains',
  'protein',
  'other',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  canned: 'Canned',
  produce: 'Produce',
  dairy: 'Dairy',
  grains: 'Grains',
  protein: 'Protein',
  other: 'Other',
};
