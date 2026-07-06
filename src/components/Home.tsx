import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TriageBar } from './TriageBar';
import { FoodInPanel } from './FoodInPanel';
import { FoodOutPanel } from './FoodOutPanel';
import { DecayTimeline } from './DecayTimeline';
import { MoveFirstZone } from './MoveFirstZone';
import { LowStockZone } from './LowStockZone';
import { ImpactSection } from './ImpactSection';
import { Icon } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/** Shelf home: one urgent headline (Act first), then Food In full-width with
 *  its real map, then Inventory-soon-to-expire beside Food Out. The rest of
 *  the rich status (Move first, Low stock) is one tap away behind "View the
 *  full shelf". */
export function Home() {
  const [showShelf, setShowShelf] = useState(false);

  return (
    <div className="space-y-4">
      <TriageBar />
      <FoodInPanel />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DecayTimeline />
        <FoodOutPanel />
      </div>

      {/* The full picture, on demand. */}
      <div>
        <button
          onClick={() => setShowShelf((v) => !v)}
          aria-expanded={showShelf}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="clock" size={16} className="text-zinc-400" />
            View the full shelf
            <span className="text-zinc-400">— low stock, category breakdown</span>
          </span>
          <span
            className={cn(
              'text-zinc-400 transition-transform',
              showShelf && 'rotate-90',
            )}
          >
            <Icon name="chevron" size={16} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showShelf && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING.reflow}
              style={{ overflow: 'hidden' }}
            >
              <div className="grid items-start gap-4 pt-4 md:grid-cols-2">
                <MoveFirstZone />
                <LowStockZone />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Retrospective, not actionable — last on the page by design. */}
      <ImpactSection />
    </div>
  );
}
