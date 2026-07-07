import { useMemo, useState } from 'react';
import type { Delivery, TeamMember } from '../domain/types';
import { directionsUrl, locationForDonor } from '../data/geo';
import { Button, Icon, TeamAvatar } from '../ui/primitives';
import { QRCodeImage } from '../ui/QRCode';
import { TrackerMapCanvas } from './TrackerMapCanvas';
import { DirectionsSheet } from './DirectionsSheet';

/* ─────────────────────────────────────────────────────────
 * PICKUP's bespoke right-hand detail: no stepper (this is awaiting OUR
 * initiative, not tracking an inbound journey that has stages). Instead:
 * "Ready for pickup" + the map + a real "Get directions" deep-link (Google
 * Maps computes the real travel time — we never fabricate one) + a QR code
 * encoding that same link, so a volunteer can scan it to their phone rather
 * than typing an address. No Receive CTA here — see DeliveryDetail.tsx.
 * ───────────────────────────────────────────────────────── */

export function PickupDetail({
  delivery,
  assignee,
}: {
  delivery: Delivery;
  assignee?: TeamMember;
}) {
  const donorLoc = useMemo(() => locationForDonor(delivery.donorName), [delivery.donorName]);
  const url = useMemo(() => directionsUrl(donorLoc), [donorLoc]);
  const [directionsOpen, setDirectionsOpen] = useState(false);

  return (
    <div className="flex h-full min-h-28 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
          <Icon name="box" size={14} /> Ready for pickup
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-900">{delivery.donorName}</span>
          {assignee && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 py-0.5 pl-0.5 pr-2 ring-1 ring-sky-200">
              <TeamAvatar id={assignee.id} name={assignee.name} size={18} />
              <span className="text-[11px] font-medium text-sky-700">{assignee.name.split(' ')[0]}</span>
              <span className="eyebrow text-[9px] font-bold text-sky-500">YOUR PICKUP</span>
            </span>
          )}
          {delivery.note && <span className="text-zinc-400">· {delivery.note}</span>}
        </p>
      </div>

      <div className="min-h-28 flex-1">
        <TrackerMapCanvas delivery={delivery} />
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-200 bg-white px-3 py-2.5">
        <QRCodeImage value={url} size={72} />
        <div className="min-w-0 flex-1">
          <Button className="w-full" size="lg" onClick={() => setDirectionsOpen(true)}>
            <Icon name="pin" size={14} /> Send me directions
          </Button>
          <p className="mt-1 truncate text-[10px] text-zinc-400">Scan to open on your phone</p>
        </div>
      </div>
      <DirectionsSheet
        open={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        donorName={delivery.donorName}
        url={url}
      />
    </div>
  );
}
