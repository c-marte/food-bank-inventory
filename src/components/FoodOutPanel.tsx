import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { getMovementStage } from '../domain/distribution';
import { Button, Card, Icon, TeamBadge } from '../ui/primitives';
import {
  KpiBlock,
  METADATA_MIN_H,
  OutboundStatusBoard,
  TileHeader,
} from './FlowTileVisuals';
import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * FOOD OUT — the outbound pipeline (Pack → Match → Handoff). Used to sit
 * beside Food In as a mirrored tile; now pairs with the "Inventory soon to
 * expire" panel instead, since Food In moved to its own full-width row with
 * a real map. Content is unchanged — same KPI blocks, same status board.
 * ───────────────────────────────────────────────────────── */

export function FoodOutPanel() {
  const { movements, partners, team } = useStore();
  const { navigate, openPickup } = useUI();

  const member = (id?: string) => team.find((t) => t.id === id);

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
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <TileHeader icon="arrow" label="Food out" onClick={() => navigate('distribution')} />

      {/* KPI row — 3 static blocks, always black (no urgency color on the
          large number). */}
      <div className="mt-3 flex items-start gap-2">
        <KpiBlock n={atPack.length} label="Pack" />
        <KpiBlock n={atMatch.length} label="Match" />
        <KpiBlock n={atHandoff.length} label="Handoff" />
      </div>

      <div className={cn('mt-2 overflow-hidden', METADATA_MIN_H)}>
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
  );
}
