import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUI } from '../store/useUI';
import { TodayWorklist } from './TodayWorklist';
import { DecayTimeline } from './DecayTimeline';
import { MoveFirstZone } from './MoveFirstZone';
import { LowStockZone } from './LowStockZone';
import { Button, Icon } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/** Shelf = "Today": a decay-generated worklist you clear, not a dashboard you
 *  parse. Proactive entry points sit in a slim action row; the rich status
 *  (timeline + zones) is one tap away behind "View the full shelf". */
export function Home() {
  const { openIntake, openPickup, openExpect } = useUI();
  const [showShelf, setShowShelf] = useState(false);

  return (
    <div className="space-y-4">
      {/* Proactive entry points — the two verbs; walk-in demoted to ghost. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={openExpect}>
          <Icon name="inbox" size={16} /> Expect a delivery
        </Button>
        <Button size="lg" variant="outline" onClick={() => openPickup()}>
          <Icon name="arrow" size={16} /> Log a request
        </Button>
        <Button size="lg" variant="ghost" onClick={openIntake}>
          <Icon name="plus" size={16} /> Walk-in
        </Button>
      </div>

      {/* The hero: the ranked list of what to do today. */}
      <TodayWorklist />

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
            <span className="text-zinc-400">— timeline, what's dying, low stock</span>
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
              <div className="space-y-4 pt-4">
                <DecayTimeline />
                <div className="grid items-start gap-4 md:grid-cols-2">
                  <MoveFirstZone />
                  <LowStockZone />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
