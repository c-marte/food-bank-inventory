import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { InventoryLot } from '../domain/types';
import { addDays, daysUntil, parseLocalDate } from '../domain/dates';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Card, EmptyCard, Icon, SectionHeader } from '../ui/primitives';
import { TIER_META } from '../ui/format';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * DECAY TIMELINE (exploration)
 *
 * Lots plotted on the day they hit zero, as food-emoji markers. Same-day lots
 * pile up (overlapped); tap a pile to fan it out and read each item, tap again
 * to bunch them back. A range toggle changes the horizon (1 / 2 / 4 weeks).
 * ───────────────────────────────────────────────────────── */

const RANGES: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

interface DayGroup {
  day: number;
  lots: InventoryLot[];
}

export function DecayTimeline() {
  const { lots, today } = useStore();
  const { openLot } = useUI();
  const [windowDays, setWindowDays] = useState(7);
  const [selected, setSelected] = useState<number | null>(null);

  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<number, InventoryLot[]>();
    for (const lot of lots) {
      if (lot.quantity <= 0) continue;
      const d = daysUntil(lot.expiryDate, today);
      if (d < 0 || d > windowDays) continue; // future window only
      const arr = byDay.get(d) ?? [];
      arr.push(lot);
      byDay.set(d, arr);
    }
    return [...byDay.entries()]
      .map(([day, ls]) => ({
        day,
        lots: ls.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.day - b.day);
  }, [lots, today, windowDays]);

  const maxCount = Math.max(1, ...groups.map((g) => g.lots.length));
  const total = groups.reduce((s, g) => s + g.lots.length, 0);

  // Axis ticks: every day for short ranges, sparser for the month.
  const tickStep = windowDays <= 14 ? (windowDays <= 7 ? 1 : 2) : 5;
  const ticks: number[] = [];
  for (let d = 0; d <= windowDays; d += tickStep) ticks.push(d);

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5">
            {RANGES.map((r) => {
              const active = windowDays === r.days;
              return (
                <button
                  key={r.days}
                  onClick={() => {
                    setWindowDays(r.days);
                    setSelected(null);
                  }}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5'
                      : 'text-zinc-500 hover:text-zinc-800',
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        }
      >
        Inventory soon to expire
      </SectionHeader>

      {total === 0 ? (
        <div className="mt-3">
          <EmptyCard icon={<Icon name="check" size={16} className="text-emerald-600" />}>
            Nothing expiring within {windowDays} days.
          </EmptyCard>
        </div>
      ) : (
        <>
          <LayoutGroup>
            <div className="relative mt-2 h-[220px] select-none">
              {/* backdrop to collapse an open pile */}
              {selected !== null && (
                <div
                  className="absolute inset-0 z-20"
                  onClick={() => setSelected(null)}
                />
              )}

              {/* plot track (horizontal padding keeps edge piles in view) */}
              <div className="absolute inset-x-6 bottom-11 top-2">
                {/* gridlines + tick labels */}
                {ticks.map((d) => {
                  const left = (d / windowDays) * 100;
                  return (
                    <div
                      key={d}
                      className="absolute bottom-0 top-0"
                      style={{ left: `${left}%` }}
                    >
                      <div className="h-full w-px bg-zinc-100" />
                      <div className="nums absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-400">
                        {tickLabel(today, d)}
                      </div>
                    </div>
                  );
                })}
                {/* baseline */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-200" />

                {/* count bars (the quiet bar-graph underlay) */}
                {groups.map((g) => {
                  const left = (g.day / windowDays) * 100;
                  const h = (g.lots.length / maxCount) * 70;
                  return (
                    <div
                      key={`bar-${g.day}`}
                      className="absolute bottom-0 w-6 -translate-x-1/2 rounded-t bg-zinc-100"
                      style={{ left: `${left}%`, height: `${h}%` }}
                    />
                  );
                })}

                {/* piles */}
                {groups.map((g) => (
                  <DayPile
                    key={g.day}
                    group={g}
                    windowDays={windowDays}
                    today={today}
                    expanded={selected === g.day}
                    onToggle={() =>
                      setSelected((cur) => (cur === g.day ? null : g.day))
                    }
                    onOpenLot={(lotId) => {
                      setSelected(null);
                      openLot(lotId);
                    }}
                  />
                ))}
              </div>
            </div>
          </LayoutGroup>

          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
            <Icon name="alert" size={12} className="text-zinc-300" />
            {total} lots expiring in {windowDays} days · tap a cluster to fan it out.
          </p>
        </>
      )}
    </Card>
  );
}

function DayPile({
  group,
  windowDays,
  today,
  expanded,
  onToggle,
  onOpenLot,
}: {
  group: DayGroup;
  windowDays: number;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenLot: (lotId: string) => void;
}) {
  const left = (group.day / windowDays) * 100;
  const n = group.lots.length;
  const urgent = group.day <= 1;

  // Keep the fan-out popover inside the plot.
  const anchor = left > 66 ? 'right' : left < 34 ? 'left' : 'center';
  const anchorX =
    anchor === 'center' ? '-50%' : anchor === 'left' ? '0%' : '-100%';

  return (
    <motion.div
      layout
      className="absolute bottom-0 z-10"
      style={{ left: `${left}%` }}
      transition={SPRING.reflow}
    >
      {/* Collapsed cluster — the handle. A single-lot pile skips the fan and
          opens the lot's verbs directly. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (n === 1) onOpenLot(group.lots[0].id);
          else onToggle();
        }}
        className="absolute bottom-0 -translate-x-1/2 cursor-pointer focus-visible:outline-none"
        style={{ height: 40, width: 40 }}
        aria-label={`${n} lot${n === 1 ? '' : 's'} expiring ${tickLabel(today, group.day)}`}
        aria-expanded={expanded}
      >
        {!expanded &&
          group.lots.map((lot, i) => {
            const mid = (n - 1) / 2;
            return (
              <motion.span
                key={lot.id}
                layoutId={`chip-${lot.id}`}
                className={cn(
                  'absolute left-1/2 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm ring-1',
                  urgent ? 'ring-red-200' : 'ring-zinc-200',
                )}
                style={{ zIndex: i }}
                initial={false}
                animate={{
                  x: `calc(-50% + ${(i - mid) * 7}px)`,
                  rotate: (i - mid) * 6,
                }}
                transition={SPRING.reflow}
              >
                <Icon name={TIER_META[lot.tier].iconKey} size={16} />
              </motion.span>
            );
          })}

        {/* count badge */}
        {!expanded && n > 1 && (
          <span className="nums absolute -right-1 -top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold text-white">
            {n}
          </span>
        )}

        {/* stub shown while expanded so the handle stays clickable */}
        {expanded && (
          <span
            className={cn(
              'absolute bottom-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full',
              urgent ? 'bg-red-500' : 'bg-amber-500',
            )}
          />
        )}
      </button>

      {/* Fanned-out list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={SPRING.pop}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-12 z-30 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl"
            style={{ left: anchor === 'center' ? '50%' : anchor === 'left' ? '0' : '100%', transform: `translateX(${anchorX})` }}
          >
            <div className="eyebrow mb-1 px-1 text-[10px] font-bold text-zinc-400">
              {tickLabel(today, group.day)} · {n} lot{n === 1 ? '' : 's'}
            </div>
            <ul className="space-y-0.5">
              {group.lots.map((lot) => (
                <li key={lot.id}>
                  <button
                    onClick={() => onOpenLot(lot.id)}
                    className="group flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  >
                    <motion.span
                      layoutId={`chip-${lot.id}`}
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm ring-1',
                        urgent ? 'ring-red-200' : 'ring-zinc-200',
                      )}
                    >
                      <Icon name={TIER_META[lot.tier].iconKey} size={16} />
                    </motion.span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950">
                        {lot.name}
                      </span>
                      <span className="nums block text-[11px] text-zinc-500">
                        {lot.quantity} {lot.unit} · {TIER_META[lot.tier].label}
                      </span>
                    </span>
                    <Icon
                      name="chevron"
                      size={14}
                      className="shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function tickLabel(today: string, d: number): string {
  if (d === 0) return 'Today';
  if (d === 1) return 'Tmrw';
  const date = parseLocalDate(addDays(today, d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
