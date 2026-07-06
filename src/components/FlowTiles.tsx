import { AnimatePresence, motion } from 'motion/react';
import { daysUntil } from '../domain/dates';
import { getMovementStage } from '../domain/distribution';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon, TeamBadge } from '../ui/primitives';
import { DeliveryOriginMap, OutboundStatusBoard } from './FlowTileVisuals';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * FLOW TILES — the home's two-tile summary.
 *
 * Food In and Food Out are the two operational verbs; each tile is a
 * self-contained glance (hero number, one status line naming WHO, a visual
 * anchor, a primary action). The Out tile mirrors the pipeline: Pack → Match
 * → Handoff, with the owner named at each stage.
 * ───────────────────────────────────────────────────────── */

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

export function FlowTiles() {
  const { movements, deliveries, partners, team, today } = useStore();
  const { navigate, openReceive, openExpect, openIntake, openPickup } = useUI();

  const member = (id?: string) => team.find((t) => t.id === id);
  const firstName = (id?: string) => member(id)?.name.split(' ')[0];

  // --- Food in: two DIFFERENT things, never lumped. A delivery is the donor
  // coming to us; a pickup is one of ours driving out. Same "expected" status,
  // opposite direction — the hero counts must stay split or "2 expected" lies
  // about what's actually about to happen.
  const expected = deliveries.filter((d) => d.status === 'expected');
  const incomingDeliveries = expected
    .filter((d) => d.mode === 'they_come')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const ourPickups = expected
    .filter((d) => d.mode === 'we_go')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  // The single soonest item overall drives the status line + map below.
  const nextIn = [...expected].sort((a, b) =>
    a.expectedDate.localeCompare(b.expectedDate),
  )[0];

  // --- Food out: the pipeline ---
  const open = movements.filter((m) => m.status === 'open');
  const atPack = open.filter((m) => getMovementStage(m) === 'pack');
  const atMatch = open.filter((m) => getMovementStage(m) === 'match');
  const atHandoff = open.filter((m) => getMovementStage(m) === 'handoff');

  const nextOut = atHandoff[0];
  const nextOutRecipient = partners.find((p) => p.id === nextOut?.recipientId);
  const nextOutDriver = member(nextOut?.assigneeId);

  /** Unique owners at a stage, for the status-board sub-label — first names
   *  only there (space-constrained); full TeamBadge appears on the "Next" line. */
  const stageOwners = (ms: typeof open) =>
    [...new Set(ms.map((m) => firstName(m.assigneeId)).filter(Boolean))].join(', ');

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {/* FOOD IN */}
      <Card className="p-4 sm:p-5">
        <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
          <Icon name="truck" size={13} /> Food in
        </div>

        {/* Two real metrics, side by side — never one merged count. */}
        <div className="mt-2 flex items-start gap-6">
          <div>
            <Count n={incomingDeliveries.length} />
            <div className="text-xs text-zinc-500">
              {incomingDeliveries.length === 1 ? 'delivery' : 'deliveries'}
            </div>
          </div>
          <div>
            <Count n={ourPickups.length} />
            <div className="text-xs text-zinc-500">
              {ourPickups.length === 1 ? 'pickup' : 'pickups'} (we go)
            </div>
          </div>
        </div>

        <p className="mt-2 flex min-h-[1.5rem] flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
          {nextIn ? (
            <>
              <span className="font-medium text-zinc-900">{nextIn.donorName}</span>
              <span>{nextIn.mode === 'we_go' ? 'is ready for pickup' : 'is dropping off'}</span>
              {(() => {
                const assignee = member(nextIn.assigneeId);
                return assignee ? <TeamBadge id={assignee.id} name={assignee.name} /> : null;
              })()}
              {nextIn.note && <span className="text-zinc-400">· {nextIn.note}</span>}
            </>
          ) : (
            'Nothing on its way right now.'
          )}
        </p>

        <div className="mt-3">
          {nextIn ? (
            <DeliveryOriginMap
              donorName={nextIn.donorName}
              // we_go: our trip out to the donor; they_come: the donor heads to us
              outbound={nextIn.mode === 'we_go'}
              timing={
                nextIn.note ?? timingLabel(daysUntil(nextIn.expectedDate, today))
              }
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400">
              No donor en route
            </div>
          )}
        </div>

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
          <Count n={open.length} tone={atHandoff.length > 0 ? 'urgent' : 'normal'} />
          <span className="text-sm text-zinc-500">
            {open.length === 1 ? 'movement in the pipeline' : 'movements in the pipeline'}
          </span>
        </div>

        <p className="mt-1 flex min-h-[1.25rem] flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
          {nextOut && nextOutRecipient ? (
            <>
              <span>Next:</span>
              <span className="font-medium text-zinc-900">
                {nextOutRecipient.name}
              </span>
              <span>{nextOut.mode === 'we_go' ? '· we deliver' : '· picks up here'}</span>
              {nextOutDriver && (
                <TeamBadge id={nextOutDriver.id} name={nextOutDriver.name} />
              )}
              {nextOut.note && <span className="text-zinc-400">· {nextOut.note}</span>}
            </>
          ) : atMatch.length > 0 ? (
            `${atMatch.length} packed ${atMatch.length === 1 ? 'box needs' : 'boxes need'} a taker — call the list`
          ) : atPack.length > 0 ? (
            'Orders waiting to be packed.'
          ) : (
            'Pipeline is clear.'
          )}
        </p>

        <div className="mt-3">
          <OutboundStatusBoard
            buckets={[
              {
                n: atPack.length,
                label: 'Pack',
                sub: stageOwners(atPack) || undefined,
                tone: 'normal',
              },
              {
                n: atMatch.length,
                label: 'Match',
                sub: atMatch.length > 0 ? 'call list' : undefined,
                tone: atMatch.length > 0 ? 'urgent' : 'normal',
              },
              {
                n: atHandoff.length,
                label: 'Handoff',
                sub: stageOwners(atHandoff) || undefined,
                tone: 'calm',
              },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={open.length > 0 ? 'primary' : 'outline'}
            onClick={() => navigate('distribution')}
          >
            <Icon name="arrow" size={14} /> Work the pipeline
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
          + Log a request
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
