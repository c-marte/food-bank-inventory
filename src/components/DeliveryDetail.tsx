import { motion } from 'motion/react';
import type { Delivery } from '../domain/types';
import { getDeliveryStage, getDeliveryProgress } from '../domain/deliveries';
import { daysUntil, parseLocalDate } from '../domain/dates';
import { Button, Icon, TierMark } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * DELIVERY's bespoke content for the floating detail panel: an Uber-Eats-
 * style status header (a headline naming the real stage, an arrival window
 * under it, a 5-segment progress bar, then a second window line below the
 * bar), then the courier and the manifest side by side — both always
 * visible, never behind a "See more" disclosure, since who's bringing it
 * and what's in it are the two things that actually matter here, not
 * secondary details worth hiding. The store info block that pickups show
 * was deliberately dropped from this modal: the donor's coming to US, so
 * their address/hours/website aren't the load-bearing fact the way they are
 * for a pickup (see PickupDetail.tsx, which keeps it). The map itself lives
 * one level up (FoodInPanel/DonorDetailModal), as the backdrop this content
 * sits under.
 *
 * The "Estimated arrival" / "Latest arrival" lines are NOT computed ETAs —
 * this app has no GPS, so it can't track a real one. They render
 * `estimatedWindow` / `latestWindow`, two fields the donor states verbatim
 * on the phone call (see ExpectDeliverySheet). When a delivery doesn't have
 * them, this falls back to the calendar-date + free-text `note` it always
 * had — never a fabricated clock time.
 * ───────────────────────────────────────────────────────── */

const SEGMENTS = 5;

function fullDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function SegmentedBar({ progress, tone }: { progress: number; tone: string }) {
  return (
    <div className="mt-3 flex gap-1">
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const segStart = i / SEGMENTS;
        const segEnd = (i + 1) / SEGMENTS;
        const fillPct =
          Math.max(0, Math.min(1, (progress - segStart) / (segEnd - segStart))) * 100;
        return (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
            <motion.div
              className={cn('h-full rounded-full', tone)}
              initial={false}
              animate={{ width: `${fillPct}%` }}
              transition={SPRING.reflow}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatusHeader({ delivery, today }: { delivery: Delivery; today: string }) {
  const stage = getDeliveryStage(delivery, today);
  const progress = getDeliveryProgress(delivery, today);
  const overdue = stage === 'en_route' && daysUntil(delivery.expectedDate, today) < 0;
  const stageTone =
    stage === 'received' ? 'bg-emerald-500' : stage === 'en_route' ? 'bg-sky-500' : 'bg-zinc-400';

  const headline = (() => {
    if (stage === 'received') return 'Received';
    if (stage === 'en_route') return overdue ? 'Overdue' : 'Heading your way...';
    return 'Scheduled';
  })();

  // The estimated window is the donor's own stated words, never a computed
  // ETA — falls back to the calendar date when they didn't give one.
  const subtext = (() => {
    if (stage === 'received' && delivery.receivedDate) {
      return `Logged ${fullDate(delivery.receivedDate)}`;
    }
    if (delivery.estimatedWindow) return `Estimated arrival ${delivery.estimatedWindow}`;
    if (overdue) return `Was expected ${fullDate(delivery.expectedDate)}`;
    return `Expected ${fullDate(delivery.expectedDate)}`;
  })();

  const latestLine = (() => {
    if (stage === 'received') return null;
    if (delivery.latestWindow) return `Latest arrival by ${delivery.latestWindow}`;
    if (delivery.note) return `Donor's window: ${delivery.note}`;
    return null;
  })();

  return (
    <div className="px-3 pb-3 pt-3.5">
      <h3 className="text-xl font-bold text-zinc-950">{headline}</h3>
      <p className="mt-0.5 text-sm text-zinc-500">{subtext}</p>

      <SegmentedBar progress={progress} tone={stageTone} />

      {latestLine && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-zinc-500">
          <Icon name="clock" size={12} className="mt-0.5 shrink-0 text-zinc-400" />
          <span>{latestLine}</span>
        </p>
      )}
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
    <div className="flex flex-col">
      <StatusHeader delivery={delivery} today={today} />

      <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 px-3 py-3">
        <div>
          <h4 className="eyebrow text-[11px] font-bold text-zinc-400">Courier</h4>
          {delivery.courierName ? (
            <div className="mt-1.5 flex items-start gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 ring-1 ring-inset ring-zinc-200">
                <Icon name="user" size={17} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-950">
                  {delivery.courierName}
                </div>
                {delivery.courierPhone && (
                  <a
                    href={`tel:${delivery.courierPhone}`}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    {delivery.courierPhone}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-zinc-400">Not named yet.</p>
          )}
        </div>

        <div>
          <h4 className="eyebrow text-[11px] font-bold text-zinc-400">
            {delivery.items.length} item{delivery.items.length === 1 ? '' : 's'}
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {delivery.items.map((it) => (
              <li key={it.id} className="nums flex items-center gap-1.5 text-sm text-zinc-700">
                <TierMark tier={it.tier} size={12} />
                <span className="font-medium">{it.quantity}</span>
                <span className="truncate">{it.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-200 px-3 py-3">
        <Button className="w-full" onClick={onReceive}>
          <Icon name="inbox" size={14} /> Add to Inventory
        </Button>
      </div>
    </div>
  );
}
