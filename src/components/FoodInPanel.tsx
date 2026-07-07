import { useState } from 'react';
import type { Delivery, PerishTier } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon } from '../ui/primitives';
import { TIER_META } from '../ui/format';
import { DonorListRow, TileHeader, TypeTab } from './FlowTileVisuals';
import { PickupDetail } from './PickupDetail';
import { DeliveryDetail } from './DeliveryDetail';

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

/** A delivery has many items, possibly mixed tiers — show the single MOST
 *  urgent handling class present (prepared > fresh > shelf_stable, the same
 *  priority TIER_META already encodes), so the chip's icon means something
 *  real rather than an arbitrary default. */
function mostUrgentTier(delivery: Delivery): PerishTier {
  let best: PerishTier = 'shelf_stable';
  let bestOrder = TIER_META.shelf_stable.order;
  for (const item of delivery.items) {
    const order = TIER_META[item.tier].order;
    if (order < bestOrder) {
      best = item.tier;
      bestOrder = order;
    }
  }
  return best;
}

/* ─────────────────────────────────────────────────────────
 * FOOD IN — the left column is now a pure nav rail: a [Pickups · n]
 * [Deliveries · n] toggle over an always-visible donor list (no hero-count
 * KPIs, no chips that vanish when there's only one item), then a tertiary
 * link out to the full Intake page. The right column is the bespoke detail
 * for whichever type is active — PickupDetail and DeliveryDetail are
 * deliberately separate components, not one template branching internally,
 * because a pickup (awaiting our initiative) and a delivery (an inbound
 * journey with real stages) are different enough jobs to earn different UI.
 * ───────────────────────────────────────────────────────── */

type InTab = 'pickup' | 'delivery';

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

function resolveSelected(list: Delivery[], selectedId: string | null): Delivery | undefined {
  if (selectedId) {
    const found = list.find((d) => d.id === selectedId);
    if (found) return found;
  }
  return list[0];
}

export function FoodInPanel() {
  const { deliveries, team, today } = useStore();
  const { navigate, openReceive, openExpect, openIntake } = useUI();
  const [inTab, setInTab] = useState<InTab>('pickup'); // we default to pickups
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

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

  const activeList = inTab === 'pickup' ? ourPickups : incomingDeliveries;
  const selectedIn =
    inTab === 'pickup'
      ? resolveSelected(ourPickups, selectedPickupId)
      : resolveSelected(incomingDeliveries, selectedDeliveryId);
  const setSelected = inTab === 'pickup' ? setSelectedPickupId : setSelectedDeliveryId;
  const labels = chipLabels(activeList);

  return (
    <Card className="p-4 sm:p-5">
      <TileHeader icon="truck" label="Food in" onClick={() => navigate('intake')} />

      <div className="mt-3 grid items-stretch gap-4 lg:grid-cols-5">
        {/* LEFT — nav rail: type toggle, always-visible donor list, tertiary link. */}
        <div className="flex flex-col lg:col-span-2">
          <div className="flex items-start gap-2">
            <TypeTab
              active={inTab === 'pickup'}
              n={ourPickups.length}
              label="Pickups"
              onClick={() => setInTab('pickup')}
            />
            <TypeTab
              active={inTab === 'delivery'}
              n={incomingDeliveries.length}
              label="Deliveries"
              onClick={() => setInTab('delivery')}
            />
          </div>

          <div className="mt-2 flex-1 space-y-0.5">
            {activeList.length > 0 ? (
              activeList.map((d, i) => (
                <DonorListRow
                  key={d.id}
                  tier={mostUrgentTier(d)}
                  label={labels[i]}
                  timing={timingLabel(daysUntil(d.expectedDate, today))}
                  selected={d.id === selectedIn?.id}
                  onClick={() => setSelected(d.id)}
                />
              ))
            ) : (
              <p className="px-2 py-1.5 text-sm text-zinc-500">
                {inTab === 'pickup' ? 'No pickups en route.' : 'No deliveries en route.'}
              </p>
            )}
          </div>

          <button
            onClick={() => navigate('intake')}
            className="mt-2 self-start text-xs font-medium text-zinc-400 hover:text-zinc-700"
          >
            View all in Intake →
          </button>

          <div className="mt-auto pt-4">
            {activeList.length === 0 && (
              <Button className="w-full" variant="outline" onClick={openExpect}>
                <Icon name="plus" size={14} /> Expect a delivery
              </Button>
            )}
            <button
              onClick={openIntake}
              className="mt-2 w-full text-center text-xs font-medium text-zinc-400 hover:text-zinc-700"
            >
              + Log a walk-in donation
            </button>
          </div>
        </div>

        {/* RIGHT — bespoke detail, tall, filling the column. */}
        <div className="min-h-[280px] lg:col-span-3">
          {selectedIn ? (
            inTab === 'pickup' ? (
              <PickupDetail delivery={selectedIn} assignee={member(selectedIn.assigneeId)} />
            ) : (
              <DeliveryDetail
                delivery={selectedIn}
                today={today}
                onReceive={() => openReceive(selectedIn.id)}
              />
            )
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400">
              {inTab === 'pickup' ? 'No pickup en route' : 'No donor en route'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
