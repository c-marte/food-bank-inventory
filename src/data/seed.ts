import { addDays } from '../domain/dates';
import type {
  Config,
  Delivery,
  DeliveryKind,
  InventoryLot,
  ISODate,
  OutboundMovement,
  Partner,
  PerishTier,
  TeamMember,
  TransportMode,
  WasteEvent,
} from '../domain/types';
import { DEFAULT_CONFIG } from '../domain/config';
import { inferTier } from '../domain/tier';

// ---------------------------------------------------------------------------
// Seed data. Every expiry date is authored RELATIVE to `today` (today+3,
// today-2, ...), never as an absolute date, so both dashboard zones stay
// populated whenever a reviewer opens the app — days or weeks from now.
//
// The set deliberately spans every status and edge:
//   - ok / expiring_soon / expired lots
//   - a zero-quantity lot (kept, shown de-emphasized, excluded from zones)
//   - lots that SHARE A NAME but carry different expiry dates (lot model)
//   - low categories (produce, dairy, protein, other) so Zone B populates,
//     and healthy ones (canned, grains) so the zone reads as curated
// ---------------------------------------------------------------------------

interface SeedLot {
  name: string;
  category: InventoryLot['category'];
  quantity: number;
  unit: string;
  received: number; // offset in days from today (negative = past)
  expiry: number; // offset in days from today
  tier?: PerishTier; // override where inference would be wrong
}

// prettier-ignore
const SEED_LOTS: SeedLot[] = [
  // canned — healthy (sum well above threshold 24)
  { name: 'Black Beans',      category: 'canned',  quantity: 18, unit: 'cans',       received: -20, expiry: 120 }, // ok
  { name: 'Sweet Corn',       category: 'canned',  quantity: 12, unit: 'cans',       received: -10, expiry: 200 }, // ok  (shares name below)
  { name: 'Sweet Corn',       category: 'canned',  quantity: 4,  unit: 'cans',       received: -2,  expiry: 3   }, // expiring_soon (same name, different expiry)
  { name: 'Diced Tomatoes',   category: 'canned',  quantity: 6,  unit: 'cans',       received: -400,expiry: 5   }, // expiring_soon (canned can still age out)
  { name: 'Chunk Tuna',       category: 'canned',  quantity: 6,  unit: 'cans',       received: -12, expiry: 180 }, // ok

  // produce — LOW (non-expired 8+4 = 12 < 20; carrots expired, excluded)
  { name: 'Bananas',          category: 'produce', quantity: 8,  unit: 'bunches',    received: -2,  expiry: 2   }, // expiring_soon
  { name: 'Baby Spinach',     category: 'produce', quantity: 4,  unit: 'bags',       received: -1,  expiry: 0   }, // expiring_soon (today)
  { name: 'Carrots',          category: 'produce', quantity: 5,  unit: 'lbs',        received: -3,  expiry: -1  }, // expired (yesterday)

  // dairy — LOW (non-expired 3+2+0 = 5 < 12)
  { name: 'Whole Milk',       category: 'dairy',   quantity: 3,  unit: 'gallons',    received: -4,  expiry: 1   }, // expiring_soon
  { name: 'Whole Milk',       category: 'dairy',   quantity: 2,  unit: 'gallons',    received: -1,  expiry: 6   }, // expiring_soon (same name, different expiry)
  { name: 'Greek Yogurt',     category: 'dairy',   quantity: 0,  unit: 'cups',       received: -8,  expiry: 3   }, // zero-quantity (kept, de-emphasized)

  // grains — healthy (10+15 = 25 >= 18; oatmeal expired, excluded)
  { name: 'White Rice',       category: 'grains',  quantity: 10, unit: '5lb bags',   received: -30, expiry: 300 }, // ok
  { name: 'Spaghetti',        category: 'grains',  quantity: 15, unit: 'boxes',      received: -15, expiry: 400 }, // ok
  { name: 'Rolled Oats',      category: 'grains',  quantity: 4,  unit: 'canisters',  received: -60, expiry: -3  }, // expired

  // protein — LOW (5+3+6 = 14 < 15; prepared sandwiches included, non-expired)
  { name: 'Peanut Butter',    category: 'protein', quantity: 5,  unit: 'jars',       received: -25, expiry: 250, tier: 'shelf_stable' }, // ok (pantry staple, not fresh)
  { name: 'Chicken Thighs',   category: 'protein', quantity: 3,  unit: 'lbs',        received: -5,  expiry: 4   }, // fresh/frozen, expiring_soon

  // other — LOW (2+3 = 5 < 10)
  { name: 'Infant Formula',   category: 'other',   quantity: 2,  unit: 'containers', received: -6,  expiry: 9   }, // shelf_stable, within 21d window
  { name: 'Cooking Oil',      category: 'other',   quantity: 3,  unit: 'bottles',    received: -3,  expiry: 2   }, // expiring_soon

  // prepared — leftover catering already on the shelf (EAT NOW tier, 2-day window)
  { name: 'Deli Sandwiches',  category: 'protein', quantity: 6,  unit: 'sandwiches', received: -1,  expiry: 0   }, // prepared, expiring TODAY
  { name: 'Pasta Salad',      category: 'produce', quantity: 4,  unit: 'bowls',      received: 0,   expiry: 1   }, // prepared, expiring tomorrow
];

