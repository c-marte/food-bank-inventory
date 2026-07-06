import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { getLotStatus } from '../domain/status';
import { buildFefoBox } from '../domain/distribution';
import { daysUntil } from '../domain/dates';
import { Button, Card, Icon, TierChip } from '../ui/primitives';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * TODAY — the decay-generated worklist.
 *
 * The home is no longer a dashboard you parse; it's a ranked list of what to
 * DO today, derived from the clock + both flows, with the verb inline. Done
 * work recedes. The rich status (timeline, zones) is one tap away behind
 * "View the full shelf".
 * ───────────────────────────────────────────────────────── */

type Tone = 'urgent' | 'normal' | 'calm';

interface Task {
  id: string;
  leading: ReactNode;
  title: ReactNode;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  sortKey: number;
}

const TONE_RING: Record<Tone, string> = {
  urgent: 'bg-red-50 text-red-600 ring-red-200',
  normal: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  calm: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
};

function Badge({ tone, name }: { tone: Tone; name: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
        TONE_RING[tone],
      )}
    >
      <Icon name={name} size={17} />
    </span>
  );
}

function diesLabel(d: number): string {
  return d <= 0 ? 'dies today' : d === 1 ? 'dies tomorrow' : `dies in ${d} days`;
}

export function TodayWorklist() {
  const {
    lots,
    requests,
    deliveries,
    distributions,
    partners,
    wasteEvents,
    today,
    config,
  } = useStore();
  const { navigate, openReceive, setExpiredOnly } = useUI();

  const partnerName = (id: string) =>
    partners.find((p) => p.id === id)?.name ?? 'partner';

  const tasks: Task[] = [];

  // 1. Dying PREPARED food -> push to a meal program (most urgent).
  lots
    .filter(
      (l) =>
        l.quantity > 0 &&
        l.tier === 'prepared' &&
        getLotStatus(l, today, config) === 'expiring_soon',
    )
    .forEach((l) => {
      const d = daysUntil(l.expiryDate, today);
      tasks.push({
        id: `send-${l.id}`,
        leading: <TierChip tier="prepared" size={36} />,
        title: (
          <>
            Send <b className="font-semibold">{l.quantity} {l.name}</b> to a meal
            program
          </>
        ),
        detail: `${diesLabel(d)} · prepared food moves today`,
        actionLabel: 'Send',
        onAction: () => navigate('distribution'),
        sortKey: Math.max(0, d),
      });
    });

  // 2. Deliveries at the dock -> receive them.
  deliveries
    .filter((del) => del.status === 'expected')
    .forEach((del) => {
      const d = daysUntil(del.expectedDate, today);
      tasks.push({
        id: `receive-${del.id}`,
        leading: <Badge tone="normal" name="truck" />,
        title: (
          <>
            Receive <b className="font-semibold">{del.donorName}</b>
          </>
        ),
        detail: del.note
          ? del.note
          : d <= 0
            ? 'arriving today'
            : `arriving in ${d} days`,
        actionLabel: 'Receive',
        onAction: () => openReceive(del.id),
        sortKey: 0.4 + Math.max(0, d),
      });
    });

  // 3. Pack a FEFO family box from the soonest-expiring groceries.
  const box = buildFefoBox(lots, today, config);
  if (box.length > 0) {
    tasks.push({
      id: 'box',
      leading: <TierChip tier="fresh" size={36} />,
      title: <>Pack a family box</>,
      detail: `${box.length} items · soonest-expiring first (FEFO)`,
      actionLabel: 'Pack',
      onAction: () => navigate('distribution'),
      sortKey: 1.5,
    });
  }

  // 4. Release standing partner orders.
  requests
    .filter((r) => r.status === 'requested')
    .forEach((r) => {
      tasks.push({
        id: `release-${r.id}`,
        leading: <Badge tone="normal" name="arrow" />,
        title: (
          <>
            Release order to{' '}
            <b className="font-semibold">{partnerName(r.partnerId)}</b>
          </>
        ),
        detail: `${r.items.length} lot${r.items.length === 1 ? '' : 's'} requested`,
        actionLabel: 'Release',
        onAction: () => navigate('distribution'),
        sortKey: 2.0,
      });
    });

  // 5. Pull expired food off the shelf (cleanup — record the waste).
  const expired = lots.filter(
    (l) => l.quantity > 0 && getLotStatus(l, today, config) === 'expired',
  );
  if (expired.length > 0) {
    tasks.push({
      id: 'pull-expired',
      leading: <Badge tone="urgent" name="trash" />,
      title: (
        <>
          Pull{' '}
          <b className="font-semibold">
            {expired.length} expired {expired.length === 1 ? 'lot' : 'lots'}
          </b>
        </>
      ),
      detail: 'off the shelf — record the waste',
      actionLabel: 'Review',
      onAction: () => {
        setExpiredOnly(true);
        navigate('inventory');
      },
      sortKey: 2.5,
    });
  }

  tasks.sort((a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id));

  // Done today — receded.
  const done: { id: string; text: string }[] = [
    ...distributions
      .filter((dist) => dist.date === today)
      .map((dist) => ({
        id: dist.id,
        text:
          dist.recipientKind === 'family'
            ? `Packed a family box (${dist.lines.length} items)`
            : `Released to ${dist.recipientName}`,
      })),
    ...deliveries
      .filter((del) => del.status === 'received')
      .map((del) => ({ id: del.id, text: `Received ${del.donorName}` })),
    ...wasteEvents
      .filter((w) => w.date === today)
      .map((w) => ({ id: w.id, text: `Pulled ${w.quantity} ${w.lotName}` })),
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold tracking-tight text-zinc-950">Today</h1>
        <span className="nums text-sm text-zinc-500">
          {tasks.length === 0
            ? 'all clear'
            : `${tasks.length} ${tasks.length === 1 ? 'thing needs' : 'things need'} you`}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
          <Icon name="check" size={16} className="text-emerald-600" />
          Nothing needs you right now. The shelf is in good shape.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={SPRING.reflow}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3"
              >
                {t.leading}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-950">{t.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{t.detail}</div>
                </div>
                <Button size="sm" onClick={t.onAction}>
                  {t.actionLabel}
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="eyebrow mb-1.5 text-[10px] font-bold text-zinc-400">
            Done today
          </div>
          <ul className="space-y-1">
            {done.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 text-[13px] text-zinc-400"
              >
                <Icon name="check" size={13} className="text-emerald-500" />
                <span className="line-through decoration-zinc-300">{d.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
