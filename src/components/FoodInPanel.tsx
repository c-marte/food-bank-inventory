import { useState, type ReactNode } from 'react';
import type { Delivery } from '../domain/types';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon } from '../ui/primitives';
import { DeliveryRow, PickupRow, TileHeader } from './FlowTileVisuals';
import { DonorDetailModal } from './DonorDetailModal';
import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * FOOD IN — two plain list cards side by side (Inbound deliveries, Scheduled
 * pickups), each row bespoke to its own type — same split as the "See more"
 * modal (PickupDetail vs. DeliveryDetail), just one level up. A delivery
 * shows its own arrival window + a stepper-toned progress bar; a pickup
 * shows a manifest summary + when it's expected (Ready / Tomorrow / a
 * date). The map, full stage, courier, manifest, and CTA still live in the
 * modal — this is glance-level triage only. Deliveries and pickups stay two
 * separate cards, never merged into one list: a delivery is the donor
 * coming to us, a pickup is one of ours driving out, and collapsing that
 * distinction into one undifferentiated row is exactly how a pickup that
 * needs OUR initiative gets missed.
 * ───────────────────────────────────────────────────────── */

/** Donor name, disambiguated with an index suffix only when the same name
 *  appears more than once in the list (rare, but two trips from one donor on
 *  the same day is real). */
function chipLabels(list: Delivery[]): string[] {
  const totals = new Map<string, number>();
  for (const d of list) totals.set(d.donorName, (totals.get(d.donorName) ?? 0) + 1);
  const seen = new Map<string, number>();
  return list.map((d) => {
    const total = totals.get(d.donorName)!;
    if (total <= 1) return d.donorName;
    const idx = (seen.get(d.donorName) ?? 0) + 1;
    seen.set(d.donorName, idx);
    return `${d.donorName} #${idx}`;
  });
}

function CardShell({
  icon,
  title,
  count,
  emptyText,
  isEmpty,
  children,
}: {
  icon: 'inbox' | 'truck';
  title: string;
  count: number;
  emptyText: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
        <Icon name={icon} size={13} />
        {title}
        <span className="nums text-zinc-400">· {count}</span>
      </div>
      <div className="mt-2 space-y-0.5">
        {isEmpty ? <p className="px-1.5 py-1.5 text-sm text-zinc-500">{emptyText}</p> : children}
      </div>
    </Card>
  );
}

export function FoodInPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { deliveries, team, today } = useStore();
  const { navigate, openReceive, openExpect, openIntake } = useUI();
  const [modalId, setModalId] = useState<string | null>(null);

  const member = (id?: string) => team.find((t) => t.id === id);

  // Two DIFFERENT things, never lumped. A delivery is the donor coming to us;
  // a pickup is one of ours driving out.
  const expected = deliveries.filter((d) => d.status === 'expected');
  const incomingDeliveries = expected
    .filter((d) => d.mode === 'they_come')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const ourPickups = expected
    .filter((d) => d.mode === 'we_go')
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const modalDelivery = expected.find((d) => d.id === modalId) ?? null;
  const deliveryLabels = chipLabels(incomingDeliveries);
  const pickupLabels = chipLabels(ourPickups);

  return (
    <div>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TileHeader icon="truck" label="Inbound" onClick={() => navigate('intake')} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openExpect}>
              <Icon name="plus" size={13} /> Expect a delivery
            </Button>
            <button
              onClick={openIntake}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700"
            >
              + Log a walk-in donation
            </button>
          </div>
        </div>
      )}

      <div className={cn(!embedded && 'mt-3', 'grid gap-4 sm:grid-cols-2')}>
        <CardShell
          icon="inbox"
          title="Inbound deliveries"
          count={incomingDeliveries.length}
          isEmpty={incomingDeliveries.length === 0}
          emptyText="No deliveries en route."
        >
          {incomingDeliveries.map((d, i) => (
            <DeliveryRow
              key={d.id}
              delivery={d}
              today={today}
              label={deliveryLabels[i]}
              onSeeMore={() => setModalId(d.id)}
            />
          ))}
        </CardShell>
        <CardShell
          icon="truck"
          title="Scheduled pickups"
          count={ourPickups.length}
          isEmpty={ourPickups.length === 0}
          emptyText="No pickups en route."
        >
          {ourPickups.map((d, i) => (
            <PickupRow
              key={d.id}
              delivery={d}
              today={today}
              label={pickupLabels[i]}
              onSeeMore={() => setModalId(d.id)}
            />
          ))}
        </CardShell>
      </div>

      <DonorDetailModal
        delivery={modalDelivery}
        today={today}
        assignee={member(modalDelivery?.assigneeId)}
        onClose={() => setModalId(null)}
        onReceive={(id) => {
          setModalId(null);
          openReceive(id);
        }}
      />
    </div>
  );
}
