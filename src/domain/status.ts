import type { Category, Config, InventoryLot, ISODate, LotStatus } from './types';
import { daysUntil } from './dates';

// ---------------------------------------------------------------------------
// Per-lot status and per-category low-stock are SEPARATE concepts.
// They are never combined. Quantity affects low-stock; it never affects status.
// ---------------------------------------------------------------------------

/**
 * Per-lot status: a pure function of expiryDate vs. today, with a TIER-AWARE
 * window (a prepared tray is "soon" at 1-2 days; a can only within weeks).
 *
 *   daysUntil < 0             -> 'expired'        (expiry has passed)
 *   daysUntil in [0, window]  -> 'expiring_soon'  (inclusive; window per tier)
 *   daysUntil > window        -> 'ok'
 *
 * A zero-quantity lot still has a status — quantity is irrelevant here.
 */
export function getLotStatus(
  lot: InventoryLot,
  today: ISODate,
  config: Config,
): LotStatus {
  const d = daysUntil(lot.expiryDate, today);
  if (d < 0) return 'expired';
  if (d <= config.expiringSoonWindowByTier[lot.tier]) return 'expiring_soon';
  return 'ok';
}

/** Sum of a category's NON-EXPIRED quantity. Expired lots contribute nothing;
 *  zero-quantity lots contribute zero automatically. */
export function getNonExpiredQuantity(
  lots: InventoryLot[],
  category: Category,
  today: ISODate,
  config: Config,
): number {
  return lots
    .filter((l) => l.category === category)
    .filter((l) => getLotStatus(l, today, config) !== 'expired')
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** A category is low when its non-expired quantity is STRICTLY below threshold.
 *  Exactly equal to the threshold is not low. An empty category (sum 0) is low. */
export function isLowStock(
  lots: InventoryLot[],
  category: Category,
  today: ISODate,
  config: Config,
): boolean {
  return (
    getNonExpiredQuantity(lots, category, today, config) <
    config.lowStockThresholdByCategory[category]
  );
}
