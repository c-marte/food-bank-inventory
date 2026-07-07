import { useMemo } from 'react';
import type { Delivery, TeamMember } from '../domain/types';
import { directionsUrl, locationForDonor } from '../data/geo';
import { daysUntil } from '../domain/dates';
import { fullDateLabel } from '../ui/format';
import { Button, Icon, TeamBadge } from '../ui/primitives';
import { QRCodeImage } from '../ui/QRCode';
import { DonorInfoCard } from './DonorInfoCard';

/* ─────────────────────────────────────────────────────────
 * PICKUP's bespoke content for the floating detail panel, in this order:
 *   1. Status header, directly under the map — a headline that mirrors the
 *      SAME three real states the Scheduled Pickups row shows ("Ready for
 *      pickup" today/overdue, "Scheduled for tomorrow", "Scheduled for
 *      {date}" further out — never a hardcoded "Ready for pickup" no
 *      matter when it actually is), same h3/pixel-bold title treatment the
 *      delivery modal's headline uses.
 *   2. The store info card (address/hours/website/phone) — see
 *      DonorInfoCard.tsx for the honesty rationale on that data.
 *   3. A DoorDash-style "Follow on your phone" QR block.
 *   4. The same Add to Inventory CTA the delivery modal has (receiving a
 *      pickup — verifying and logging what was actually collected — is the
 *      same commit point as receiving a delivery, just triggered by our
 *      own initiative instead of the donor's).
 * One deliberate change from the DoorDash reference: its copy promises
 * "download our app" — we have no app, and claiming one would be exactly
 * the kind of fabricated capability this app avoids everywhere else. The
 * QR still encodes a real "Get directions" deep-link (Google Maps computes
 * the real travel time — we never fabricate one); the copy just describes
 * what it actually does. The map itself lives one level up (FoodInPanel),
 * as the full-bleed backdrop this panel floats over.
 * ───────────────────────────────────────────────────────── */

export function PickupDetail({
  delivery,
  today,
  assignee,
  onReceive,
}: {
  delivery: Delivery;
  today: string;
  assignee?: TeamMember;
  onReceive: () => void;
}) {
  const donorLoc = useMemo(() => locationForDonor(delivery.donorName), [delivery.donorName]);
  const url = useMemo(() => directionsUrl(donorLoc), [donorLoc]);

  const daysAway = daysUntil(delivery.expectedDate, today);
  const isReady = daysAway <= 0;
  const isTomorrow = daysAway === 1;
  const headline = isReady
    ? 'Ready for pickup'
    : isTomorrow
      ? 'Scheduled for tomorrow'
      : `Scheduled for ${fullDateLabel(delivery.expectedDate)}`;

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold text-zinc-950">{headline}</h3>
          {isReady ? (
            <span className="eyebrow font-pixel mt-1 shrink-0 text-xs text-emerald-600">
              Ready
            </span>
          ) : (
            <span className="nums mt-1 shrink-0 text-xs font-medium text-zinc-600">
              {isTomorrow ? 'Tomorrow' : fullDateLabel(delivery.expectedDate)}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-500">
          <span className="font-medium text-zinc-900">{delivery.donorName}</span>
          {assignee && <TeamBadge id={assignee.id} name={assignee.name} />}
          {delivery.note && <span className="text-zinc-400">· {delivery.note}</span>}
        </p>
      </div>

      <DonorInfoCard donorName={delivery.donorName} />

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

      <div className="border-t border-zinc-200 px-3 py-3">
        <Button className="w-full" onClick={onReceive}>
          <Icon name="inbox" size={14} /> Add to Inventory
        </Button>
      </div>
    </div>
  );
}
