import { AnimatePresence, motion } from 'motion/react';
import type { InventoryLot } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { getExpiringZoneLots } from '../domain/dashboard';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Card, EmptyCard, Icon, SectionHeader } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * MOVE FIRST — the clock, made visible.
 *
 * Three time buckets (Today / Tomorrow / This week) carry the "when" once,
 * so rows never repeat it. Each row gets a time-to-zero bar: fill = days
 * remaining mapped against the expiring window. Nearly empty = nearly dead.
 * No status pills in here — the zone itself means "expiring."
 * ───────────────────────────────────────────────────────── */

interface Bucket {
  key: string;
  label: string;
  labelClass: string;
  lots: InventoryLot[];
}

export function MoveFirstZone() {
  const { lots, today, config } = useStore();
  const { openLot } = useUI();
  const zone = getExpiringZoneLots(lots, today, config);
  const d = (lot: InventoryLot) => daysUntil(lot.expiryDate, today);

  const buckets: Bucket[] = [
    {
      key: 'today',
      label: 'Today',
      labelClass: 'text-red-700',
      lots: zone.filter((l) => d(l) === 0),
    },
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      labelClass: 'text-amber-700',
      lots: zone.filter((l) => d(l) === 1),
    },
    {
      key: 'week',
      label: 'This week',
      labelClass: 'text-zinc-400',
      lots: zone.filter((l) => d(l) >= 2),
    },
  ].filter((b) => b.lots.length > 0);

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          zone.length > 0 ? (
            <span className="nums rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {zone.length}
            </span>
          ) : null
        }
      >
        Move first
      </SectionHeader>

      {zone.length === 0 ? (
        <div className="mt-3">
          <EmptyCard icon={<Icon name="check" size={16} className="text-emerald-600" />}>
            Nothing expiring soon.
          </EmptyCard>
        </div>
      ) : (
        <div className="mt-1">
          {buckets.map((bucket) => (
            <div key={bucket.key} className="pt-3 first:pt-2">
              <div
                className={cn(
                  'eyebrow flex items-center gap-2 text-[10px] font-bold',
                  bucket.labelClass,
                )}
              >
                {bucket.label}
                <span className="h-px flex-1 bg-zinc-100" />
              </div>
              <ul className="mt-1">
                <AnimatePresence initial={false}>
                  {bucket.lots.map((lot) => (
                    <motion.li
                      key={lot.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={SPRING.reflow}
                      style={{ overflow: 'hidden' }}
                    >
                      <ZoneRow
                        lot={lot}
                        days={d(lot)}
                        window={config.expiringSoonWindowByTier[lot.tier]}
                        onOpen={() => openLot(lot.id)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ZoneRow({
  lot,
  days,
  window,
  onOpen,
}: {
  lot: InventoryLot;
  days: number;
  window: number;
  onOpen: () => void;
}) {
  const urgent = days <= 1;
  // Time-to-zero: full bar = a whole window of life left; sliver = dying now.
  const frac = Math.max(0.07, Math.min(1, days / window));

  return (
    <button
      onClick={onOpen}
      className="group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
      aria-label={`${lot.name} — ${lot.quantity} ${lot.unit}, ${days} days left. Open actions.`}
    >
      <span className="min-w-0 flex-1 truncate font-medium text-zinc-950">
        {lot.name}
      </span>
      <span className="nums shrink-0 text-xs text-zinc-500">
        {lot.quantity} {lot.unit}
      </span>
      <span
        className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-100"
        aria-hidden="true"
      >
        <motion.span
          className={cn(
            'block h-full rounded-full',
            urgent ? 'bg-red-500' : 'bg-amber-500',
          )}
          initial={false}
          animate={{ width: `${frac * 100}%` }}
          transition={SPRING.reflow}
        />
      </span>
      <span
        className={cn(
          'nums w-7 shrink-0 text-right text-sm font-bold',
          urgent ? 'text-red-700' : 'text-amber-700',
        )}
      >
        {days}d
      </span>
      <Icon
        name="chevron"
        size={14}
        className="shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500"
      />
    </button>
  );
}
