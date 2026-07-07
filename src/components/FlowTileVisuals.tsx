import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Delivery, DeliveryItem, PerishTier } from '../domain/types';
import { getDeliveryStage, getDeliveryProgress } from '../domain/deliveries';
import { daysUntil } from '../domain/dates';
import { FOOD_GROUPS, FOOD_GROUP_ICON, foodGroupFor, type FoodGroup } from '../domain/foodGroups';
import { DonorMark, Icon, TierMark } from '../ui/primitives';
import { TIER_META, fullDateLabel } from '../ui/format';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

function timingLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return `in ${daysAway} days`;
}

/** The real manifest, summarized by food group (counts per group, from real
 *  item lines) — shared by both Food In rows so a delivery and a pickup
 *  describe "what's in it" the exact same way. Never a fabricated weight or
 *  headcount: this app has no way to sum mixed units (trays, sandwiches,
 *  bowls) into pounds, so counting lines per group is the honest version of
 *  "what's coming," not a number invented to sound more precise. */
function FoodGroupSummary({ items }: { items: DeliveryItem[] }) {
  const counts: Record<FoodGroup, number> = { hot: 0, canned: 0, groceries: 0 };
  for (const item of items) counts[foodGroupFor(item)]++;
  const summary = FOOD_GROUPS.filter((g) => counts[g] > 0);
  if (summary.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-zinc-500">
      {summary.map((g) => (
        <span key={g} className="nums inline-flex items-center gap-1">
          <Icon name={FOOD_GROUP_ICON[g]} size={11} />
          {counts[g]} {g}
        </span>
      ))}
    </div>
  );
}

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

/** INBOUND DELIVERY row — the donor's own arrival window (never a computed
 *  ETA) is the headline fact here, not buried in the modal, since "what time
 *  is it coming" should be obvious without a click. Below it, a muted
 *  5-segment bar using the SAME sky/zinc treatment as the modal's stepper
 *  (shared math too, via getDeliveryProgress, so the two never disagree) —
 *  just smaller and quieter, not a different color language. */
export function DeliveryRow({
  delivery,
  today,
  label,
  onSeeMore,
}: {
  delivery: Delivery;
  today: string;
  /** Overrides the displayed name — used to disambiguate two same-day trips
   *  from the same donor ("Stop & Shop #2"). Falls back to donorName. */
  label?: string;
  onSeeMore: () => void;
}) {
  const stage = getDeliveryStage(delivery, today);
  const urgent = stage === 'en_route';
  const progress = getDeliveryProgress(delivery, today);
  const daysAway = daysUntil(delivery.expectedDate, today);
  const stageTone = urgent ? 'bg-sky-500' : 'bg-zinc-400';

  const timing = delivery.estimatedWindow
    ? `Est. ${delivery.estimatedWindow}`
    : urgent
      ? daysAway < 0
        ? 'Overdue'
        : 'Arriving today'
      : timingLabel(daysAway);

  return (
    <button
      onClick={onSeeMore}
      className="flex w-full flex-col gap-1.5 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-zinc-50"
    >
      <div className="flex items-center gap-2.5">
        <DonorMark name={delivery.donorName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-900">
            {label ?? delivery.donorName}
          </div>
          <FoodGroupSummary items={delivery.items} />
        </div>
        <span className="nums shrink-0 text-xs font-semibold text-zinc-600">{timing}</span>
      </div>
      <div className="flex gap-0.5 pl-9">
        {Array.from({ length: 5 }).map((_, i) => {
          const segStart = i / 5;
          const segEnd = (i + 1) / 5;
          const fillPct =
            Math.max(0, Math.min(1, (progress - segStart) / (segEnd - segStart))) * 100;
          return (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200">
              <div className={cn('h-full rounded-full', stageTone)} style={{ width: `${fillPct}%` }} />
            </div>
          );
        })}
      </div>
    </button>
  );
}

/** SCHEDULED PICKUP row — the metadata line is a real, honest manifest
 *  summary (counts per food group, from real item lines), never a fabricated
 *  weight or headcount: this app has no way to sum mixed units (trays,
 *  sandwiches, bowls) into pounds, and no data source for "how many people
 *  it takes" — that's a judgment call for whoever reads this list, not a
 *  number we invent. In place of an avatar, the right side shows WHEN it's
 *  expected — three honest cases from the same expectedDate a pickup has
 *  always had: "Ready" (green, the pixel display font) once the day has
 *  arrived, "Tomorrow" for the day right before, or the calendar date
 *  further out. Never a countdown, never a clock time — just which of the
 *  three real buckets today falls into. */
export function PickupRow({
  delivery,
  today,
  label,
  onSeeMore,
}: {
  delivery: Delivery;
  today: string;
  /** Overrides the displayed name — used to disambiguate two same-day trips
   *  from the same donor ("Sal's Catering #2"). Falls back to donorName. */
  label?: string;
  onSeeMore: () => void;
}) {
  const daysAway = daysUntil(delivery.expectedDate, today);
  const isReady = daysAway <= 0;
  const isTomorrow = daysAway === 1;

  return (
    <button
      onClick={onSeeMore}
      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-zinc-50"
    >
      <DonorMark name={delivery.donorName} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-900">
          {label ?? delivery.donorName}
        </div>
        <FoodGroupSummary items={delivery.items} />
      </div>
      {isReady ? (
        <span className="eyebrow font-pixel shrink-0 text-xs font-bold text-emerald-600">
          Ready
        </span>
      ) : (
        <span className="nums shrink-0 text-xs font-medium text-zinc-600">
          {isTomorrow ? 'Tomorrow' : fullDateLabel(delivery.expectedDate)}
        </span>
      )}
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
      {/* Underlined, not just a color shift — color stays reserved for
          status elsewhere in this app (the stepper's sky "en route" dot
          sits right next to this on the delivery side), so the one
          interactive piece of muted text here is set apart by decoration,
          not by borrowing a status hue. */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-950 hover:decoration-zinc-500"
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
