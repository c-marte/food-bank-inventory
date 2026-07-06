import { AnimatePresence, motion } from 'motion/react';
import { daysUntil } from '../domain/dates';
import { getDyingLots } from '../domain/distribution';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon, TierChip } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * FLOW TILES — the home's two-tile summary.
 *
 * Food In and Food Out are the two operational verbs; each tile is a
 * self-contained glance (hero number, one status line, a primary action) that
 * taps through to its full surface. Quick-add actions live in each tile's
 * footer, so there's no separate top-level action row duplicating them.
 * ───────────────────────────────────────────────────────── */

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

export function FlowTiles() {
  const { lots, requests, deliveries, today, config } = useStore();
  const { navigate, openReceive, openExpect, openIntake, openPickup } = useUI();

  const expected = [...deliveries]
    .filter((d) => d.status === 'expected')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const nextIn = expected[0];

  const dying = getDyingLots(lots, today, config);
  const pendingRequests = requests.filter((r) => r.status === 'requested');
  const outCount = dying.length + pendingRequests.length;
  const nextOut = dying[0];

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {/* FOOD IN */}
      <Card className="p-4 sm:p-5">
        <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
          <Icon name="truck" size={13} /> Food in
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <Count n={expected.length} />
          <span className="text-sm text-zinc-500">
            {expected.length === 1 ? 'delivery expected' : 'deliveries expected'}
          </span>
        </div>

        <p className="mt-1 min-h-[1.25rem] text-sm text-zinc-600">
          {nextIn ? (
            <>
              <span className="font-medium text-zinc-900">{nextIn.donorName}</span>
              {' · '}
              {nextIn.note ?? timingLabel(daysUntil(nextIn.expectedDate, today))}
            </>
          ) : (
            'Nothing on its way right now.'
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {nextIn ? (
            <Button size="sm" onClick={() => openReceive(nextIn.id)}>
              <Icon name="inbox" size={14} /> Receive
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={openExpect}>
              <Icon name="plus" size={14} /> Expect a delivery
            </Button>
          )}
          <button
            onClick={() => navigate('intake')}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            View intake <Icon name="chevron" size={12} />
          </button>
        </div>

        <button
          onClick={openIntake}
          className="mt-2 text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          + Log a walk-in donation
        </button>
      </Card>

      {/* FOOD OUT */}
      <Card className="p-4 sm:p-5">
        <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
          <Icon name="arrow" size={13} /> Food out
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <Count n={outCount} tone={dying.length > 0 ? 'urgent' : 'normal'} />
          <span className="text-sm text-zinc-500">
            {outCount === 1 ? 'needs to move' : 'need to move'}
          </span>
        </div>

        <p className="mt-1 min-h-[1.25rem] text-sm text-zinc-600">
          {nextOut ? (
            <span className="inline-flex items-center gap-1.5">
              <TierChip tier={nextOut.tier} size={18} />
              <span className="font-medium text-zinc-900">{nextOut.name}</span>
              {' '}
              <span className="font-medium text-amber-700">
                {timingLabel(daysUntil(nextOut.expiryDate, today))}
              </span>
            </span>
          ) : pendingRequests.length > 0 ? (
            `${pendingRequests.length} partner ${pendingRequests.length === 1 ? 'order' : 'orders'} waiting`
          ) : (
            'Nothing urgent to send.'
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={outCount > 0 ? 'primary' : 'outline'}
            onClick={() => navigate('distribution')}
          >
            <Icon name="arrow" size={14} /> Distribute
          </Button>
          <button
            onClick={() => navigate('distribution')}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            View distribution <Icon name="chevron" size={12} />
          </button>
        </div>

        <button
          onClick={() => openPickup()}
          className="mt-2 text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          + Log a partner request
        </button>
      </Card>
    </div>
  );
}

function Count({ n, tone = 'normal' }: { n: number; tone?: 'normal' | 'urgent' }) {
  return (
    <span className="relative inline-flex h-9 min-w-[2rem] items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.pop}
          className={cn(
            'nums text-3xl font-bold',
            tone === 'urgent' && n > 0 ? 'text-red-600' : 'text-zinc-950',
          )}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
