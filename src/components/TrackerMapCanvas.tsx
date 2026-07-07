import { useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import type { Delivery } from '../domain/types';
import { DOCK_LOCATION, locationForDonor, type LatLng } from '../data/geo';

/* ─────────────────────────────────────────────────────────
 * A REAL, interactive map (Leaflet + OpenStreetMap tiles — no API key). You
 * can drag and zoom it. What it does NOT claim: a live courier position. We
 * have no real-time GPS, so there's no moving vehicle icon — just two
 * honest, static points (the donor, our dock) and a straight dashed
 * connector, explicitly not a routed path.
 *
 * Shared by both the pickup and delivery detail panels — bespoke chrome
 * (stepper vs. "Ready for pickup" header, directions/QR vs. Receive) wraps
 * this same map, rather than the map itself branching on mode.
 * ───────────────────────────────────────────────────────── */

// CARTO's "Positron" basemap — a muted, keyless, freely-attributed tile set.
const BASEMAP_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function pinDivIcon(kind: 'donor' | 'dock'): L.DivIcon {
  const bg = kind === 'donor' ? '#09090b' : '#ffffff';
  const fg = kind === 'donor' ? '#ffffff' : '#3f3f46';
  const ring = kind === 'donor' ? '#ffffff' : '#d4d4d8';
  const glyph =
    kind === 'donor'
      ? '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>'
      : '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>';
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${bg};box-shadow:0 1px 3px rgba(0,0,0,.3);border:2px solid ${ring};display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const donorIcon = pinDivIcon('donor');
const dockIcon = pinDivIcon('dock');

function midpoint(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function TrackerMapCanvas({ delivery }: { delivery: Delivery }) {
  const donorLoc = useMemo(() => locationForDonor(delivery.donorName), [delivery.donorName]);
  const center = useMemo(() => midpoint(donorLoc, DOCK_LOCATION), [donorLoc]);
  const outbound = delivery.mode === 'we_go';

  return (
    <div className="relative h-full min-h-28">
      <MapContainer
        key={delivery.id}
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer url={BASEMAP_URL} attribution={BASEMAP_ATTRIBUTION} />
        <Polyline
          positions={[donorLoc, DOCK_LOCATION]}
          pathOptions={{ color: '#3f3f46', weight: 2, dashArray: '5 6', opacity: 0.7 }}
        />
        <Marker position={donorLoc} icon={donorIcon} />
        <Marker position={DOCK_LOCATION} icon={dockIcon} />
      </MapContainer>

      {/* Trip direction — semantic label; the map shows two static points,
          never a claimed live position. */}
      <div className="eyebrow pointer-events-none absolute right-1.5 top-1.5 z-[500] rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 shadow-sm ring-1 ring-zinc-200">
        {outbound ? 'WE PICK UP' : 'DROP-OFF'}
      </div>
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-[500] max-w-[70%] truncate rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200">
        {delivery.donorName}
      </div>
    </div>
  );
}
