import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl } from 'react-leaflet';
import type { Delivery } from '../domain/types';
import { DOCK_LOCATION, locationForDonor, type LatLng } from '../data/geo';

/* ─────────────────────────────────────────────────────────
 * A REAL, interactive map (Leaflet + OpenStreetMap tiles — no API key). You
 * can drag and zoom it. What it does NOT claim: a live courier position. We
 * have no real-time GPS, so there's no moving vehicle icon — just two
 * honest, static points (the donor, our dock).
 *
 * The connector between them is a REAL driving route (fetched from OSRM's
 * free, keyless public routing API) — never a hand-drawn curve. A route
 * that "looks like a real road" but isn't one is exactly the fabrication
 * this app's design rejects elsewhere (no fake ETAs, no fake live position),
 * so if the fetch fails, the fallback is a plain DASHED straight line — a
 * deliberately different look, so "solid = a real fetched route" and
 * "dashed = just a connector, we don't actually know the road" are never
 * visually confused with each other.
 *
 * Shared by both the pickup and delivery detail panels — bespoke chrome
 * (stepper vs. "Ready for pickup" header, directions/QR vs. Receive) wraps
 * this same map, rather than the map itself branching on mode.
 * ───────────────────────────────────────────────────────── */

// CARTO's "Positron" basemap — muted, keyless, freely-attributed. Warmed
// toward a stone-gray tone (vs. Positron's native cool blue-white) via a CSS
// filter on the tile images only, so the accent-colored route/dots layered
// on top are untouched.
const BASEMAP_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ROUTE_COLOR = '#c84824'; // the app's one accent color

// Two distinct glyphs, not two plain dots — a "which one's which" signal a
// bare dot can't carry: the dock IS the food bank (home base), the donor is
// the away checkpoint the map pin convention already means to everyone.
const DOCK_GLYPH = '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>';
const DONOR_GLYPH =
  '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>';

function markerIcon(kind: 'dock' | 'donor'): L.DivIcon {
  const glyph = kind === 'dock' ? DOCK_GLYPH : DONOR_GLYPH;
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${ROUTE_COLOR};box-shadow:0 0 0 2px #ffffff,0 1px 3px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const dockIcon = markerIcon('dock');
const donorIcon = markerIcon('donor');

function midpoint(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

interface RouteState {
  coords: LatLng[];
  /** Did this come from a real routing response, or is it the honest
   *  straight-line fallback? Controls solid-vs-dashed styling below. */
  real: boolean;
}

/** Fetch a real driving route between two points from OSRM's public demo
 *  server (free, no API key). Falls back to a straight line — styled
 *  differently on purpose — if the request fails or returns nothing usable. */
function useRoute(a: LatLng, b: LatLng): RouteState {
  const [route, setRoute] = useState<RouteState>({ coords: [a, b], real: false });

  useEffect(() => {
    let active = true;
    setRoute({ coords: [a, b], real: false });

    const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          setRoute({
            coords: coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLng),
            real: true,
          });
        }
      })
      .catch(() => {
        /* keep the straight-line fallback already set above */
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a[0], a[1], b[0], b[1]]);

  return route;
}

export function TrackerMapCanvas({ delivery }: { delivery: Delivery }) {
  const donorLoc = useMemo(() => locationForDonor(delivery.donorName), [delivery.donorName]);
  const center = useMemo(() => midpoint(donorLoc, DOCK_LOCATION), [donorLoc]);
  const outbound = delivery.mode === 'we_go';
  const route = useRoute(donorLoc, DOCK_LOCATION);

  return (
    <div className="relative h-full min-h-28">
      <MapContainer
        key={delivery.id}
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url={BASEMAP_URL}
          attribution={BASEMAP_ATTRIBUTION}
          className="map-tiles-warm"
        />
        {/* bottom-right, not the default top-left — a floating detail panel
            docks to the left edge over this map, and the zoom control would
            otherwise sit underneath it. */}
        <ZoomControl position="bottomright" />
        <Polyline
          positions={route.coords}
          pathOptions={
            // Leaflet's style merge only overwrites keys present in the new
            // object — dashArray must be explicit (even as undefined) in
            // BOTH branches, or a stale '5 6' from the fallback render never
            // clears once a real route resolves.
            route.real
              ? { color: ROUTE_COLOR, weight: 3.5, opacity: 0.9, lineCap: 'round', dashArray: undefined }
              : { color: ROUTE_COLOR, weight: 2, opacity: 0.55, dashArray: '5 6' }
          }
        />
        <Marker position={donorLoc} icon={donorIcon} />
        <Marker position={DOCK_LOCATION} icon={dockIcon} />
      </MapContainer>

      {/* Trip direction — semantic label; the map shows two static points,
          never a claimed live position. Donor name isn't repeated here: the
          floating detail panel already names it prominently. */}
      <div className="eyebrow pointer-events-none absolute right-1.5 top-1.5 z-[500] rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 shadow-sm ring-1 ring-zinc-200">
        {outbound ? 'WE PICK UP' : 'DROP-OFF'}
      </div>
    </div>
  );
}
