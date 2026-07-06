import type { Category, PerishTier } from './types';

// ---------------------------------------------------------------------------
// Perishability tier — inference. Tier is a handling/speed class, not a food
// type. It's inferred (best-guess) from the name + category at capture, then
// VERIFIED by the human at the dock, exactly like the expiry date.
// ---------------------------------------------------------------------------

/** Default tier for a grocery category. Prepared has no category home — it's
 *  detected by name below. */
const TIER_BY_CATEGORY: Record<Category, PerishTier> = {
  canned: 'shelf_stable',
  grains: 'shelf_stable',
  other: 'shelf_stable',
  produce: 'fresh',
  dairy: 'fresh',
  protein: 'fresh', // fresh/frozen; canned tuna lives under `canned`
};

/** Words that signal cooked / prepared / ready-to-eat food — the "eat now"
 *  tier that dies in a day. A best guess; the dock confirms it. */
const PREPARED_KEYWORDS = [
  'ziti', 'lasagna', 'casserole', 'sandwich', 'salad', 'soup', 'stew',
  'meal', 'cooked', 'hot ', 'tray', 'deli', 'catered', 'pizza', 'burrito',
  'entree', 'entrée', 'wrap', 'platter', 'leftover', 'prepared', 'baked ',
];

export function inferTier(name: string, category: Category): PerishTier {
  const n = name.toLowerCase();
  if (PREPARED_KEYWORDS.some((k) => n.includes(k))) return 'prepared';
  return TIER_BY_CATEGORY[category];
}
