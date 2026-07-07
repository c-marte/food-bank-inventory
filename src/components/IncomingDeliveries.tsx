import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Delivery } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { useStore } from '../store/useStore';
import { Card, Icon, SectionHeader, TeamBadge, TierMark } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';
import { TrackerMapCanvas } from './TrackerMapCanvas';

const KIND_LABEL: Record<Delivery['kind'], string> = {
  recurring: 'Recurring',
  catering: 'Catering',
  drive: 'Food drive',
  individual: 'Walk-in',
};

/** Incoming deliveries = promises waiting to be received. Time-sensitive (the
 *  food is on its way), so they live on Home. Receiving opens the dock sheet;
 *  received deliveries leave the list (they've become lots). */
export function IncomingDeliveries() {
  const { deliveries, team, today } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const expected = deliveries
    .filter((d) => d.status === 'expected')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  if (expected.length === 0) return null;

  const incoming = expected.filter((d) => d.mode === 'they_come');
  const pickups = expected.filter((d) => d.mode === 'we_go');
  const mapDelivery = expected.find((d) => d.id === selectedId) ?? expected[0];

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="truck" size={14} className="text-zinc-400" /> Incoming
        </span>
      </SectionHeader>
      <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Two distinct lists — a delivery (they come) is not a pickup (we go). */}
          {incoming.length > 0 && (
            <>
              <div className="eyebrow text-[10px] font-bold text-zinc-400">
                Deliveries — {incoming.length}
              </div>
              <ul className="mt-1.5 space-y-2.5">
                <AnimatePresence initial={false}>
                  {incoming.map((d) => (
                    <DeliveryRow
                      key={d.id}
                      delivery={d}
                      daysAway={daysUntil(d.expectedDate, today)}
                      assignee={team.find((t) => t.id === d.assigneeId)}
                      selected={d.id === mapDelivery.id}
                      onSelect={() => setSelectedId(d.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}

          {pickups.length > 0 && (
            <>
              <div className={cn('eyebrow text-[10px] font-bold text-zinc-400', incoming.length > 0 && 'mt-4')}>
                Our pickups — {pickups.length}
              </div>
              <ul className="mt-1.5 space-y-2.5">
                <AnimatePresence initial={false}>
                  {pickups.map((d) => (
                    <DeliveryRow
                      key={d.id}
                      delivery={d}
                      daysAway={daysUntil(d.expectedDate, today)}
                      assignee={team.find((t) => t.id === d.assigneeId)}
                      selected={d.id === mapDelivery.id}
                      onSelect={() => setSelectedId(d.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </div>

        {mapDelivery && (
          <div className="min-h-[340px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            <TrackerMapCanvas delivery={mapDelivery} />
          </div>
        )}
      </div>
    </Card>
  );
}

function DeliveryRow({
  delivery,
  daysAway,
  assignee,
  selected,
  onSelect,
}: {
  delivery: Delivery;
  daysAway: number;
  assignee?: { id: string; name: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const when =
    daysAway <= 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `in ${daysAway} days`;
  const units = delivery.items.reduce((s, it) => s + it.quantity, 0);
  const tripLabel = delivery.mode === 'we_go' ? 'we pick up' : 'drop-off';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={SPRING.reflow}
      className={cn(
        'rounded-lg border p-3 transition-colors',
        selected
          ? 'border-zinc-950 bg-zinc-50'
          : 'border-zinc-300 hover:border-zinc-400',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
      >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-950">
            {delivery.donorName}
          </span>
          <span className="eyebrow rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
            {KIND_LABEL[delivery.kind]}
          </span>
          <span className="eyebrow rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
            {tripLabel}
          </span>
          <span
            className={cn(
              'eyebrow inline-flex items-center gap-1 text-[10px] font-bold',
              daysAway <= 0 ? 'text-amber-700' : 'text-zinc-400',
            )}
          >
            <Icon name="clock" size={11} /> {when}
          </span>
          {assignee && <TeamBadge id={assignee.id} name={assignee.name} />}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-600">
        {delivery.items.map((it, i) => (
          <span key={it.id} className="nums inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-300">·</span>}
            <TierMark tier={it.tier} size={12} />
            {it.quantity} {it.name}
          </span>
        ))}
      </div>
      {delivery.note && (
        <div className="mt-1 text-xs text-zinc-400">
          {delivery.note} · ~{units} units expected
        </div>
      )}
      </button>
    </motion.li>
  );
}
