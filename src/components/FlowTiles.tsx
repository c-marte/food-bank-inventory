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
 * Food In and Food Out MIRROR each other row for row — header, KPI, metadata,
 * visual anchor, footer — so the two cards read as one language and always
 * match height. Each row uses identical structure/typography on both sides;
 * only the content differs. Sections:
 *
 *   header    — a hoverable label that navigates to the full surface
 *   KPI       — 2 (Food In) or 3 (Food Out) equal-size number+label blocks
 *   metadata  — one fixed-height status line (+ optional cross-check items)
 *   visual    — flex-1, so it absorbs any leftover height and both tiles
 *               always end up the same overall height
 *   footer    — full-width primary action, centered secondary link
 * ───────────────────────────────────────────────────────── */

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

// Both metadata sections reserve enough room for the tallest case (the
// delivery tab's status line + cross-check items), so neither tile's
// metadata row ever changes height as content changes.
const METADATA_MIN_H = 'min-h-14';

type InTab = 'pickup' | 'delivery';

export function FlowTiles() {
  const { movements, deliveries, partners, team, today } = useStore();
  const { navigate, openReceive, openExpect, openIntake, openPickup } = useUI();
  const [inTab, setInTab] = useState<InTab>('pickup'); // we default to pickups

  const member = (id?: string) => team.find((t) => t.id === id);

  // --- Food in: two DIFFERENT things, never lumped. A delivery is the donor
  // coming to us; a pickup is one of ours driving out.
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

  /** Unique owners at a stage, for the visual's sub-label. */
  const stageOwners = (ms: typeof open) =>
    [...new Set(ms.map((m) => member(m.assigneeId)?.name.split(' ')[0]).filter(Boolean))].join(', ');

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      {/* FOOD IN */}
      <Card className="flex h-full flex-col p-4 sm:p-5">
        <TileHeader icon="truck" label="Food in" onClick={() => navigate('intake')} />

        {/* KPI row — 2 clickable tabs. */}
        <div className="mt-3 flex items-start gap-2">
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

        {/* Metadata — fixed height regardless of tab. */}
        <div className={cn('mt-2', METADATA_MIN_H)}>
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

        {/* Visual anchor — flex-1, absorbs the leftover height. */}
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

        {/* Footer — full-width primary, centered secondary. */}
        <div className="mt-4">
          {selectedIn ? (
            <Button className="w-full" onClick={() => openReceive(selectedIn.id)}>
              <Icon name="inbox" size={14} /> Receive
            </Button>
          ) : (
            <Button className="w-full" variant="outline" onClick={openExpect}>
              <Icon name="plus" size={14} /> Expect a delivery
            </Button>
          )}
        </div>
        <button
          onClick={openIntake}
          className="mt-2 w-full text-center text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          + Log a walk-in donation
        </button>
      </Card>

      {/* FOOD OUT */}
      <Card className="flex h-full flex-col p-4 sm:p-5">
        <TileHeader icon="arrow" label="Food out" onClick={() => navigate('distribution')} />

        {/* KPI row — 3 static blocks, same size/typography as Food In's tabs,
            always black (no urgency color on the large number). */}
        <div className="mt-3 flex items-start gap-2">
          <KpiBlock n={atPack.length} label="Pack" />
          <KpiBlock n={atMatch.length} label="Match" />
          <KpiBlock n={atHandoff.length} label="Handoff" />
        </div>

        {/* Metadata — same fixed height as Food In. */}
        <div className={cn('mt-2', METADATA_MIN_H)}>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-600">
            {nextOut && nextOutRecipient ? (
              <>
                <span>Next:</span>
                <span className="font-medium text-zinc-900">{nextOutRecipient.name}</span>
                <span>{nextOut.mode === 'we_go' ? '· we deliver' : '· picks up here'}</span>
                {nextOutDriver && <TeamBadge id={nextOutDriver.id} name={nextOutDriver.name} />}
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
        </div>

        {/* Visual anchor — the Pack→Match→Handoff connector, flex-1. */}
        <div className="mt-3 min-h-28 flex-1">
          <OutboundStatusBoard
            buckets={[
              { n: atPack.length, label: 'Pack', sub: stageOwners(atPack) || undefined, tone: 'normal' },
              {
                n: atMatch.length,
                label: 'Match',
                sub: atMatch.length > 0 ? 'call list' : undefined,
                tone: atMatch.length > 0 ? 'urgent' : 'normal',
              },
              { n: atHandoff.length, label: 'Handoff', sub: stageOwners(atHandoff) || undefined, tone: 'calm' },
            ]}
          />
        </div>

        {/* Footer — full-width primary, centered secondary. */}
        <div className="mt-4">
          <Button
            className="w-full"
            variant={open.length > 0 ? 'primary' : 'outline'}
            onClick={() => navigate('distribution')}
          >
            <Icon name="arrow" size={14} /> Work the pipeline
          </Button>
        </div>
        <button
          onClick={() => openPickup()}
          className="mt-2 w-full text-center text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          + Log a request
        </button>
      </Card>
    </div>
  );
}

/** The tile's title, now the click-through to its full surface (Intake /
 *  Distribution) — replaces the old separate "View intake/distribution" link. */
function TileHeader({
  icon,
  label,
  onClick,
}: {
  icon: 'truck' | 'arrow';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group eyebrow -m-1 flex items-center gap-1.5 self-start rounded-md p-1 text-[11px] font-bold text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
    >
      <Icon name={icon} size={13} />
      {label}
      <Icon
        name="chevron"
        size={11}
        className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
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
      <Count n={n} />
      <div className="text-xs text-zinc-500">{label}</div>
    </button>
  );
}

/** Food Out's KPI block — same box/typography as MetricTab, but static (not a
 *  tab) and always plain black: no urgency color on the large number. */
function KpiBlock({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1 rounded-lg px-2.5 py-1.5 text-left">
      <Count n={n} />
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
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

/** Every KPI number: same size everywhere, always plain black. Color is
 *  reserved for status elsewhere (tier marks, the Act-first headline) — not
 *  for a tile's hero count. */
function Count({ n }: { n: number }) {
  return (
    <span className="relative inline-flex h-9 min-w-[2rem] items-center justify-start">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.pop}
          className="nums text-2xl font-bold text-zinc-950"
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
