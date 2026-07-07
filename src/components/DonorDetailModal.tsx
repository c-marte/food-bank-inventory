import type { Delivery, TeamMember } from '../domain/types';
import { Sheet } from '../ui/Sheet';
import { TrackerMapCanvas } from './TrackerMapCanvas';
import { PickupDetail } from './PickupDetail';
import { DeliveryDetail } from './DeliveryDetail';

/* ─────────────────────────────────────────────────────────
 * The DoorDash "More info" pattern, applied here: a title bar naming the
 * donor, a real map bleeding edge-to-edge right under it, then the bespoke
 * detail (stage/status, courier, manifest, directions/QR) stacked below —
 * same visual hierarchy (map first, structured facts second, one primary
 * action last), same content that used to live inline, now surfaced on
 * demand from a "See more" row instead of always occupying page space.
 * ───────────────────────────────────────────────────────── */

export function DonorDetailModal({
  delivery,
  today,
  assignee,
  onClose,
  onReceive,
}: {
  delivery: Delivery | null;
  today: string;
  assignee?: TeamMember;
  onClose: () => void;
  onReceive: (deliveryId: string) => void;
}) {
  return (
    <Sheet open={delivery !== null} onClose={onClose} title={delivery?.donorName ?? ''}>
      {delivery && (
        <>
          <div className="-mx-4 -mt-4 mb-4 h-52 overflow-hidden sm:-mx-6 sm:-mt-6 sm:mb-5 sm:h-60">
            <TrackerMapCanvas delivery={delivery} />
          </div>
          {delivery.mode === 'we_go' ? (
            <PickupDetail
              delivery={delivery}
              today={today}
              assignee={assignee}
              onReceive={() => onReceive(delivery.id)}
            />
          ) : (
            <DeliveryDetail
              delivery={delivery}
              today={today}
              onReceive={() => onReceive(delivery.id)}
            />
          )}
        </>
      )}
    </Sheet>
  );
}
