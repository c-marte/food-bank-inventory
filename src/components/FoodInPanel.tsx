import { useState } from 'react';
import type { Delivery, PerishTier } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, Icon, TeamBadge } from '../ui/primitives';
import { TIER_META } from '../ui/format';
import {
  CrossCheckItems,
  ItemChip,
  MetricTab,
  METADATA_MIN_H,
  TileHeader,
  timingLabel,
} from './FlowTileVisuals';
import { DeliveryTrackerMap } from './DeliveryTrackerMap';
import { cn } from '../ui/cn';

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
 * FOOD IN — full width, Google-Maps-style split: information on the left
 * (parent toggle, item selector, metadata, footer), the map filling the
 * right column at full height (`items-stretch` on the grid — the map isn't
 * squeezed into a leftover flex-1 sliver anymore, it IS the right column).
 *
 * Two-level selection: a PARENT toggle (Pickups vs. Deliveries — same two
 * real, never-lumped categories as before), then — only when the active
 * category has more than one item — a row of item chips to pick WHICH
 * scheduled pickup/delivery the metadata and map are currently showing.
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
        {/* LEFT — KPIs, item selector, metadata, footer */}
        <div className="flex flex-col lg:col-span-2">
          {/* Parent toggle — 2 clickable tabs. */}
          <div className="flex items-start gap-2">
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

          {/* Item selector — only when there's more than one to choose from. */}
          {activeList.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeList.map((d, i) => (
                <ItemChip
                  key={d.id}
                  tier={mostUrgentTier(d)}
                  label={labels[i]}
                  selected={d.id === selectedIn?.id}
                  onClick={() => setSelected(d.id)}
                />
              ))}
            </div>
          )}

          {/* Metadata — fixed height regardless of selection; overflow clips
              rather than growing the box if content wraps at a narrow width. */}
          <div className={cn('mt-2 overflow-hidden', METADATA_MIN_H)}>
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

          {/* Footer — pinned to the bottom of the left column, matching the
              map's height on the right (items-stretch + mt-auto). */}
          <div className="mt-auto pt-4">
            {selectedIn ? (
              <Button className="w-full" onClick={() => openReceive(selectedIn.id)}>
                <Icon name="inbox" size={14} /> Receive
              </Button>
            ) : (
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

        {/* RIGHT — the map, tall, filling the column. */}
        <div className="min-h-[280px] lg:col-span-3">
          {selectedIn ? (
            <DeliveryTrackerMap delivery={selectedIn} today={today} />
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
