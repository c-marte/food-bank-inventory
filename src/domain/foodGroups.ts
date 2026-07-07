import type { Category, PerishTier } from './types';

/* ─────────────────────────────────────────────────────────
 * Three food groups, not six categories — collapsed by handling urgency:
 * Hot foods (the prepared tier — cooked/catered, move today) regardless of
 * category; Canned foods (the one category with real shelf-life certainty);
 * everything else (dairy, grains, protein, other, fresh produce) shares one
 * "Groceries or produce" catch-all. Shared by the Inventory page (grouping
 * lots) and Food In's pickup rows (summarizing a delivery's manifest) — one
 * classification, not two copies of the same three buckets.
 * ───────────────────────────────────────────────────────── */

export type FoodGroup = 'hot' | 'canned' | 'groceries';

export const FOOD_GROUPS: FoodGroup[] = ['hot', 'canned', 'groceries'];

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  hot: 'Hot foods',
  canned: 'Canned foods',
  groceries: 'Groceries or produce',
};

// One icon per group, reusing the same three glyphs PerishTier already
// uses everywhere else in the app (flame/snowflake/box) — flame for hot
// (mirrors the prepared tier it's built from), box for canned (mirrors the
// shelf-stable tier canned goods live in), snowflake for groceries or
// produce (mirrors the fresh/"keep cold" tier most of that catch-all is).
export const FOOD_GROUP_ICON: Record<FoodGroup, 'flame' | 'box' | 'snowflake'> = {
  hot: 'flame',
  canned: 'box',
  groceries: 'snowflake',
};

export function foodGroupFor(item: { tier: PerishTier; category: Category }): FoodGroup {
  if (item.tier === 'prepared') return 'hot';
  if (item.category === 'canned') return 'canned';
  return 'groceries';
}
