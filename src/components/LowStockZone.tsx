import { AnimatePresence, motion } from 'motion/react';
import { CATEGORY_LABELS } from '../domain/types';
import { getLowStockZone, type LowStockEntry } from '../domain/dashboard';
import { useStore } from '../store/useStore';
import { Card, EmptyCard, Icon, SectionHeader } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

export function LowStockZone() {
  const { lots, today, config } = useStore();
  const zone = getLowStockZone(lots, today, config);

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          zone.length > 0 ? (
            <span className="nums rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">
              {zone.length}
            </span>
          ) : null
        }
      >
        Low stock
      </SectionHeader>

      {zone.length === 0 ? (
        <div className="mt-3">
          <EmptyCard icon={<Icon name="check" size={16} className="text-emerald-600" />}>
            All categories are stocked.
          </EmptyCard>
        </div>
      ) : (
        <ul className="mt-3">
          <AnimatePresence initial={false}>
            {zone.map((entry) => (
              <motion.li
                key={entry.category}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING.reflow}
                style={{ overflow: 'hidden' }}
              >
                <div className="pb-3">
                  <LowStockRow entry={entry} />
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function LowStockRow({ entry }: { entry: LowStockEntry }) {
  const ratio = entry.threshold > 0 ? entry.current / entry.threshold : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const critical = ratio <= 0.34;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-zinc-950">
          {CATEGORY_LABELS[entry.category]}
        </span>
        <span className="nums text-sm text-zinc-600">
          <b className={cn('font-bold', critical ? 'text-red-700' : 'text-amber-700')}>
            {entry.current}
          </b>{' '}
          / {entry.threshold} in stock
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100"
        aria-hidden="true"
      >
        <motion.div
          className={cn('h-full rounded-full', critical ? 'bg-red-500' : 'bg-amber-500')}
          initial={false}
          animate={{ width: `${Math.max(4, pct)}%` }}
          transition={SPRING.reflow}
        />
      </div>
    </div>
  );
}
