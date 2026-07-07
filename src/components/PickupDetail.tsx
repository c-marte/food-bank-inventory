import { useMemo } from 'react';
import type { Delivery, TeamMember } from '../domain/types';
import { directionsUrl, locationForDonor } from '../data/geo';
import { Icon, TeamBadge } from '../ui/primitives';
import { QRCodeImage } from '../ui/QRCode';

/* ─────────────────────────────────────────────────────────
 * PICKUP's bespoke content for the floating detail panel: no stepper (this
 * is awaiting OUR initiative, not tracking an inbound journey that has
 * stages). Instead: "Ready for pickup" + a DoorDash-style "Follow on your
 * phone" QR block. One deliberate change from the DoorDash reference: its
 * copy promises "download our app" — we have no app, and claiming one would
 * be exactly the kind of fabricated capability this app avoids everywhere
 * else. The QR still encodes a real "Get directions" deep-link (Google Maps
 * computes the real travel time — we never fabricate one); the copy just
 * describes what it actually does. The map itself lives one level up
 * (FoodInPanel), as the full-bleed backdrop this panel floats over.
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

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-3 pt-3.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
          <Icon name="box" size={14} /> Ready for pickup
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-900">{delivery.donorName}</span>
          {assignee && <TeamBadge id={assignee.id} name={assignee.name} />}
          {delivery.note && <span className="text-zinc-400">· {delivery.note}</span>}
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-zinc-200 px-3 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">Follow on your phone</h4>
          <p className="mt-1 text-xs text-zinc-500">
            Scan QR code to get directions on your phone when it's time to
            grab your donation.
          </p>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Get directions">
          <QRCodeImage value={url} size={64} />
        </a>
      </div>
    </div>
  );
}
