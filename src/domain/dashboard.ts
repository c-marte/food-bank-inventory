import type { Category, Config, InventoryLot, ISODate } from './types';
import { CATEGORIES } from './types';
import { getLotStatus, getNonExpiredQuantity } from './status';

// ---------------------------------------------------------------------------
// The two decay-forward dashboard zones. They use different groupings (lots vs.
// categories) and MUST NOT reference each other. A lot can appear in Zone A
// while its category appears in Zone B — that is two true, independently
// actionable facts, not a duplicate. No dedup, no cross-linking, no suppression.
// ---------------------------------------------------------------------------

/**
 * Zone A — Expiring soon (lots).
 * Lots with status 'expiring_soon' AND quantity > 0, soonest expiry first.
 * Expired lots never appear here. Zero-quantity lots never appear here.
 */
export function getExpiringZoneLots(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
): InventoryLot[] {
  return lots
    .filter(
      (l) =>
        l.quantity > 0 && getLotStatus(l, today, config) === 'expiring_soon',
    )
    .sort(
      (a, b) =>
        a.expiryDate.localeCompare(b.expiryDate) || // soonest first (lexical == chronological)
        a.name.localeCompare(b.name) || // tie-break: name
        a.id.localeCompare(b.id), // final stable tie-break
    );
}

export interface LowStockEntry {
  category: Category;
  current: number;
  threshold: number;
}

/**
 * Zone B — Low stock (categories).
 * Categories whose non-expired quantity is strictly below threshold, most
 * urgent first. Urgency = lowest fill ratio (current / threshold), so 0/20
 * outranks 9/10.
 */
export function getLowStockZone(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
): LowStockEntry[] {
  return CATEGORIES.map((category) => ({
    category,
    current: getNonExpiredQuantity(lots, category, today, config),
    threshold: config.lowStockThresholdByCategory[category],
  }))
    .filter((e) => e.current < e.threshold)
    .sort(
      (a, b) =>
        a.current / a.threshold - b.current / b.threshold ||
        a.category.localeCompare(b.category),
    );
}
