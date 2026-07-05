import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Config, InventoryLot, ISODate, PickupRequest } from '../domain/types';
import { getLotStatus } from '../domain/status';
import { useStore } from '../store/useStore';
import { Button, Card, EmptyCard, Icon, SectionHeader } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';
import { RecordPickupSheet } from './RecordPickupSheet';

/** The outflow queue. Requests arrive (seeded, or recorded by staff when a
 *  partner calls) and Confirm is the moment stock actually leaves the shelf. */
export function PickupsQueue() {
  const { requests, lots, partners, today, config, confirmRequest } = useStore();
  const [recording, setRecording] = useState(false);

  const sorted = [...requests].sort((a, b) => {
    // Pending first, then by id for stability.
    if (a.status !== b.status) return a.status === 'requested' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  const pending = requests.filter((r) => r.status === 'requested').length;

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          <div className="flex items-center gap-2">
            {pending > 0 ? (
              <span className="nums rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">
                {pending} pending
              </span>
            ) : (
              <span className="eyebrow text-[10px] font-bold text-zinc-400">
                all clear
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
              <Icon name="plus" size={13} /> Record pickup
            </Button>
          </div>
        }
      >
        Pickups
      </SectionHeader>

      {sorted.length === 0 ? (
        <div className="mt-3">
          <EmptyCard>No pickup requests yet.</EmptyCard>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          <AnimatePresence initial={false}>
            {sorted.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                partnerName={partners.find((p) => p.id === req.partnerId)?.name ?? 'Partner'}
                lots={lots}
                today={today}
                config={config}
                onConfirm={() => confirmRequest(req.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <RecordPickupSheet open={recording} onClose={() => setRecording(false)} />
    </Card>
  );
}

function RequestRow({
  req,
  partnerName,
  lots,
  today,
  config,
  onConfirm,
}: {
  req: PickupRequest;
  partnerName: string;
  lots: InventoryLot[];
  today: ISODate;
  config: Config;
  onConfirm: () => void;
}) {
  const confirmed = req.status === 'confirmed';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={SPRING.reflow}
      className={cn(
        'rounded-lg border p-3',
        confirmed ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-300',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-950">
            {partnerName}
          </span>
          {confirmed ? (
            <span className="eyebrow inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              <Icon name="check" size={11} /> CONFIRMED
            </span>
          ) : (
            <span className="eyebrow rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
              REQUESTED
            </span>
          )}
        </div>
        {!confirmed && (
          <Button size="sm" onClick={onConfirm}>
            <Icon name="check" size={14} /> Confirm
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {req.items.map((item) => {
          const lot = lots.find((l) => l.id === item.lotId);
          const onHand = lot?.quantity ?? 0;
          const expired = lot
            ? getLotStatus(lot, today, config) === 'expired'
            : false;
          const willShip = expired ? 0 : Math.min(item.quantity, onHand);
          const short = !confirmed && willShip < item.quantity;

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
                {!confirmed && (
                  <span
                    className={cn(
                      'ml-2',
                      short ? 'font-semibold text-red-700' : 'text-zinc-400',
                    )}
                  >
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
