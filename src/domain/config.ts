import type { Config } from './types';

/** Default configuration. Thresholds are per-category (staples carry higher
 *  floors); the expiring-soon window is 7 days, inclusive at both ends. */
export const DEFAULT_CONFIG: Config = {
  expiringSoonWindowDays: 7,
  lowStockThresholdByCategory: {
    canned: 24,
    produce: 20,
    dairy: 12,
    grains: 18,
    protein: 15,
    other: 10,
  },
};
