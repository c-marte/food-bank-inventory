import type {
  Delivery,
  InventoryLot,
  ISODate,
  OutboundMovement,
  Partner,
  WasteEvent,
} from './types';

// ---------------------------------------------------------------------------
// Impact — retrospective, morale-facing numbers for the shelf-keeper: what did
// all this add up to? Every figure here is a real count from the records that
// already exist elsewhere in the app — nothing is estimated or invented.
//
// Notably absent: "pounds of food redistributed." Lots carry mixed units
// (cans, gallons, loaves, trays) with no weight conversion, so summing
// quantities across units would fabricate a number precision can't back up —
// the same reasoning that ruled out a live GPS map and a fake 4-stage
// fulfillment stepper earlier in this build. Counts of real records
// (donations, movements, donors) stay honest; a cross-unit total wouldn't.
// ---------------------------------------------------------------------------

export interface ImpactStats {
  /** Lots logged in the window (InventoryLot.receivedDate). */
  donationsLogged: number;
  /** Released movements to meal programs (kitchens/shelters) in the window. */
  sentToShelters: number;
  /** Released movements to families in the window. */
  familyBoxesPacked: number;
  /** Distinct donor names behind a RECEIVED delivery in the window. */
  donorsCount: number;
  /** % of (released + wasted) units that were released, not thrown out.
   *  null when there's no released-or-wasted activity yet to compute a rate from. */
  diversionRatePct: number | null;
}

function inWindow(date: ISODate, since: ISODate, today: ISODate): boolean {
  // 'YYYY-MM-DD' sorts lexically == chronologically — the pattern used
  // throughout this codebase (expiryDate.localeCompare, etc).
  return date >= since && date <= today;
}

/**
 * Compute impact stats for [since, today] inclusive. Callers choose the
 * window: `addDays(today, -30)` for a rolling 30 days, `yearStartDate(today)`
 * for year-to-date — the caller decides, this function just counts.
 */
export function getImpactStats(
  lots: InventoryLot[],
  deliveries: Delivery[],
  movements: OutboundMovement[],
  partners: Partner[],
  wasteEvents: WasteEvent[],
  today: ISODate,
  since: ISODate,
): ImpactStats {
  const donationsLogged = lots.filter((l) =>
    inWindow(l.receivedDate, since, today),
  ).length;

  const releasedInWindow = movements.filter(
    (m) =>
      m.status === 'released' &&
      m.releasedDate &&
      inWindow(m.releasedDate, since, today),
  );
  const kindOf = (m: OutboundMovement) =>
    partners.find((p) => p.id === m.recipientId)?.kind;
  const sentToShelters = releasedInWindow.filter(
    (m) => kindOf(m) === 'meal_program',
  ).length;
  const familyBoxesPacked = releasedInWindow.filter(
    (m) => kindOf(m) === 'family',
  ).length;

  const donorsCount = new Set(
    deliveries
      .filter(
        (d) =>
          d.status === 'received' &&
          d.receivedDate &&
          inWindow(d.receivedDate, since, today),
      )
      .map((d) => d.donorName),
  ).size;

  const releasedUnits = releasedInWindow.reduce(
    (sum, m) => sum + m.lines.reduce((s, l) => s + (l.released ?? 0), 0),
    0,
  );
  const wastedUnits = wasteEvents
    .filter((w) => inWindow(w.date, since, today))
    .reduce((sum, w) => sum + w.quantity, 0);
  const denominator = releasedUnits + wastedUnits;
  const diversionRatePct =
    denominator > 0 ? Math.round((releasedUnits / denominator) * 100) : null;

  return {
    donationsLogged,
    sentToShelters,
    familyBoxesPacked,
    donorsCount,
    diversionRatePct,
  };
}
