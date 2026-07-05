// Map a free-text food name to an emoji by keyword. First match wins; the
// list is ordered most-specific first. Used only for the decay timeline —
// identity at a glance, so a banana reads as 🍌 without reading the label.

const RULES: [string[], string][] = [
  [['banana'], '🍌'],
  [['corn'], '🌽'],
  [['tomato'], '🍅'],
  [['tuna', 'fish', 'salmon'], '🐟'],
  [['bean'], '🫘'],
  [['spinach', 'lettuce', 'kale', 'greens', 'salad'], '🥬'],
  [['carrot'], '🥕'],
  [['broccoli'], '🥦'],
  [['pepper'], '🫑'],
  [['onion'], '🧅'],
  [['potato'], '🥔'],
  [['apple'], '🍎'],
  [['orange'], '🍊'],
  [['grape'], '🍇'],
  [['berry', 'strawberr'], '🍓'],
  [['juice'], '🧃'],
  [['milk'], '🥛'],
  [['yogurt', 'yoghurt'], '🥛'],
  [['cheese'], '🧀'],
  [['egg'], '🥚'],
  [['butter', 'peanut', 'nut'], '🥜'],
  [['rice'], '🍚'],
  [['pasta', 'spaghetti', 'noodle', 'mac'], '🍝'],
  [['oat', 'cereal', 'granola'], '🥣'],
  [['bread', 'baguette', 'loaf', 'bun', 'roll'], '🍞'],
  [['flour', 'sugar', 'baking'], '🌾'],
  [['chicken', 'poultry', 'turkey'], '🍗'],
  [['beef', 'steak'], '🥩'],
  [['pork', 'ham', 'bacon'], '🥓'],
  [['formula', 'infant', 'baby'], '🍼'],
  [['oil'], '🫗'],
  [['water', 'bottle'], '💧'],
  [['soup', 'stock', 'broth'], '🥫'],
  [['tea', 'coffee'], '☕'],
  [['can', 'jar', 'tin'], '🥫'],
];

const FALLBACK = '🍽️';

export function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  for (const [keys, emoji] of RULES) {
    if (keys.some((k) => n.includes(k))) return emoji;
  }
  return FALLBACK;
}
