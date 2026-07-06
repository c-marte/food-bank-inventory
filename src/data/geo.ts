// ---------------------------------------------------------------------------
// Map coordinates — seed-only demo data. The businesses are fictional, but
// the map tiles are real (OpenStreetMap), so pins need to sit somewhere real
// or the streets under them won't line up with anything. Placed around one
// real neighborhood (Boston's South End) purely for texture; nothing here
// claims a real address exists — it's the same kind of fictional-but-
// plausible seed data as the donor names themselves.
// ---------------------------------------------------------------------------

export type LatLng = [number, number];

/** Our dock — the constant destination on every Food In map. */
export const DOCK_LOCATION: LatLng = [42.3398, -71.0892];

/** Known donors get a fixed, plausible pin. */
export const DONOR_LOCATIONS: Record<string, LatLng> = {
  'Stop & Shop': [42.3467, -71.0972],
  "Sal's Catering": [42.3355, -71.0819],
  'Riverside Bakery': [42.3506, -71.081],
  'Lincoln Elementary Drive': [42.3283, -71.0951],
};

/** A donor name typed freehand (not one of the known chips) still needs a
 *  pin. Deterministic per name (same hash approach as the team-avatar
 *  palette) so the same typed name always lands in the same spot, jittered a
 *  plausible distance from the dock rather than exactly on top of it. */
export function locationForDonor(name: string): LatLng {
  const known = DONOR_LOCATIONS[name];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const distanceDeg = 0.01 + (Math.abs(hash >> 8) % 100) / 10000; // ~1-2km
  return [
    DOCK_LOCATION[0] + Math.sin(angle) * distanceDeg,
    DOCK_LOCATION[1] + Math.cos(angle) * distanceDeg,
  ];
}
