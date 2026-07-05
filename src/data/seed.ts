import { addDays } from '../domain/dates';
import type {
  Config,
  Delivery,
  DeliveryKind,
  InventoryLot,
  ISODate,
  Partner,
  PickupRequest,
} from '../domain/types';
import { DEFAULT_CONFIG } from '../domain/config';

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

  // protein — LOW (5+3 = 8 < 15)
  { name: 'Peanut Butter',    category: 'protein', quantity: 5,  unit: 'jars',       received: -25, expiry: 250 }, // ok
  { name: 'Chicken Thighs',   category: 'protein', quantity: 3,  unit: 'lbs',        received: -5,  expiry: 4   }, // expiring_soon (frozen)

  // other — LOW (2+3 = 5 < 10)
  { name: 'Infant Formula',   category: 'other',   quantity: 2,  unit: 'containers', received: -6,  expiry: 9   }, // ok (just past the 7-day window)
  { name: 'Cooking Oil',      category: 'other',   quantity: 3,  unit: 'bottles',    received: -3,  expiry: 2   }, // expiring_soon
];

export const SEED_PARTNERS: Partner[] = [
  { id: 'partner-1', name: 'Northside Community Kitchen' },
  { id: 'partner-2', name: 'Hope Street Shelter' },
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
}
interface SeedDelivery {
  id: string;
  donorName: string;
  kind: DeliveryKind;
  when: number; // offset in days from today
  note?: string;
  items: SeedDeliveryItem[];
}

// prettier-ignore
const SEED_DELIVERIES: SeedDelivery[] = [
  {
    id: 'del-1', donorName: "Sal's Catering", kind: 'catering', when: 0, note: 'by 3pm — event leftovers',
    items: [
      { name: 'Baked Ziti',       category: 'grains',  quantity: 6,  unit: 'trays',      expiry: 2 },
      { name: 'Turkey Sandwiches',category: 'protein', quantity: 24, unit: 'sandwiches', expiry: 1 },
      { name: 'Garden Salad',     category: 'produce', quantity: 8,  unit: 'bowls',      expiry: 1 },
    ],
  },
  {
    id: 'del-2', donorName: 'Stop & Shop', kind: 'recurring', when: 0, note: 'usual morning drop',
    items: [
      { name: 'Wheat Bread',      category: 'grains',  quantity: 12, unit: 'loaves',  expiry: 3 },
      { name: 'Bananas',          category: 'produce', quantity: 15, unit: 'bunches', expiry: 4 },
      { name: 'Whole Milk',       category: 'dairy',   quantity: 6,  unit: 'gallons', expiry: 5 },
    ],
  },
];

export interface SeedData {
  lots: InventoryLot[];
  partners: Partner[];
  requests: PickupRequest[];
  deliveries: Delivery[];
  config: Config;
}

/** Build a fresh seed relative to `today`. Called at app start and on reset. */
export function buildSeed(today: ISODate): SeedData {
  const lots: InventoryLot[] = SEED_LOTS.map((s, i) => ({
    id: `lot-${i + 1}`,
    name: s.name,
    category: s.category,
    quantity: s.quantity,
    unit: s.unit,
    receivedDate: addDays(today, s.received),
    expiryDate: addDays(today, s.expiry),
  }));

  // Two pending requests. Confirming either decrements real lots. They overlap
  // on Bananas (lot-6) so that confirming one, then the other, demonstrates
  // partial fulfillment and a shortfall reminder without any extra setup.
  const requests: PickupRequest[] = [
    {
      id: 'req-1',
      partnerId: 'partner-1',
      status: 'requested',
      items: [
        { lotId: 'lot-6', quantity: 3 }, // Bananas
        { lotId: 'lot-9', quantity: 2 }, // Whole Milk (expiry +1)
      ],
    },
    {
      id: 'req-2',
      partnerId: 'partner-2',
      status: 'requested',
      items: [
        { lotId: 'lot-6', quantity: 6 }, // Bananas — overlaps req-1
      ],
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
    note: d.note,
    items: d.items.map((it, j) => ({
      id: `${d.id}-item-${j + 1}`,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      unit: it.unit,
      expiryDate: addDays(today, it.expiry),
    })),
  }));

  return {
    lots,
    partners: SEED_PARTNERS,
    requests,
    deliveries,
    config: DEFAULT_CONFIG,
  };
}
