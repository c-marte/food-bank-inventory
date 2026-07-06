import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDays, yearStartDate } from '../domain/dates';
import { getImpactStats } from '../domain/impact';
import { useStore } from '../store/useStore';
import { Card, Icon } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * IMPACT — a quiet, retrospective strip at the very bottom of the Shelf page.
 *
 * Deliberately last: this is morale content, not actionable content, so it
 * never competes with Act First or the Food In/Out tiles for attention (the
 * same reasoning that demoted the decay timeline behind "View the full
 * shelf"). Modeled on Lemonade Giveback's quiet "one honest number + one
 * plain sentence" card — no chart, no goal ring, nothing that implies a
 * target we don't have.
 *
 * Every figure is a real count from records that exist elsewhere in the app.
 * Deliberately absent: a "pounds redistributed" total — lots carry mixed
 * units (cans, gallons, loaves), so summing them would fabricate a number,
 * the same reasoning that ruled out a live GPS map and a fake 4-stage
 * fulfillment stepper earlier in this build.
 * ───────────────────────────────────────────────────────── */

type Window = '30d' | 'ytd';

export function ImpactSection() {
  const { lots, deliveries, movements, partners, wasteEvents, today } = useStore();
  const [win, setWin] = useState<Window>('30d');

  const since = win === '30d' ? addDays(today, -30) : yearStartDate(today);
  const stats = getImpactStats(
    lots,
    deliveries,
    movements,
    partners,
    wasteEvents,
    today,
    since,
  );

  const totalMoved = stats.sentToShelters + stats.familyBoxesPacked;
  const windowLabel = win === '30d' ? 'in the last 30 days' : 'so far this year';

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
          <Icon name="check" size={13} className="text-emerald-600" /> Your impact
        </div>
        <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5">
          {(['30d', 'ytd'] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                win === w
                  ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5'
                  : 'text-zinc-500 hover:text-zinc-800',
              )}
            >
              {w === '30d' ? '30 days' : 'YTD'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={win}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={SPRING.pop}
        >
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat n={stats.donationsLogged} label="donations logged" />
            <Stat n={stats.sentToShelters} label="sent to shelters" />
            <Stat n={stats.familyBoxesPacked} label="family boxes packed" />
            <Stat n={stats.donorsCount} label="donors who gave" />
          </div>

          <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
            {totalMoved === 0 && stats.donationsLogged === 0 ? (
              `No recorded activity ${windowLabel} yet — it'll show up here as it happens.`
            ) : stats.diversionRatePct !== null ? (
              <>
                <span className="font-semibold text-emerald-700">
                  {stats.diversionRatePct}%
                </span>{' '}
                of donated food reached someone, not the trash, {windowLabel}.
              </>
            ) : (
              `${totalMoved} ${totalMoved === 1 ? 'delivery has' : 'deliveries have'} gone out to neighbors and partners ${windowLabel}.`
            )}
          </p>
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="nums text-2xl font-bold text-zinc-950">{n}</div>
      <div className="mt-0.5 text-xs leading-tight text-zinc-500">{label}</div>
    </div>
  );
}
