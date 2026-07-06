import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  InventoryLot,
  OutboundMovement,
  Partner,
  TeamMember,
  TransportMode,
} from '../domain/types';
import { daysUntil } from '../domain/dates';
import {
  buildFefoBox,
  getDyingLots,
  getMovementStage,
  type MovementStage,
} from '../domain/distribution';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import {
  Button,
  Card,
  EmptyCard,
  Icon,
  SectionHeader,
  TeamAvatar,
  TierMark,
} from '../ui/primitives';
import { shortDayLabel } from '../ui/format';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/**
 * Distribution — the outbound PIPELINE. Movements flow ① Pack → ② Match →
 * ③ Handoff; stage is derived from what's missing. Doors in: a partner/family
 * request (born matched), a decay push from the dying list (born unmatched),
 * the FEFO box builder (born packed). Completing a handoff is the commit
 * point (rule 2): lots decrement, clamped, shortfall named.
 */
export function DistributionPage() {
  const { lots, partners, team, movements, today, config, addMovement } = useStore();
  const { openPickup } = useUI();

  const open = movements.filter((m) => m.status === 'open');
  const byStage = (stage: MovementStage) =>
    open.filter((m) => getMovementStage(m) === stage);
  const releasedToday = movements.filter(
    (m) => m.status === 'released' && m.releasedDate === today,
  );

  // The decay door: dying lots not already on an open movement.
  const claimed = new Set(open.flatMap((m) => m.lines.map((l) => l.lotId)));
  const dying = getDyingLots(lots, today, config).filter((l) => !claimed.has(l.id));
  const box = buildFefoBox(
    lots.filter((l) => !claimed.has(l.id)),
    today,
    config,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Distribution
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Food out is a pipeline: pack it, match it to a taker, hand it off.
          The shelf only decrements at the handoff.
        </p>
      </div>

      {/* The pipeline — one column per stage, movements as cards. */}
      <div className="grid items-start gap-4 md:grid-cols-3">
        <StageColumn
          title="① Pack"
          hint="box it / stage it cold"
          movements={byStage('pack')}
          lots={lots}
          partners={partners}
          team={team}
        />
        <StageColumn
          title="② Match"
          hint="find a taker — call the list"
          movements={byStage('match')}
          lots={lots}
          partners={partners}
          team={team}
        />
        <StageColumn
          title="③ Handoff"
          hint="they pick up, or we deliver"
          movements={byStage('handoff')}
          lots={lots}
          partners={partners}
          team={team}
        />
      </div>

      {/* Doors into the pipeline. */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionHeader
            right={
              dying.length > 0 ? (
                <span className="nums rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  {dying.length}
                </span>
              ) : null
            }
          >
            Dying — start a movement
          </SectionHeader>
          {dying.length === 0 ? (
            <div className="mt-3">
              <EmptyCard icon={<Icon name="check" size={16} className="text-emerald-600" />}>
                Everything at risk is already in the pipeline.
              </EmptyCard>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {dying.map((l) => {
                const d = daysUntil(l.expiryDate, today);
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <TierMark tier={l.tier} size={14} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-950">
                        {l.name}
                      </div>
                      <div className="nums text-xs text-zinc-500">
                        {l.quantity} {l.unit} ·{' '}
                        <span className={cn('font-semibold', d <= 1 ? 'text-red-700' : 'text-amber-700')}>
                          {shortDayLabel(d)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        addMovement({
                          lines: [{ lotId: l.id, quantity: l.quantity }],
                          packed: false,
                          note: `dying ${d <= 0 ? 'today' : shortDayLabel(d)}`,
                        })
                      }
                    >
                      <Icon name="plus" size={13} /> Pipeline
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionHeader
            right={
              <Button size="sm" variant="outline" onClick={() => openPickup()}>
                <Icon name="plus" size={13} /> Log a request
              </Button>
            }
          >
            Family box (FEFO)
          </SectionHeader>
          {box.length === 0 ? (
            <div className="mt-3">
              <EmptyCard>No groceries free to box right now.</EmptyCard>
            </div>
          ) : (
            <>
              <p className="mb-2 mt-2 text-xs text-zinc-500">
                Auto-filled, soonest-expiring first. Starts a packed movement —
                match it to a family, then hand off.
              </p>
              <ul className="flex flex-wrap gap-2">
                {box.map((item) => {
                  const l = lots.find((x) => x.id === item.lotId);
                  return l ? (
                    <li
                      key={item.lotId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-2 pr-3 text-sm"
                    >
                      <TierMark tier={l.tier} size={13} />
                      <span className="font-medium text-zinc-800">{l.name}</span>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <Button
                  size="sm"
                  onClick={() =>
                    addMovement({ lines: box, packed: true, note: 'FEFO family box' })
                  }
                >
                  <Icon name="box" size={14} /> Start box
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Released today — the loop closed, receding. */}
      {releasedToday.length > 0 && (
        <Card className="p-4 sm:p-5">
          <SectionHeader>Released today</SectionHeader>
          <ul className="mt-2 space-y-1">
            {releasedToday.map((m) => {
              const r = partners.find((p) => p.id === m.recipientId);
              const shipped = m.lines.filter((l) => (l.released ?? 0) > 0).length;
              return (
                <li key={m.id} className="flex items-center gap-2 text-[13px] text-zinc-400">
                  <Icon name="check" size={13} className="text-emerald-500" />
                  <span className="line-through decoration-zinc-300">
                    {shipped} item{shipped === 1 ? '' : 's'} →{' '}
                    {r?.name ?? 'recipient'}
                    {m.mode === 'we_go' ? ' (delivered)' : ' (picked up)'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StageColumn({
  title,
  hint,
  movements,
  lots,
  partners,
  team,
}: {
  title: string;
  hint: string;
  movements: OutboundMovement[];
  lots: InventoryLot[];
  partners: Partner[];
  team: TeamMember[];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow text-xs font-bold text-zinc-950">{title}</h2>
        <span className="text-[11px] text-zinc-400">{hint}</span>
      </div>
      {movements.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-400">
          Nothing here
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          <AnimatePresence initial={false}>
            {movements.map((m) => (
              <MovementCard
                key={m.id}
                movement={m}
                lots={lots}
                partners={partners}
                team={team}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function MovementCard({
  movement: m,
  lots,
  partners,
  team,
}: {
  movement: OutboundMovement;
  lots: InventoryLot[];
  partners: Partner[];
  team: TeamMember[];
}) {
  const { patchMovement, completeHandoff } = useStore();
  const [matching, setMatching] = useState(false);
  const stage = getMovementStage(m);
  const recipient = partners.find((p) => p.id === m.recipientId);
  const assignee = team.find((t) => t.id === m.assigneeId);

  // Tier-aware routing: prepared food only fits meal programs.
  const hasPrepared = m.lines.some(
    (line) => lots.find((l) => l.id === line.lotId)?.tier === 'prepared',
  );
  const candidates = hasPrepared
    ? partners.filter((p) => p.kind === 'meal_program')
    : partners;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={SPRING.reflow}
      className="rounded-lg border border-zinc-300 p-3"
    >
      {/* Lines */}
      <ul className="space-y-0.5">
        {m.lines.map((line) => {
          const l = lots.find((x) => x.id === line.lotId);
          const short = l ? line.quantity > l.quantity : true;
          return (
            <li key={line.lotId} className="nums flex items-center gap-1.5 text-[13px] text-zinc-800">
              {l && <TierMark tier={l.tier} size={12} />}
              <span className="min-w-0 truncate">
                {line.quantity} {l?.name ?? 'unknown lot'}
              </span>
              {short && (
                <span className="text-[11px] font-semibold text-red-700">
                  ({l?.quantity ?? 0} on hand)
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Who + how */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {recipient ? (
          <span className="font-semibold text-zinc-800">→ {recipient.name}</span>
        ) : (
          <span className="font-semibold text-amber-700">no taker yet</span>
        )}
        {m.mode && (
          <span className="eyebrow rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500">
            {m.mode === 'we_go' ? 'WE DELIVER' : 'PICKS UP HERE'}
          </span>
        )}
        {assignee && (
          <span className="inline-flex items-center gap-1">
            <TeamAvatar id={assignee.id} name={assignee.name} size={16} />
            {assignee.name.split(' ')[0]}
          </span>
        )}
        {m.note && <span className="text-zinc-400">· {m.note}</span>}
      </div>

      {/* The stage's one verb */}
      <div className="mt-2.5 border-t border-zinc-100 pt-2.5">
        {stage === 'pack' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => patchMovement(m.id, { packed: true })}>
              <Icon name="box" size={13} /> Mark packed
            </Button>
            <AssigneePicker
              team={team}
              current={m.assigneeId}
              onPick={(id) => patchMovement(m.id, { assigneeId: id })}
            />
          </div>
        )}

        {stage === 'match' &&
          (!matching ? (
            <Button size="sm" onClick={() => setMatching(true)}>
              <Icon name="arrow" size={13} /> Choose recipient
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setMatching(false);
                    patchMovement(m.id, {
                      recipientId: p.id,
                      // Default the trip direction by recipient kind:
                      // shelters/kitchens get deliveries; families pick up here.
                      mode: p.kind === 'meal_program' ? 'we_go' : 'they_come',
                    });
                  }}
                  className="h-8 rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
                >
                  {p.name}
                  <span className="ml-1 text-[9px] opacity-60">
                    {p.kind === 'meal_program' ? 'kitchen' : 'family'}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setMatching(false)}
                aria-label="Cancel"
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-900"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}

        {stage === 'handoff' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => completeHandoff(m.id)}>
              <Icon name="check" size={13} />
              {m.mode === 'we_go' ? 'Mark delivered' : 'Complete pickup'}
            </Button>
            <ModeToggle
              mode={m.mode ?? 'they_come'}
              onChange={(mode) => patchMovement(m.id, { mode })}
            />
            <AssigneePicker
              team={team}
              current={m.assigneeId}
              onPick={(id) => patchMovement(m.id, { assigneeId: id })}
            />
          </div>
        )}
      </div>
    </motion.li>
  );
}

/** Compact who-owns-this picker: tap a name, or the current one to clear. */
function AssigneePicker({
  team,
  current,
  onPick,
}: {
  team: TeamMember[];
  current?: string;
  onPick: (id?: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {team.map((t) => {
        const active = t.id === current;
        const first = t.name.split(' ')[0];
        return (
          <button
            key={t.id}
            onClick={() => onPick(active ? undefined : t.id)}
            title={active ? `${t.name} owns this — tap to clear` : `Assign ${t.name}`}
            className={cn(
              'flex h-7 items-center gap-1 rounded-full border pl-1 pr-2 text-[11px] font-medium transition-colors',
              active
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 text-zinc-500 hover:border-zinc-400',
            )}
          >
            <TeamAvatar id={t.id} name={t.name} size={16} />
            {first}
          </button>
        );
      })}
    </span>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: TransportMode;
  onChange: (mode: TransportMode) => void;
}) {
  return (
    <span className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
      {(
        [
          ['they_come', 'Picks up'],
          ['we_go', 'We deliver'],
        ] as [TransportMode, string][]
      ).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'h-7 rounded-md px-2 text-[11px] font-medium transition-colors',
            mode === value
              ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5'
              : 'text-zinc-400 hover:text-zinc-700',
          )}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
