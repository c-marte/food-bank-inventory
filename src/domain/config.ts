import type { Config } from './types';

/** Default configuration. Thresholds are per-category (staples carry higher
 *  floors); the expiring-soon window is tier-aware — a prepared tray is "soon"
 *  within 2 days, fresh groceries within a week, shelf-stable within 3 weeks. */
export const DEFAULT_CONFIG: Config = {
  expiringSoonWindowByTier: {
    prepared: 2,
    fresh: 7,
    shelf_stable: 21,
  },
  lowStockThresholdByCategory: {
    canned: 24,
    produce: 20,
    dairy: 12,
    grains: 18,
    protein: 15,
    other: 10,
  },
};
