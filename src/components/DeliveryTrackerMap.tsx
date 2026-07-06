import { useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import type { Delivery } from '../domain/types';
import { getDeliveryStage } from '../domain/deliveries';
import { daysUntil, parseLocalDate } from '../domain/dates';
import { DOCK_LOCATION, locationForDonor, type LatLng } from '../data/geo';
import { Icon } from '../ui/primitives';
import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * A REAL, interactive map (Leaflet + OpenStreetMap tiles — no API key, the
 * same no-key approach Shopee credits on their own tracking screen). You can
 * drag and zoom it. What it does NOT claim: a live courier position. We have
 * no real-time GPS, so there's no moving vehicle icon — just two honest,
 * static points (the donor, our dock) and a straight dashed connector,
 * explicitly not a routed path.
 *
 * Above the map: a 3-stage stepper (Scheduled → En route → Received) derived
 * from real fields (expectedDate vs. today, status) — never fabricated
 * intermediate states like "preparing" or "out for delivery." Captions are
 * calendar dates, never clock times — this app tracks days, not hours.
 * ───────────────────────────────────────────────────────── */

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

export function DeliveryTrackerMap({
  delivery,
  today,
}: {
  delivery: Delivery;
  today: string;
}) {
  const donorLoc = useMemo(() => locationForDonor(delivery.donorName), [delivery.donorName]);
  const center = useMemo(() => midpoint(donorLoc, DOCK_LOCATION), [donorLoc]);
  const stage = getDeliveryStage(delivery, today);
  const outbound = delivery.mode === 'we_go';

  return (
    <div className="flex h-full min-h-28 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <Stepper stage={stage} delivery={delivery} today={today} />

      <div className="relative min-h-28 flex-1">
        <MapContainer
          key={delivery.id}
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={OSM_ATTRIBUTION}
          />
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
    </div>
  );
}

const STAGE_ORDER: { key: 'scheduled' | 'en_route' | 'received'; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'en_route', label: 'En route' },
  { key: 'received', label: 'Received' },
];

function Stepper({
  stage,
  delivery,
  today,
}: {
  stage: 'scheduled' | 'en_route' | 'received';
  delivery: Delivery;
  today: string;
}) {
  const currentIndex = STAGE_ORDER.findIndex((s) => s.key === stage);

  // Calendar-date captions only — this app has no clock times, by design.
  const caption = (() => {
    if (stage === 'received' && delivery.receivedDate) {
      return `Received ${fullDate(delivery.receivedDate)}`;
    }
    const d = daysUntil(delivery.expectedDate, today);
    if (stage === 'en_route') {
      return d < 0
        ? `Expected ${fullDate(delivery.expectedDate)} — overdue`
        : 'Expected today';
    }
    return `Expected ${fullDate(delivery.expectedDate)}`;
  })();

  return (
    <div className="border-b border-zinc-200 bg-white px-3 pb-2.5 pt-3">
      <div className="flex items-center">
        {STAGE_ORDER.map((s, i) => (
          <span key={s.key} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                i < currentIndex
                  ? 'bg-emerald-500 text-white'
                  : i === currentIndex
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-200 text-zinc-400',
              )}
            >
              {i < currentIndex ? <Icon name="check" size={11} /> : i + 1}
            </span>
            {i < STAGE_ORDER.length - 1 && (
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i < currentIndex ? 'bg-emerald-500' : 'bg-zinc-200',
                )}
              />
            )}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-zinc-500">
        {STAGE_ORDER.map((s, i) => (
          <span key={s.key} className={cn(i === currentIndex && 'font-bold text-zinc-950')}>
            {s.label}
          </span>
        ))}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{caption}</div>
    </div>
  );
}

function fullDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
