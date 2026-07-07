import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Delivery, PerishTier } from '../domain/types';
import { Icon, TierMark } from '../ui/primitives';
import { TIER_META } from '../ui/format';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * Shared parts used by both FoodInPanel and FoodOutPanel — the two panels
 * are no longer mirrored tiles in one row (Food In went full-width), but
 * they still share a visual language: the clickable title-header, the
 * number+label KPI block (as a tab or static), the fixed-height metadata
 * row, and the delivery cross-check list. Food Out's visual anchor (the
 * Pack → Match → Handoff connector) also lives here. Food In's used to
 * (a stylized, non-live illustration), but it's now TrackerMapCanvas.tsx —
 * a real, interactive Leaflet map wrapped by bespoke per-mode chrome in
 * PickupDetail.tsx / DeliveryDetail.tsx — since Food In is where this
 * build's remaining polish is going. Food Out deliberately keeps its simpler
 * treatment: no real multi-stage fulfillment pipeline exists to track (a
 * movement is pending, then released — that's the whole state machine), so
 * the status board stays an AGGREGATE of today's real, independent counts,
 * not a fabricated per-item journey.
 * ───────────────────────────────────────────────────────── */

/** Both panels reserve enough room for the tallest metadata case (Food In's
 *  delivery selection, which adds a cross-check item list), so the row never
 *  changes height as its content changes. */
export const METADATA_MIN_H = 'min-h-14';

/** A panel's title, itself the click-through to its full surface (Intake /
 *  Distribution) — one affordance instead of a separate "View X" link. */
export function TileHeader({
  icon,
  label,
  onClick,
}: {
  icon: 'truck' | 'arrow';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group eyebrow -m-1 flex items-center gap-1.5 self-start rounded-md p-1 text-[11px] font-bold text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
    >
      <Icon name={icon} size={13} />
      {label}
      <Icon
        name="chevron"
        size={11}
        className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

/** Every KPI number: same size everywhere, always plain black. Color is
 *  reserved for status elsewhere (tier marks, the Act-first headline) — not
 *  for a panel's hero count. */
export function Count({ n }: { n: number }) {
  return (
    <span className="relative inline-flex h-9 min-w-[2rem] items-center justify-start">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.pop}
          className="nums text-2xl font-bold text-zinc-950"
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Food In's Pickup/Delivery parent toggle — deliberately NOT a hero-count
 *  KPI (that's what it replaced). A compact pill; the count is a plain
 *  inline number, not the giant `Count` treatment reserved for standalone
 *  metrics. Selection drives the always-visible donor list + bespoke detail
 *  panel below/beside it. */
export function TypeTab({
  active,
  n,
  label,
  onClick,
}: {
  active: boolean;
  n: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors',
        active
          ? 'bg-zinc-950 text-white'
          : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
      )}
    >
      <span className="nums truncate">
        {label} <span className={active ? 'text-zinc-400' : 'text-zinc-400'}>·</span> {n}
      </span>
    </button>
  );
}

/** The always-visible donor list row (replaces the old "only show chips when
 *  there's more than one" behavior — Food In's left column is now a nav
 *  rail, so the list should never disappear out from under a selection). */
export function DonorListRow({
  tier,
  label,
  timing,
  selected,
  onClick,
}: {
  tier: PerishTier;
  label: string;
  timing: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        selected ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50',
      )}
    >
      <TierMark
        tier={tier}
        size={13}
        className={selected ? 'text-white/70' : undefined}
      />
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      <span className={cn('nums shrink-0 text-xs', selected ? 'text-white/60' : 'text-zinc-400')}>
        {timing}
      </span>
    </button>
  );
}

/** Collapsed by default: a one-line count, expanding to the full cross-check
 *  list on demand. The manifest is real data either way — this only controls
 *  how much of it is visible at once. */
export function ManifestDisclosure({ delivery }: { delivery: Delivery }) {
  const [open, setOpen] = useState(false);
  const n = delivery.items.length;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        aria-expanded={open}
      >
        <Icon
          name="chevron"
          size={10}
          className={cn('transition-transform', open && 'rotate-90')}
        />
        {n} item{n === 1 ? '' : 's'} in manifest
      </button>
      {open && <CrossCheckItems delivery={delivery} />}
    </div>
  );
}

/** Food Out's KPI block — same box/typography as MetricTab, but static (not a
 *  tab) and always plain black: no urgency color on the large number. */
export function KpiBlock({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-left">
      <Count n={n} />
      <div className="truncate text-xs text-zinc-500">{label}</div>
    </div>
  );
}

/** The delivery's manifest, so the receiver can cross-check what arrives
 *  against what was promised. */
export function CrossCheckItems({ delivery }: { delivery: Delivery }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
      {delivery.items.map((it, i) => (
        <span key={it.id} className="nums inline-flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">·</span>}
          <TierMark tier={it.tier} size={11} />
          {it.quantity} {it.name}
        </span>
      ))}
    </div>
  );
}

/** A small selectable pill for choosing WHICH item within an active category
 *  (e.g. which of two scheduled pickups) — reuses the tier mark so a glance
 *  still shows handling class even at this compact size. */
export function ItemChip({
  tier,
  label,
  selected,
  onClick,
}: {
  tier: PerishTier;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        selected
          ? 'border-zinc-950 bg-zinc-950 text-white'
          : 'border-zinc-300 text-zinc-600 hover:border-zinc-500',
      )}
    >
      <span className={selected ? 'text-white' : 'text-zinc-500'}>
        <Icon name={TIER_META[tier].iconKey} size={11} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

const NODE_TONE: Record<'urgent' | 'normal' | 'calm', { dot: string }> = {
  urgent: { dot: 'bg-red-500' },
  normal: { dot: 'bg-zinc-900' },
  calm: { dot: 'bg-emerald-500' },
};

interface StatusBucket {
  n: number;
  label: string;
  /** The WHO at this stage — owner first names, or the outreach hint. */
  sub?: string;
  tone: 'urgent' | 'normal' | 'calm';
}

/** Food Out's visual anchor: the Pack → Match → Handoff connector, mirroring
 *  the Food In map's role (a graphic, not a number — the counts themselves
 *  now live in the KPI row above, same as Food In's tabs). Only the small
 *  stage dots keep semantic color; the "no special color for the large
 *  number" rule lives in the KPI row, not here. */
export function OutboundStatusBoard({ buckets }: { buckets: StatusBucket[] }) {
  return (
    <div className="flex h-full min-h-28 flex-col justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4">
      <div className="flex items-center">
        {buckets.map((b, i) => (
          <span key={b.label} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                b.n > 0 ? NODE_TONE[b.tone].dot : 'bg-zinc-200',
              )}
            />
            {i < buckets.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex items-start justify-between">
        {buckets.map((b) => (
          <span
            key={b.label}
            className="w-16 text-center text-[10px] leading-tight text-zinc-500"
          >
            {b.label}
            {b.sub && (
              <span className="block truncate text-[9px] text-zinc-400">{b.sub}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
