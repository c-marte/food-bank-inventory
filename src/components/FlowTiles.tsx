import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Delivery } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { getMovementStage } from '../domain/distribution';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon, TeamBadge, TierMark } from '../ui/primitives';
import { DeliveryOriginMap, OutboundStatusBoard } from './FlowTileVisuals';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * FLOW TILES — the home's two-tile summary.
 *
 * Food In and Food Out are the two operational verbs; each tile is a
 * self-contained glance. Food In's two metrics (Pickups / Deliveries) are
 * TABS — clicking one swaps the metadata + map below to that trip. Both
 * tiles are flex columns so their visual anchor (map / status board) grows
 * to fill whatever height the grid gives them, and the action row always
 * sits flush at the bottom — the two tiles' heights always match.
 * ───────────────────────────────────────────────────────── */

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

type InTab = 'pickup' | 'delivery';

export function FlowTiles() {
  const { movements, deliveries, partners, team, today } = useStore();
  const { navigate, openReceive, openExpect, openIntake, openPickup } = useUI();
  const [inTab, setInTab] = useState<InTab>('pickup'); // we default to pickups

  const member = (id?: string) => team.find((t) => t.id === id);
  const firstName = (id?: string) => member(id)?.name.split(' ')[0];

  // --- Food in: two DIFFERENT things, never lumped. A delivery is the donor
  // coming to us; a pickup is one of ours driving out. Same "expected" status,
  // opposite direction.
  const expected = deliveries.filter((d) => d.status === 'expected');
  const incomingDeliveries = expected
    .filter((d) => d.mode === 'they_come')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const ourPickups = expected
    .filter((d) => d.mode === 'we_go')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const selectedIn = inTab === 'pickup' ? ourPickups[0] : incomingDeliveries[0];

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
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      {/* FOOD IN */}
      <Card className="flex h-full flex-col p-4 sm:p-5">
        <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
          <Icon name="truck" size={13} /> Food in
        </div>

        {/* Two real metrics as TABS — clicking one swaps the metadata + map. */}
        <div className="mt-2 flex items-start gap-2">
          <MetricTab
            active={inTab === 'pickup'}
            n={ourPickups.length}
            label={ourPickups.length === 1 ? 'pickup (we go)' : 'pickups (we go)'}
            onClick={() => setInTab('pickup')}
          />
          <MetricTab
            active={inTab === 'delivery'}
            n={incomingDeliveries.length}
            label={incomingDeliveries.length === 1 ? 'delivery' : 'deliveries'}
            onClick={() => setInTab('delivery')}
          />
        </div>

        <div className="mt-2 min-h-[2.75rem]">
          {selectedIn ? (
            inTab === 'pickup' ? (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
                <span className="font-medium text-zinc-900">{selectedIn.donorName}</span>
                <span>is ready for pickup</span>
                {(() => {
                  const assignee = member(selectedIn.assigneeId);
                  return assignee ? <TeamBadge id={assignee.id} name={assignee.name} /> : null;
                })()}
                {selectedIn.note && <span className="text-zinc-400">· {selectedIn.note}</span>}
              </p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-900">{selectedIn.donorName}</span>
                  <span>
                    delivering{' '}
                    <span className="font-medium text-zinc-700">
                      {selectedIn.note ?? timingLabel(daysUntil(selectedIn.expectedDate, today))}
                    </span>
                  </span>
                  {/* No avatar here — anyone can receive a delivery. */}
                </p>
                <CrossCheckItems delivery={selectedIn} />
              </>
            )
          ) : (
            <p className="text-sm text-zinc-500">
              {inTab === 'pickup' ? 'No pickups en route.' : 'No deliveries en route.'}
            </p>
          )}
        </div>

        <div className="mt-3 min-h-28 flex-1">
          {selectedIn ? (
            <DeliveryOriginMap
              donorName={selectedIn.donorName}
              outbound={inTab === 'pickup'}
              timing={
                selectedIn.note ?? timingLabel(daysUntil(selectedIn.expectedDate, today))
              }
            />
          ) : (
            <div className="flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400">
              {inTab === 'pickup' ? 'No pickup en route' : 'No donor en route'}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedIn ? (
            <Button size="sm" onClick={() => openReceive(selectedIn.id)}>
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
      <Card className="flex h-full flex-col p-4 sm:p-5">
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

        <div className="mt-3 min-h-28 flex-1">
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

/** One of Food In's two clickable metrics. Active = the tab driving the
 *  metadata + map below; inactive invites the click (hover affordance). */
function MetricTab({
  active,
  n,
  label,
  onClick,
}: {
  active: boolean;
  n: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 rounded-lg px-2.5 py-1.5 text-left transition-colors',
        active
          ? 'bg-zinc-50 ring-1 ring-zinc-950'
          : 'opacity-50 hover:bg-zinc-50 hover:opacity-100',
      )}
    >
      <Count n={n} size="text-2xl" />
      <div className="text-xs text-zinc-500">{label}</div>
    </button>
  );
}

/** The delivery's manifest, so the receiver can cross-check what arrives
 *  against what was promised. */
function CrossCheckItems({ delivery }: { delivery: Delivery }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
      {delivery.items.map((it, i) => (
        <span key={it.id} className="nums inline-flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">·</span>}
          <TierMark tier={it.tier} size={11} />
          {it.quantity} {it.name}
        </span>
      ))}
    </div>
  );
}

function Count({
  n,
  tone = 'normal',
  size = 'text-3xl',
}: {
  n: number;
  tone?: 'normal' | 'urgent';
  size?: string;
}) {
  return (
    <span className="relative inline-flex h-9 min-w-[2rem] items-center justify-start">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.pop}
          className={cn(
            'nums font-bold',
            size,
            tone === 'urgent' && n > 0 ? 'text-red-600' : 'text-zinc-950',
          )}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
