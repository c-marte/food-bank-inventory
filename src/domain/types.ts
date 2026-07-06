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

/**
 * Handling class — the axis the shelf-keeper's job actually turns on: how fast
 * must this move, and how is it stored. Distinct from `category` (a grocery-aisle
 * taxonomy): a chicken tray, frozen chicken, and canned tuna are all "protein"
 * but three different tiers. Drives the tier-aware expiring window.
 *   prepared     — cooked/catered; hours-to-a-day; move today (EAT NOW)
 *   fresh        — perishable groceries; days (KEEP COLD)
 *   shelf_stable — canned/dry; weeks-to-years (SHELF)
 */
export type PerishTier = 'prepared' | 'fresh' | 'shelf_stable';

export interface InventoryLot {
  id: string;
  name: string;
  category: Category;
  tier: PerishTier;
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

/** An incoming donation, captured as a PROMISE before it arrives (the phone
 *  call is the manifest) and turned into real lots only when verified at the
 *  dock. Mirror of PickupRequest: promise -> confirm. Where confirm DECREMENTS
 *  for a pickup, receiving a delivery CREATES new lots. */
export type DeliveryKind = 'recurring' | 'catering' | 'drive' | 'individual';

export interface DeliveryItem {
  id: string;
  name: string;
  category: Category;
  tier: PerishTier;
  quantity: number;
  unit: string;
  /** Best-guess at promise time (category default); VERIFIED at the dock
   *  against the date printed on the physical item. */
  expiryDate: ISODate;
}

export interface Delivery {
  id: string;
  donorName: string;
  kind: DeliveryKind;
  status: 'expected' | 'received';
  expectedDate: ISODate;
  note?: string;
  items: DeliveryItem[];
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
  /** Tier-aware inclusive endpoint: daysUntil in [0, window] is expiring_soon.
   *  A prepared tray is "soon" at 1-2 days; a can only within a few weeks. */
  expiringSoonWindowByTier: Record<PerishTier, number>;
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

export const TIERS: PerishTier[] = ['prepared', 'fresh', 'shelf_stable'];

export const TIER_LABELS: Record<PerishTier, string> = {
  prepared: 'Eat now',
  fresh: 'Keep cold',
  shelf_stable: 'Shelf-stable',
};
