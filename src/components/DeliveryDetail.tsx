import type { Delivery } from '../domain/types';
import { getDeliveryStage } from '../domain/deliveries';
import { daysUntil, parseLocalDate } from '../domain/dates';
import { Button, CourierBadge, Icon } from '../ui/primitives';
import { ManifestDisclosure } from './FlowTileVisuals';
import { TrackerMapCanvas } from './TrackerMapCanvas';
import { cn } from '../ui/cn';

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

/* ─────────────────────────────────────────────────────────
 * DELIVERY's bespoke right-hand detail: the 3-stage stepper (Scheduled ->
 * En route -> Received, derived from expectedDate vs. today + status, never
 * stored), a human expected window, a manifest you can expand for a
 * cross-check, the donor's courier (if named — neutral avatar, never
 * TeamAvatar), and the Receive CTA. Pickup gets none of this — see
 * PickupDetail.tsx for its "Ready for pickup" + directions/QR template.
 * ───────────────────────────────────────────────────────── */

const STAGE_ORDER: { key: 'scheduled' | 'en_route' | 'received'; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'en_route', label: 'En route' },
  { key: 'received', label: 'Received' },
];

function fullDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function Stepper({ delivery, today }: { delivery: Delivery; today: string }) {
  const stage = getDeliveryStage(delivery, today);
  const currentIndex = STAGE_ORDER.findIndex((s) => s.key === stage);

  // Calendar-date captions only — this app has no clock times, by design.
  const caption = (() => {
    if (stage === 'received' && delivery.receivedDate) {
      return `Received ${fullDate(delivery.receivedDate)}`;
    }
    const d = daysUntil(delivery.expectedDate, today);
    if (stage === 'en_route') {
      return d < 0 ? `Expected ${fullDate(delivery.expectedDate)} — overdue` : 'Expected today';
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
                className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-emerald-500' : 'bg-zinc-200')}
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

export function DeliveryDetail({
  delivery,
  today,
  onReceive,
}: {
  delivery: Delivery;
  today: string;
  onReceive: () => void;
}) {
  return (
    <div className="flex h-full min-h-28 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <Stepper delivery={delivery} today={today} />

      <div className="min-h-28 flex-1">
        <TrackerMapCanvas delivery={delivery} />
      </div>

      <div className="space-y-2 border-t border-zinc-200 bg-white px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">{delivery.donorName}</span>
          <span>
            expected{' '}
            <span className="font-medium text-zinc-700">
              {delivery.note ?? timingLabel(daysUntil(delivery.expectedDate, today))}
            </span>
          </span>
        </p>

        {delivery.courierName && (
          <CourierBadge name={delivery.courierName} phone={delivery.courierPhone} />
        )}

        <ManifestDisclosure delivery={delivery} />

        <Button className="w-full" onClick={onReceive}>
          <Icon name="inbox" size={14} /> Receive
        </Button>
      </div>
    </div>
  );
}