export const SEED_PARTNERS: Partner[] = [
  { id: 'partner-1', name: 'Northside Community Kitchen', kind: 'meal_program' },
  { id: 'partner-2', name: 'Hope Street Shelter', kind: 'meal_program' },
  // Family recipients: first name + initial only — client identity is guarded.
  { id: 'partner-3', name: 'Rosa M.', kind: 'family' },
  { id: 'partner-4', name: 'James T.', kind: 'family' },
];

/** The people who own trips — who drives, who receives, who packs, who calls.
 *  A name on a task is data, not auth: no accounts, no scheduling. */
export const SEED_TEAM: TeamMember[] = [
  { id: 'team-1', name: 'Maya Chen' },
  { id: 'team-2', name: 'Dan Ruiz' },
  { id: 'team-3', name: 'Jo Park' },
];

/** Known donors — offered as one-tap chips when logging an expected delivery,
 *  so the recurring sources (the bulk of the pounds) auto-fill. */
export const KNOWN_DONORS: { name: string; kind: DeliveryKind }[] = [
  { name: 'Stop & Shop', kind: 'recurring' },
  { name: "Sal's Catering", kind: 'catering' },
  { name: 'Riverside Bakery', kind: 'recurring' },
  { name: 'Lincoln Elementary Drive', kind: 'drive' },
];

interface SeedDeliveryItem {
  name: string;
  category: InventoryLot['category'];
  quantity: number;
  unit: string;
  expiry: number; // offset in days from today (the promise-time guess)
  tier?: PerishTier;
}
interface SeedDelivery {
  id: string;
  donorName: string;
  kind: DeliveryKind;
  when: number; // offset in days from today
  mode: TransportMode;
  assigneeId?: string;
  note?: string;
  items: SeedDeliveryItem[];
  courierName?: string;
  courierPhone?: string;
}

