import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Icon } from '../ui/primitives';
import { SPRING } from '../ui/motion';

/** The single "Reminder queued: ..." line rendered after a confirm. Not a feed;
 *  not real email/SMS — it proves the notification concept and nothing more.
 *  Springs in on confirm; collapses out on dismiss or when superseded. */
export function ReminderLine() {
  const { lastReminder, dismissReminder } = useStore();

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {lastReminder && (
        <motion.div
          key={lastReminder}
          layout
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: -16 }}
          transition={SPRING.pop}
          style={{ overflow: 'hidden' }}
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg bg-zinc-950 px-4 py-3 text-white"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
            <Icon name="check" size={13} />
          </span>
          <p className="flex-1 text-sm font-medium leading-snug">{lastReminder}</p>
          <button
            onClick={dismissReminder}
            aria-label="Dismiss reminder"
            className="-m-1 shrink-0 rounded p-1 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Icon name="x" size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
