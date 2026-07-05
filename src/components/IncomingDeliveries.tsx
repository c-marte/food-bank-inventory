import { AnimatePresence, motion } from 'motion/react';
import type { Delivery } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon, SectionHeader } from '../ui/primitives';
import { foodEmoji } from '../ui/foodEmoji';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

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
  const { deliveries, today } = useStore();
  const { openExpect, openReceive } = useUI();

  const expected = deliveries
    .filter((d) => d.status === 'expected')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  if (expected.length === 0) return null;

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          <button
            onClick={openExpect}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <Icon name="plus" size={13} /> Expect another
          </button>
        }
      >
        Incoming deliveries
      </SectionHeader>

      <ul className="mt-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {expected.map((d) => (
            <DeliveryRow
              key={d.id}
              delivery={d}
              daysAway={daysUntil(d.expectedDate, today)}
              onReceive={() => openReceive(d.id)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}

function DeliveryRow({
  delivery,
  daysAway,
  onReceive,
}: {
  delivery: Delivery;
  daysAway: number;
  onReceive: () => void;
}) {
  const when =
    daysAway <= 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `in ${daysAway} days`;
  const units = delivery.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={SPRING.reflow}
      className="rounded-lg border border-zinc-300 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-950">
            {delivery.donorName}
          </span>
          <span className="eyebrow rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
            {KIND_LABEL[delivery.kind]}
          </span>
          <span
            className={cn(
              'eyebrow inline-flex items-center gap-1 text-[10px] font-bold',
              daysAway <= 0 ? 'text-amber-700' : 'text-zinc-400',
            )}
          >
            <Icon name="clock" size={11} /> {when}
          </span>
        </div>
        <Button size="sm" onClick={onReceive}>
          <Icon name="inbox" size={14} /> Receive
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-600">
        {delivery.items.map((it) => (
          <span key={it.id} className="nums inline-flex items-center gap-1">
            <span className="text-base leading-none">{foodEmoji(it.name)}</span>
            {it.quantity} {it.name}
          </span>
        ))}
      </div>
      {delivery.note && (
        <div className="mt-1 text-xs text-zinc-400">
          {delivery.note} · ~{units} units expected
        </div>
      )}
    </motion.li>
  );
}