// prettier-ignore
const SEED_DELIVERIES: SeedDelivery[] = [
  {
    // Catering surplus is a WE-GO trip: Maya drives out to collect it.
    id: 'del-1', donorName: "Sal's Catering", kind: 'catering', when: 0,
    mode: 'we_go', assigneeId: 'team-1', note: 'pick up by 3pm — event leftovers',
    items: [
      { name: 'Baked Ziti',       category: 'grains',  quantity: 6,  unit: 'trays',      expiry: 2 },
      { name: 'Turkey Sandwiches',category: 'protein', quantity: 24, unit: 'sandwiches', expiry: 1 },
      { name: 'Garden Salad',     category: 'produce', quantity: 8,  unit: 'bowls',      expiry: 1 },
    ],
  },
  {
    // The grocery rescue drops off; Jo is on the dock to receive it. Their
    // driver Ray brings it — a courier, not one of ours.
    id: 'del-2', donorName: 'Stop & Shop', kind: 'recurring', when: 0,
    mode: 'they_come', assigneeId: 'team-3', note: 'usual morning drop',
    courierName: 'Ray', courierPhone: '+16175550142',
    items: [
      { name: 'Wheat Bread',      category: 'grains',  quantity: 12, unit: 'loaves',  expiry: 3, tier: 'fresh' },
      { name: 'Bananas',          category: 'produce', quantity: 15, unit: 'bunches', expiry: 4 },
      { name: 'Whole Milk',       category: 'dairy',   quantity: 6,  unit: 'gallons', expiry: 5 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Historical activity — for the Impact section only (30-day / YTD stats).
// These are ALREADY-RELEASED movements and ALREADY-RECEIVED deliveries dated
// in the past relative to `today`, so the gratitude numbers aren't zero on
// first load. They deliberately reference synthetic lot ids (never looked up
// anywhere — only counted in aggregate by domain/impact.ts) since the real
// current shelf state doesn't need to reconcile against bygone activity.
// ---------------------------------------------------------------------------

interface SeedHistoricalRelease {
  id: string;
  recipientId: string; // one of SEED_PARTNERS
  releasedDaysAgo: number;
  createdDaysAgo: number;
  units: number;
  note: string;
}

// prettier-ignore
const SEED_HISTORICAL_RELEASES: SeedHistoricalRelease[] = [
  // last 30 days — 3 to shelters, 3 to families
  { id: 'hist-rel-1', recipientId: 'partner-1', releasedDaysAgo: 2,  createdDaysAgo: 3,  units: 5, note: 'weekly order' },
  { id: 'hist-rel-2', recipientId: 'partner-3', releasedDaysAgo: 5,  createdDaysAgo: 5,  units: 3, note: 'family box' },
  { id: 'hist-rel-3', recipientId: 'partner-2', releasedDaysAgo: 9,  createdDaysAgo: 10, units: 8, note: 'weekly order' },
  { id: 'hist-rel-4', recipientId: 'partner-4', releasedDaysAgo: 14, createdDaysAgo: 14, units: 2, note: 'family box' },
  { id: 'hist-rel-5', recipientId: 'partner-1', releasedDaysAgo: 20, createdDaysAgo: 21, units: 6, note: 'weekly order' },
  { id: 'hist-rel-6', recipientId: 'partner-3', releasedDaysAgo: 27, createdDaysAgo: 27, units: 4, note: 'family box' },
  // 30-90 days ago (YTD only)
  { id: 'hist-rel-7', recipientId: 'partner-2', releasedDaysAgo: 45,  createdDaysAgo: 46,  units: 7,  note: 'weekly order' },
  { id: 'hist-rel-8', recipientId: 'partner-4', releasedDaysAgo: 80,  createdDaysAgo: 80,  units: 3,  note: 'family box' },
  { id: 'hist-rel-9', recipientId: 'partner-1', releasedDaysAgo: 130, createdDaysAgo: 131, units: 10, note: 'weekly order' },
  { id: 'hist-rel-10', recipientId: 'partner-3', releasedDaysAgo: 170, createdDaysAgo: 170, units: 2,  note: 'family box' },
];

interface SeedHistoricalDelivery {
  id: string;
  donorName: string;
  receivedDaysAgo: number;
}

// prettier-ignore
const SEED_HISTORICAL_DELIVERIES: SeedHistoricalDelivery[] = [
  { id: 'hist-del-1', donorName: "Trader Joe's",       receivedDaysAgo: 3 },
  { id: 'hist-del-2', donorName: 'Whole Foods Market',  receivedDaysAgo: 11 },
  { id: 'hist-del-3', donorName: "Sal's Catering",      receivedDaysAgo: 22 },
  { id: 'hist-del-4', donorName: 'Community Bake Sale', receivedDaysAgo: 60 },
  { id: 'hist-del-5', donorName: "Trader Joe's",        receivedDaysAgo: 150 }, // repeat donor — tests distinct-count dedup
];

interface SeedHistoricalWaste {
  id: string;
  lotName: string;
  quantity: number;
  daysAgo: number;
}

// prettier-ignore
const SEED_HISTORICAL_WASTE: SeedHistoricalWaste[] = [
  { id: 'hist-waste-1', lotName: 'Sliced Bread', quantity: 2, daysAgo: 6 },
  { id: 'hist-waste-2', lotName: 'Bagged Salad', quantity: 1, daysAgo: 19 },
  { id: 'hist-waste-3', lotName: 'Sliced Bread', quantity: 3, daysAgo: 50 },
];

export interface SeedData {
  lots: InventoryLot[];
  partners: Partner[];
  team: TeamMember[];
  movements: OutboundMovement[];
  deliveries: Delivery[];
  wasteEvents: WasteEvent[];
  config: Config;
}

/** Build a fresh seed relative to `today`. Called at app start and on reset. */
export function buildSeed(today: ISODate): SeedData {
  const lots: InventoryLot[] = SEED_LOTS.map((s, i) => ({
    id: `lot-${i + 1}`,
    name: s.name,
    category: s.category,
    tier: s.tier ?? inferTier(s.name, s.category),
    quantity: s.quantity,
    unit: s.unit,
    receivedDate: addDays(today, s.received),
    expiryDate: addDays(today, s.expiry),
  }));

  // Three movements in flight — one at each pipeline stage, so the board and
  // the tile stepper populate on first load:
  //   mov-1 PACK    — Hope Street's order (born matched from their call),
  //                   not yet boxed; Maya packs; we'll deliver.
  //   mov-2 MATCH   — a FEFO-ish grocery box, packed but no taker yet — the
  //                   "call the list" stage.
  //   mov-3 HANDOFF — today's deli sandwiches boxed for Northside; Dan drives
  //                   them over. Completing this decrements (rule 2).
  const movements: OutboundMovement[] = [
    {
      id: 'mov-1',
      lines: [
        { lotId: 'lot-6', quantity: 3 }, // Bananas
        { lotId: 'lot-9', quantity: 2 }, // Whole Milk (expiry +1)
      ],
      packed: false,
      recipientId: 'partner-2', // Hope Street Shelter
      mode: 'we_go',
      assigneeId: 'team-1', // Maya packs
      note: 'their weekly order',
      status: 'open',
      createdDate: today,
    },
    {
      id: 'mov-2',
      lines: [
        { lotId: 'lot-3', quantity: 2 }, // Sweet Corn (expiring)
        { lotId: 'lot-12', quantity: 1 }, // White Rice
        { lotId: 'lot-15', quantity: 1 }, // Peanut Butter
      ],
      packed: true,
      // no recipient — needs a taker: the outreach stage
      note: 'grocery box — call the family list',
      status: 'open',
      createdDate: today,
    },
    {
      id: 'mov-3',
      lines: [
        { lotId: 'lot-19', quantity: 6 }, // Deli Sandwiches — die TODAY
      ],
      packed: true,
      recipientId: 'partner-1', // Northside Community Kitchen
      mode: 'we_go',
      assigneeId: 'team-2', // Dan drives
      note: 'drop off by 5pm',
      status: 'open',
      createdDate: today,
    },
  ];

  // Two expected deliveries waiting at the dock: a catering surplus (short
  // fuse — becomes today/tomorrow lots on receive) and the recurring grocery
  // rescue. Receiving either CREATES lots and populates the clock.
  const deliveries: Delivery[] = SEED_DELIVERIES.map((d) => ({
    id: d.id,
    donorName: d.donorName,
    kind: d.kind,
    status: 'expected',
    expectedDate: addDays(today, d.when),
    mode: d.mode,
    assigneeId: d.assigneeId,
    note: d.note,
    courierName: d.courierName,
    courierPhone: d.courierPhone,
    items: d.items.map((it, j) => ({
      id: `${d.id}-item-${j + 1}`,
      name: it.name,
      category: it.category,
      tier: it.tier ?? inferTier(it.name, it.category),
      quantity: it.quantity,
      unit: it.unit,
      expiryDate: addDays(today, it.expiry),
    })),
  }));

  // Historical activity, for the Impact section's 30-day / YTD stats only —
  // already released / already received, so it never touches the live shelf.
  const historicalReleases: OutboundMovement[] = SEED_HISTORICAL_RELEASES.map(
    (h, i) => ({
      id: h.id,
      lines: [{ lotId: `hist-lot-${i + 1}`, quantity: h.units, released: h.units }],
      packed: true,
      recipientId: h.recipientId,
      mode: 'we_go',
      note: h.note,
      status: 'released',
      createdDate: addDays(today, -h.createdDaysAgo),
      releasedDate: addDays(today, -h.releasedDaysAgo),
    }),
  );

  const historicalDeliveries: Delivery[] = SEED_HISTORICAL_DELIVERIES.map(
    (h) => ({
      id: h.id,
      donorName: h.donorName,
      kind: 'individual',
      status: 'received',
      expectedDate: addDays(today, -h.receivedDaysAgo),
      receivedDate: addDays(today, -h.receivedDaysAgo),
      mode: 'they_come',
      items: [],
    }),
  );

  const wasteEvents: WasteEvent[] = SEED_HISTORICAL_WASTE.map((h) => ({
    id: h.id,
    lotId: `hist-lot-waste-${h.id}`,
    lotName: h.lotName,
    unit: 'units',
    quantity: h.quantity,
    date: addDays(today, -h.daysAgo),
  }));

  return {
    lots,
    partners: SEED_PARTNERS,
    team: SEED_TEAM,
    movements: [...movements, ...historicalReleases],
    deliveries: [...deliveries, ...historicalDeliveries],
    wasteEvents,
    config: DEFAULT_CONFIG,
  };
}
