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

/** Where food goes OUT. Prepared/bulk routes to meal programs; groceries go to
 *  families as boxes. Enables tier-aware routing on the distribution surface.
 *  Family recipients are named first-name-plus-initial only — real pantries
 *  guard client identity. */
export type PartnerKind = 'meal_program' | 'family';

export interface Partner {
  id: string;
  name: string;
  kind: PartnerKind;
}

/** A volunteer or staff member who can own a trip — who drives, who receives,
 *  who packs, who calls. A name on a task is data, not auth: no accounts. */
export interface TeamMember {
  id: string;
  name: string;
}

/** Every food movement is a TRIP, and every trip has a transport direction:
 *  they_come — the counterparty comes to our dock (drop-off / pickup-at-bank)
 *  we_go     — one of ours drives out (we collect a donation / we deliver) */
export type TransportMode = 'they_come' | 'we_go';

export interface RequestItem {
  lotId: string;
  quantity: number;
}

/** One line of an outbound movement. Name/unit resolve from the lot (lots are
 *  never deleted). `released` is filled only at handoff — the commit point. */
export interface MovementLine {
  lotId: string;
  quantity: number;
  /** Set at handoff: min(quantity, onHand), 0 if the lot had expired. */
  released?: number;
}

/**
 * An outbound movement — food working its way OFF the shelf. The pipeline is
 * derived from what's still missing, never stored (house rule):
 *   not packed            -> PACK     box it / stage it cold
 *   packed, no recipient  -> MATCH    find a taker (call the list)
 *   packed + recipient    -> HANDOFF  they pick up here, or we deliver
 * Completing the handoff is the single commit point (rule 2): the referenced
 * lots decrement, clamped, shortfall named. Pack/match reserve NOTHING —
 * consistent with "requests reserve nothing; first-commit-wins."
 * Doors in: a partner request (born matched), a decay push (born unmatched),
 * a FEFO box (born packed).
 */
export interface OutboundMovement {
  id: string;
  lines: MovementLine[];
  packed: boolean;
  recipientId?: string;
  mode?: TransportMode;
  assigneeId?: string;
  note?: string;
  status: 'open' | 'released';
  createdDate: ISODate;
  releasedDate?: ISODate;
}

/** An incoming donation, captured as a PROMISE before it arrives (the phone
 *  call is the manifest) and turned into real lots only when verified at the
 *  dock. Mirror of the outbound movement: promise -> commit. Where a handoff
 *  DECREMENTS lots, receiving a delivery CREATES them. */
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
  /** Set when the dock actually receives it (rule 1's commit point) — distinct
   *  from expectedDate, the same way a movement's releasedDate is distinct
   *  from createdDate. Used for real donor/impact accounting. */
  receivedDate?: ISODate;
  /** they_come — the donor drops off at our dock; we_go — one of ours drives
   *  out to collect (catering surplus is almost always a we_go trip). */
  mode: TransportMode;
  /** Who owns this trip: the driver (we_go) or the dock receiver (they_come). */
  assigneeId?: string;
  note?: string;
  items: DeliveryItem[];
  /** they_come only: whoever the donor sent to physically hand it over — not
   *  one of ours. Gets a neutral avatar, never TeamAvatar (colored circles
   *  are reserved for our own team, see ui/primitives.tsx `TeamAvatar`). */
  courierName?: string;
  courierPhone?: string;
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
