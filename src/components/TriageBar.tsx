import { AnimatePresence, motion } from 'motion/react';
import { daysUntil } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import { getExpiringZoneLots, getLowStockZone } from '../domain/dashboard';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Card, Icon } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/**
 * The focusing layer. Above the two zones, it answers "what do I touch first?"
 * with one elevated headline, then summarizes the whole shelf as a strip of
 * counts. Everything is derived at render from the same pure functions the
 * zones use — no new state.
 */
export function TriageBar() {
  const { lots, requests, deliveries, today, config } = useStore();
  const { openLot, navigate, setExpiredOnly } = useUI();

  const arrivingToday = deliveries.filter(
    (d) => d.status === 'expected' && d.expectedDate <= today,
  ).length;

  const goToExpired = () => {
    setExpiredOnly(true);
    navigate('inventory');
  };

  const expiring = getExpiringZoneLots(lots, today, config);
  const expired = lots.filter(
    (l) => l.quantity > 0 && getLotStatus(l, today, config) === 'expired',
  );
  const low = getLowStockZone(lots, today, config);
  const pending = requests.filter((r) => r.status === 'requested');

  const mostUrgent = expiring[0];
  const d = mostUrgent ? daysUntil(mostUrgent.expiryDate, today) : null;

  // Headline: lead with the soonest preventable loss; fall back to already-
  // expired cleanup; otherwise an all-clear. Actionable headlines open the
  // verb layer directly — the glance hands you the act.
  let headline: React.ReactNode;
  let signature: string;
  let headlineAction: (() => void) | null = null;
  if (mostUrgent && d !== null) {
    signature = `urgent-${mostUrgent.id}`;
    headlineAction = () => openLot(mostUrgent.id);
    const when =
      d === 0 ? 'expires today' : d === 1 ? 'expires tomorrow' : `expires in ${d} days`;
    headline = (
      <span>
        <span className="font-bold text-zinc-950">{mostUrgent.name}</span>{' '}
        <span className="font-semibold text-amber-700">{when}</span>
        <span className="nums text-zinc-500">
          {' '}
          · {mostUrgent.quantity} {mostUrgent.unit} on the shelf
        </span>
      </span>
    );
  } else if (expired.length > 0) {
    signature = 'expired-cleanup';
    headlineAction = goToExpired;
    headline = (
      <span className="font-semibold text-red-700">
        {expired.length} {expired.length === 1 ? 'lot has' : 'lots have'} already
        expired — pull {expired.length === 1 ? 'it' : 'them'} from the shelf.
      </span>
    );
  } else {
    signature = 'all-clear';
    headline = (
      <span className="font-semibold text-emerald-700">
        Shelves are healthy — nothing expiring soon.
      </span>
    );
  }

  return (
    <Card className="border-zinc-300 p-4 sm:p-5">
      <div className="eyebrow mb-1.5 text-[11px] font-bold text-zinc-400">
        Act first
      </div>

      {/* Elevated single most-urgent fact — cross-fades when it changes, and
          opens the verb layer when there's something to act on. */}
      <div className="relative min-h-[1.75rem] text-lg leading-tight">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={signature}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.pop}
          >
            {headlineAction ? (
              <button
                onClick={headlineAction}
                className="group -mx-1.5 -my-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              >
                <span className="min-w-0">{headline}</span>
                <Icon
                  name="chevron"
                  size={16}
                  className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500"
                />
              </button>
            ) : (
              headline
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* State-of-the-shelf strip. Counts with a destination are tappable. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
        {arrivingToday > 0 && (
          <Stat n={arrivingToday} label="arriving today" tone="zinc" />
        )}
        <Stat n={expiring.length} label="expiring soon" tone="amber" />
        {expired.length > 0 && (
          <Stat
            n={expired.length}
            label="already expired"
            tone="red"
            onClick={goToExpired}
          />
        )}
        <Stat n={low.length} label={low.length === 1 ? 'category low' : 'categories low'} tone="amber" />
        <Stat
          n={pending.length}
          label={pending.length === 1 ? 'pickup waiting' : 'pickups waiting'}
          tone="zinc"
          onClick={() => navigate('pickups')}
        />
      </div>
    </Card>
  );
}

const TONE_DOT: Record<'amber' | 'red' | 'zinc', string> = {
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  zinc: 'bg-zinc-400',
};

function Stat({
  n,
  label,
  tone,
  onClick,
}: {
  n: number;
  label: string;
  tone: 'amber' | 'red' | 'zinc';
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden />
      <span className="relative inline-flex h-6 min-w-[1.25rem] items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={n}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={SPRING.pop}
            className="nums text-lg font-bold text-zinc-950"
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-sm text-zinc-500">{label}</span>
    </>
  );

  if (!onClick) return <div className="flex items-center gap-2 px-1">{inner}</div>;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
    >
      {inner}
      <Icon
        name="chevron"
        size={14}
        className="-ml-0.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500"
      />
    </button>
  );
}
