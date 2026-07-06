import { Icon } from '../ui/primitives';
import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * The two visual anchors inside the Food In / Food Out tiles — same height,
 * same slot (under the status line, above the action row), so the tiles stay
 * symmetric. Both are deliberately NOT literal trackers: we have no real GPS
 * on a donor's van and no real multi-stage fulfillment pipeline (a partner
 * order is pending, then released — that's the whole state machine). Faking
 * either would be decorative precision the data can't back up, so:
 *   - the map is a STATIC origin→dock illustration (no live position claimed)
 *   - the status board is an AGGREGATE of today's real, independent counts,
 *     not a fabricated per-item journey.
 * ───────────────────────────────────────────────────────── */

/** Food In: a stylized, non-live origin→dock map. No street data — we don't
 *  have a donor's real coordinates, so the streets are abstract, not a real
 *  place. The pin, dashed route, and dock are honest to what we know: a named
 *  donor, headed here, at a rough time. */
export function DeliveryOriginMap({
  donorName,
  timing,
}: {
  donorName: string;
  timing: string;
}) {
  return (
    <div className="relative h-28 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1="0" y1="26" x2="100" y2="26" stroke="#e4e4e7" strokeWidth="0.6" />
        <line x1="0" y1="68" x2="100" y2="68" stroke="#e4e4e7" strokeWidth="0.6" />
        <line x1="32" y1="0" x2="32" y2="100" stroke="#e4e4e7" strokeWidth="0.6" />
        <line x1="74" y1="0" x2="74" y2="100" stroke="#e4e4e7" strokeWidth="0.6" />
        <path
          d="M17 28 Q50 12 83 72"
          fill="none"
          stroke="#a1a1aa"
          strokeWidth="1.4"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* origin pin */}
      <div className="absolute left-[17%] top-[28%] -translate-x-1/2 -translate-y-1/2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-white shadow-sm ring-2 ring-white">
          <Icon name="pin" size={14} />
        </span>
      </div>
      <div className="absolute left-[17%] top-[28%] mt-4 max-w-[45%] -translate-x-1/2 translate-y-3 truncate rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200">
        {donorName}
      </div>

      {/* our dock */}
      <div className="absolute bottom-[28%] right-[17%] translate-x-1/2 translate-y-1/2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          <Icon name="home" size={14} />
        </span>
      </div>

      <div className="absolute bottom-1.5 left-2 text-[10px] text-zinc-400">{timing}</div>
    </div>
  );
}

const NODE_TONE: Record<'urgent' | 'normal' | 'calm', { dot: string; num: string }> = {
  urgent: { dot: 'bg-red-500', num: 'text-red-600' },
  normal: { dot: 'bg-zinc-900', num: 'text-zinc-950' },
  calm: { dot: 'bg-emerald-500', num: 'text-emerald-700' },
};

interface StatusBucket {
  n: number;
  label: string;
  tone: 'urgent' | 'normal' | 'calm';
}

/** Food Out: today's real outbound status as three independent, honest
 *  counts — not a fabricated single-item journey (our domain only tracks
 *  pending vs. released; there's no real "packed" or "ready" checkpoint). */
export function OutboundStatusBoard({ buckets }: { buckets: StatusBucket[] }) {
  return (
    <div className="flex h-28 flex-col justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4">
      <div className="flex items-center justify-between">
        {buckets.map((b) => (
          <span
            key={b.label}
            className={cn(
              'nums w-16 text-center text-xl font-bold',
              b.n > 0 ? NODE_TONE[b.tone].num : 'text-zinc-300',
            )}
          >
            {b.n}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex items-center">
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
      <div className="mt-1.5 flex items-center justify-between">
        {buckets.map((b) => (
          <span
            key={b.label}
            className="w-16 text-center text-[10px] leading-tight text-zinc-500"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
