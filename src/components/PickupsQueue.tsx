import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Config, InventoryLot, ISODate, PickupRequest } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import { buildFefoBox, getDyingLots } from '../domain/distribution';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Button, Card, EmptyCard, Icon, SectionHeader, TierMark } from '../ui/primitives';
import { TIER_META, shortDayLabel } from '../ui/format';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/**
 * Distribution — food OUT, decay-forward. The shelf leads by pushing what's
 * dying to a meal program; the app builds a FEFO family box; standing partner
 * orders release below. Every path RELEASES immediately (rule 2: decrement).
 */
export function PickupsQueue() {
  const { lots, partners, requests, distributions, today, config, release, confirmRequest } =
    useStore();
  const { openPickup } = useUI();

  const dying = getDyingLots(lots, today, config);
  const box = buildFefoBox(lots, today, config);
  const family = partners.find((p) => p.kind === 'family');
  const kitchens = partners.filter((p) => p.kind === 'meal_program');
  const orders = [...requests].sort((a, b) =>
    a.status !== b.status ? (a.status === 'requested' ? -1 : 1) : a.id.localeCompare(b.id),
  );

  const todays = distributions.filter((d) => d.date === today);
  const households = todays.reduce((s, d) => s + d.households, 0);
  const lotsOut = todays.reduce(
    (s, d) => s + d.lines.filter((l) => l.released > 0).length,
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Distribution
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Move what's dying to a kitchen, pack boxes for families — every release
          comes off the shelf as it goes.
          {lotsOut > 0 && (
            <span className="text-zinc-700">
              {' '}
              Today: {households > 0 && `${households} household${households === 1 ? '' : 's'}, `}
              {lotsOut} lot{lotsOut === 1 ? '' : 's'} out.
            </span>
          )}
        </p>
      </div>

      {/* Move it out — decay-forward push (the hero). */}
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
          Move it out
        </SectionHeader>
        {dying.length === 0 ? (
          <div className="mt-3">
            <EmptyCard icon={<Icon name="check" size={16} className="text-emerald-600" />}>
              Nothing's about to spoil. The shelf is calm.
            </EmptyCard>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {dying.map((lot) => (
                <motion.li
                  key={lot.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING.reflow}
                  style={{ overflow: 'hidden' }}
                >
                  <DyingRow
                    lot={lot}
                    days={daysUntil(lot.expiryDate, today)}
                    kitchens={kitchens}
                    onSend={(recipientId) =>
                      release(recipientId, 'push', [
                        { lotId: lot.id, quantity: lot.quantity },
                      ])
                    }
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      {/* Family box — FEFO, the app decides what leaves. */}
      {family && (
        <Card className="p-4 sm:p-5">
          <SectionHeader>Family box</SectionHeader>
          {box.length === 0 ? (
            <div className="mt-3">
              <EmptyCard>No groceries to box right now.</EmptyCard>
            </div>
          ) : (
            <>
              <p className="mt-2 mb-3 text-xs text-zinc-500">
                Auto-filled from the soonest-expiring groceries (first-expire,
                first-out). Prepared food is routed to kitchens, not boxes.
              </p>
              <ul className="flex flex-wrap gap-2">
                {box.map((item) => {
                  const lot = lots.find((l) => l.id === item.lotId);
                  if (!lot) return null;
                  return (
                    <li
                      key={item.lotId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-2 pr-3 text-sm"
                    >
                      <TierMark tier={lot.tier} size={13} />
                      <span className="font-medium text-zinc-800">{lot.name}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-4">
                <Button onClick={() => release(family.id, 'box', box, 1)}>
                  <Icon name="check" size={15} /> Pack box for a family
                </Button>
                <span className="text-xs text-zinc-400">
                  {box.length} item{box.length === 1 ? '' : 's'} · decrements FEFO
                </span>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Standing partner orders. */}
      <Card className="p-4 sm:p-5">
        <SectionHeader
          right={
            <Button size="sm" variant="outline" onClick={() => openPickup()}>
              <Icon name="plus" size={13} /> Log a request
            </Button>
          }
        >
          Partner orders
        </SectionHeader>
        {orders.length === 0 ? (
          <div className="mt-3">
            <EmptyCard>No standing orders.</EmptyCard>
          </div>
        ) : (
          <ul className="mt-3 space-y-2.5">
            <AnimatePresence initial={false}>
              {orders.map((req) => (
                <RequestRow
                  key={req.id}
                  req={req}
                  partnerName={partners.find((p) => p.id === req.partnerId)?.name ?? 'Partner'}
                  lots={lots}
                  today={today}
                  config={config}
                  onRelease={() => confirmRequest(req.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>
    </div>
  );
}

function DyingRow({
  lot,
  days,
  kitchens,
  onSend,
}: {
  lot: InventoryLot;
  days: number;
  kitchens: { id: string; name: string }[];
  onSend: (recipientId: string) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const meta = TIER_META[lot.tier];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <TierMark tier={lot.tier} size={14} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-zinc-950">{lot.name}</div>
        <div className="nums text-xs text-zinc-500">
          {lot.quantity} {lot.unit} ·{' '}
          <span className={cn('font-semibold', days <= 1 ? 'text-red-700' : 'text-amber-700')}>
            {shortDayLabel(days)}
          </span>{' '}
          · {meta.label}
        </div>
      </div>

      {!choosing ? (
        <Button size="sm" onClick={() => setChoosing(true)}>
          Send <Icon name="arrow" size={14} />
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow text-[10px] font-bold text-zinc-400">To</span>
          {kitchens.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setChoosing(false);
                onSend(k.id);
              }}
              className="h-8 rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
            >
              {k.name}
            </button>
          ))}
          <button
            onClick={() => setChoosing(false)}
            aria-label="Cancel"
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-900"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  req,
  partnerName,
  lots,
  today,
  config,
  onRelease,
}: {
  req: PickupRequest;
  partnerName: string;
  lots: InventoryLot[];
  today: ISODate;
  config: Config;
  onRelease: () => void;
}) {
  const released = req.status === 'confirmed';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={SPRING.reflow}
      className={cn(
        'rounded-lg border p-3',
        released ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-300',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-950">
            {partnerName}
          </span>
          {released ? (
            <span className="eyebrow inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              <Icon name="check" size={11} /> RELEASED
            </span>
          ) : (
            <span className="eyebrow rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
              REQUESTED
            </span>
          )}
        </div>
        {!released && (
          <Button size="sm" onClick={onRelease}>
            <Icon name="arrow" size={14} /> Release
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {req.items.map((item) => {
          const lot = lots.find((l) => l.id === item.lotId);
          const onHand = lot?.quantity ?? 0;
          const expired = lot ? getLotStatus(lot, today, config) === 'expired' : false;
          const willShip = expired ? 0 : Math.min(item.quantity, onHand);
          const short = !released && willShip < item.quantity;

          return (
            <li
              key={item.lotId}
              className="nums flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="min-w-0 truncate text-zinc-700">
                {lot?.name ?? 'Unknown lot'}
              </span>
              <span className="shrink-0 text-zinc-500">
                <span className="font-semibold text-zinc-900">{item.quantity}</span>{' '}
                requested
                {!released && (
                  <span className={cn('ml-2', short ? 'font-semibold text-red-700' : 'text-zinc-400')}>
                    {expired ? 'expired · 0 on hand' : `${onHand} on hand`}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.li>
  );
}
