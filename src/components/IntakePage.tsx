import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { FoodInPanel } from './FoodInPanel';
import { Button, Icon } from '../ui/primitives';

/** Intake = food IN. The polished Food In panel (pickup/delivery toggle,
 *  always-visible donor list, bespoke map detail) is the surface now — it
 *  supersedes the older flat IncomingDeliveries list. The two capture paths
 *  (announced delivery, walk-in) sit above it as the page's primary actions,
 *  so the panel itself sheds its own duplicate capture chrome (embedded). */
export function IntakePage() {
  const { deliveries, today } = useStore();
  const { openExpect, openIntake } = useUI();

  const receivedToday = deliveries.filter(
    (d) => d.status === 'received' && d.expectedDate === today,
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">Inbound</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Log what's coming when the donor calls; verify it at the dock when it
          arrives. Walk-ins are the exception — quick-add those directly.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={openExpect}>
          <Icon name="inbox" size={16} /> Record donation
        </Button>
        <Button size="lg" variant="ghost" onClick={openIntake}>
          <Icon name="plus" size={16} /> Add to Inventory
        </Button>
        {receivedToday > 0 && (
          <span className="ml-auto text-xs text-zinc-400">
            {receivedToday} received today
          </span>
        )}
      </div>

      {/* Full-width pixel-art hero — the building + delivery truck motif ties
          the page to the accent color. object-cover with a capped height
          trims the image's excess sky so the storefront reads prominently as
          a tight banner rather than a mostly-empty tall block. */}
      <div className="overflow-hidden rounded-xl ring-1 ring-zinc-200">
        <img
          src="/food-bank-hero.webp"
          alt="Illustration of the food bank with a delivery truck and volunteers out front"
          className="h-32 w-full object-cover object-[center_38%] sm:h-44"
        />
      </div>

      <FoodInPanel embedded />
    </div>
  );
}
