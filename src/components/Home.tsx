import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { getLotStatus } from '../domain/status';
import { TriageBar } from './TriageBar';
import { DecayTimeline } from './DecayTimeline';
import { MoveFirstZone } from './MoveFirstZone';
import { LowStockZone } from './LowStockZone';
import { Button, Card, Icon } from '../ui/primitives';
import { cn } from '../ui/cn';

/** Shelf = the standing picture + entry points (the Mercury pattern). The clock
 *  lives here; Intake, Distribution, and Inventory are one tap away; mutations
 *  are sheets launched from the action row or from any lot. */
export function Home() {
  const { lots, requests, deliveries, wasteEvents, today, config } = useStore();
  const { navigate, openIntake, openPickup, openExpect } = useUI();

  const pending = requests.filter((r) => r.status === 'requested').length;
  const incoming = deliveries.filter((d) => d.status === 'expected').length;
  const stocked = lots.filter((l) => l.quantity > 0);
  const expiredToPull = stocked.filter(
    (l) => getLotStatus(l, today, config) === 'expired',
  ).length;
  const wastedToday = wasteEvents
    .filter((w) => w.date === today)
    .reduce((s, w) => s + w.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Action row — the two verbs. Walk-in is the exception, demoted to ghost. */}
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

      {/* Focusing layer: what do I touch first? */}
      <TriageBar />

      {/* The clock, two readings: shape of the week + ordered action queue. */}
      <DecayTimeline />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <MoveFirstZone />
        <LowStockZone />
      </div>

      {/* Jumping-off points: the two verbs + the ledger. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Intake"
          onClick={() => navigate('intake')}
          stat={
            <>
              <b className={cn('nums text-2xl font-bold', incoming > 0 ? 'text-zinc-950' : 'text-zinc-400')}>
                {incoming}
              </b>{' '}
              incoming
            </>
          }
          sub="Deliveries on their way in."
        />
        <SummaryCard
          title="Distribution"
          onClick={() => navigate('distribution')}
          stat={
            <>
              <b className={cn('nums text-2xl font-bold', pending > 0 ? 'text-zinc-950' : 'text-zinc-400')}>
                {pending}
              </b>{' '}
              to release
            </>
          }
          sub="Partner requests to fulfill."
        />
        <SummaryCard
          title="Inventory"
          onClick={() => navigate('inventory')}
          stat={
            <>
              <b className="nums text-2xl font-bold text-zinc-950">
                {stocked.length}
              </b>{' '}
              on hand
            </>
          }
          sub={
            expiredToPull > 0 ? (
              <span className="font-semibold text-red-700">
                {expiredToPull} expired to pull
              </span>
            ) : wastedToday > 0 ? (
              `${wastedToday} units wasted today`
            ) : (
              'Every lot on the shelf.'
            )
          }
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  stat,
  sub,
  onClick,
}: {
  title: string;
  stat: React.ReactNode;
  sub: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card className="p-0">
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-xs font-bold text-zinc-950">{title}</div>
          <div className="mt-1.5 text-sm text-zinc-600">{stat}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <Icon name="chevron" size={16} />
        </span>
      </button>
    </Card>
  );
}
