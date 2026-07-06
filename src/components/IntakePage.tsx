import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { IncomingDeliveries } from './IncomingDeliveries';
import { Button, Card, EmptyCard, Icon } from '../ui/primitives';

/** Intake = food IN. The two capture paths (announced delivery, walk-in) and
 *  the queue of promises waiting to be received at the dock. */
export function IntakePage() {
  const { deliveries, today } = useStore();
  const { openExpect, openIntake } = useUI();

  const expected = deliveries.filter((d) => d.status === 'expected');
  const receivedToday = deliveries.filter(
    (d) => d.status === 'received' && d.expectedDate === today,
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">Intake</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Log what's coming when the donor calls; verify it at the dock when it
          arrives. Walk-ins are the exception — quick-add those directly.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={openExpect}>
          <Icon name="inbox" size={16} /> Expect a delivery
        </Button>
        <Button size="lg" variant="ghost" onClick={openIntake}>
          <Icon name="plus" size={16} /> Walk-in
        </Button>
        {receivedToday > 0 && (
          <span className="ml-auto text-xs text-zinc-400">
            {receivedToday} received today
          </span>
        )}
      </div>

      {expected.length > 0 ? (
        <IncomingDeliveries />
      ) : (
        <Card className="p-4 sm:p-5">
          <EmptyCard icon={<Icon name="truck" size={16} className="text-zinc-400" />}>
            Nothing on its way. Log a delivery when a donor calls.
          </EmptyCard>
        </Card>
      )}
    </div>
  );
}
