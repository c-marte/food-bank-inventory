import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * Food Out's visual anchor. Food In's used to live here too (a stylized,
 * non-live illustration), but it's now DeliveryTrackerMap.tsx — a real,
 * interactive Leaflet map, since Food In is where this build's remaining
 * polish is going. Food Out deliberately keeps its simpler treatment: no
 * real multi-stage fulfillment pipeline exists to track (a movement is
 * pending, then released — that's the whole state machine), so the status
 * board stays an AGGREGATE of today's real, independent counts, not a
 * fabricated per-item journey.
 * ───────────────────────────────────────────────────────── */

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
