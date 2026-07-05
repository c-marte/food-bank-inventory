import type { Category, ISODate } from './types';
import { addDays } from './dates';

// ---------------------------------------------------------------------------
// parseDonation — turn a spoken/typed sentence into structured draft lines.
//
// This is the REAL automation behind the "capture" layer: the speech-to-text
// and photo-OCR steps are simulated in the prototype, but this parser runs for
// real on whatever text they produce. It only ever creates a DRAFT — every line
// is verified by a human at the dock, so a wrong guess is caught, never shipped.
//
//   "6 trays of baked ziti, 24 turkey sandwiches good till tomorrow"
//     -> [{ Baked Ziti, 6, trays, grains },
//         { Turkey Sandwiches, 24, units, protein, expiry: +1 }]
// ---------------------------------------------------------------------------

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  /** Only set when the sentence carried a date hint ("good till tomorrow"). */
  expiryDate?: ISODate;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, couple: 2, few: 3, several: 4,
};

// Container words that act as a unit when they follow the count. Deliberately
// excludes item-ish nouns ("sandwiches", "bananas") so "24 turkey sandwiches"
// keeps its name and defaults the unit.
const UNITS = new Set([
  'trays', 'tray', 'boxes', 'box', 'cases', 'case', 'cans', 'can', 'bags',
  'bag', 'bunches', 'bunch', 'gallons', 'gallon', 'loaves', 'loaf', 'bowls',
  'bowl', 'jars', 'jar', 'bottles', 'bottle', 'lbs', 'lb', 'pounds', 'pound',
  'containers', 'container', 'cups', 'cup', 'packs', 'pack', 'cartons',
  'carton', 'flats', 'flat', 'dozen',
]);

const FILLER = new Set(['of', 'the', 'some', 'fresh', 'a', 'an']);

const CATEGORY_RULES: [string[], Category][] = [
  [['sandwich', 'chicken', 'turkey', 'beef', 'pork', 'ham', 'tuna', 'fish', 'salmon', 'egg', 'peanut', 'tofu', 'sausage', 'bacon', 'meat', 'poultry'], 'protein'],
  [['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'cream'], 'dairy'],
  [['ziti', 'pasta', 'spaghetti', 'noodle', 'rice', 'bread', 'loaf', 'baguette', 'bun', 'cereal', 'oat', 'flour', 'tortilla', 'cracker', 'grain'], 'grains'],
  [['banana', 'apple', 'orange', 'salad', 'lettuce', 'spinach', 'carrot', 'tomato', 'fruit', 'potato', 'onion', 'pepper', 'broccoli', 'grape', 'berry', 'melon', 'pear', 'cucumber', 'celery', 'produce', 'veg'], 'produce'],
  [['bean', 'soup', 'sauce', 'canned', 'jar', 'tin'], 'canned'],
];

export function guessCategory(name: string): Category {
  const n = name.toLowerCase();
  for (const [keys, category] of CATEGORY_RULES) {
    if (keys.some((k) => n.includes(k))) return category;
  }
  return 'other';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Split off any trailing date phrase and return its day offset. */
function extractExpiry(clause: string): { offset: number | null; head: string } {
  const trigger = clause.search(
    /\b(good|best|use|sell|expires?|expiry|dated|by|till|until|through|for|today|tomorrow|next week|in \d+)\b/i,
  );
  if (trigger === -1) return { offset: null, head: clause };
  const head = clause.slice(0, trigger);
  const tail = clause.slice(trigger).toLowerCase();

  let offset: number | null = null;
  if (/\btoday\b/.test(tail)) offset = 0;
  else if (/\btomorrow\b/.test(tail)) offset = 1;
  else if (/\bnext week\b/.test(tail)) offset = 7;
  else {
    const m = /(\d+)\s*days?/.exec(tail);
    if (m) offset = parseInt(m[1], 10);
  }
  return { offset, head };
}

function parseClause(clause: string, today: ISODate): ParsedItem | null {
  const { offset, head } = extractExpiry(clause);
  const tokens = head.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let i = 0;
  let quantity = 1;
  const first = tokens[i];
  const num = /^\d+$/.test(first) ? parseInt(first, 10) : NUMBER_WORDS[first];
  if (num != null) {
    quantity = num;
    i++;
    if (tokens[i] === 'dozen') {
      quantity = num === 1 ? 12 : num * 12;
      i++;
    }
  }

  let unit = 'units';
  if (tokens[i] && UNITS.has(tokens[i])) {
    unit = tokens[i];
    i++;
  }

  const nameTokens = tokens.slice(i).filter((t) => !FILLER.has(t));
  const name = nameTokens.join(' ').trim();
  if (!name) return null;

  return {
    name: titleCase(name),
    quantity: Math.max(1, Math.round(quantity)),
    unit,
    category: guessCategory(name),
    expiryDate: offset == null ? undefined : addDays(today, offset),
  };
}

export function parseDonation(text: string, today: ISODate): ParsedItem[] {
  return text
    .split(/,|;|\n|\band\b/i)
    .map((clause) => parseClause(clause, today))
    .filter((x): x is ParsedItem => x !== null);
}
