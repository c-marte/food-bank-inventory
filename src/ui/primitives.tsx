import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LotStatus, PerishTier } from '../domain/types';
import { STATUS_META, TIER_META, type IconKey } from './format';
import { cn } from './cn';

// ---------------------------------------------------------------------------
// Icons — small inline SVGs (no icon dependency). currentColor, 2px stroke.
// ---------------------------------------------------------------------------
const ICON_PATHS: Record<
  | IconKey
  | 'plus'
  | 'minus'
  | 'reset'
  | 'arrow'
  | 'edit'
  | 'trash'
  | 'chevron'
  | 'inbox'
  | 'clock'
  | 'mic'
  | 'camera'
  | 'flame'
  | 'snowflake'
  | 'box'
  | 'truck'
  | 'pin'
  | 'home'
  | 'user'
  | 'phone',
  ReactNode
> = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alert: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  edit: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  chevron: <path d="M9 18l6-6-6-6" />,
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  // Tier marks — shape carries the handling class (color reserved for status).
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  snowflake: (
    <>
      <path d="M2 12h20M12 2v20" />
      <path d="m4.93 4.93 14.14 14.14M19.07 4.93 4.93 19.07" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </>
  ),
  truck: (
    <>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </>
  ),
  phone: (
    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
  ),
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: keyof typeof ICON_PATHS;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status cues — always color + icon + text.
// ---------------------------------------------------------------------------

/** Full badge: colored soft chip with icon + label. */
export function StatusBadge({ status }: { status: LotStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        'eyebrow inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ring-1',
        m.soft,
        m.text,
        m.ring,
      )}
    >
      <Icon name={m.iconKey} size={11} />
      {m.label}
    </span>
  );
}

/** Vertical color bar used as a row marker (paired with text elsewhere). */
export function StatusBar({ status }: { status: LotStatus }) {
  return (
    <span
      className={cn('w-1 shrink-0 self-stretch rounded-full', STATUS_META[status].bar)}
      aria-hidden="true"
    />
  );
}

/** Handling-class mark: a shape (not a color) plus an optional label. The one
 *  per-item visual asset that's job-critical — how to store it, how fast to
 *  move it. Prepared reads slightly heavier since it's the urgent tier. */
export function TierMark({
  tier,
  showLabel = false,
  size = 13,
  className,
}: {
  tier: PerishTier;
  showLabel?: boolean;
  size?: number;
  className?: string;
}) {
  const m = TIER_META[tier];
  const tone = tier === 'shelf_stable' ? 'text-zinc-400' : 'text-zinc-600';
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1', tone, className)}
      title={m.label}
    >
      <Icon name={m.iconKey} size={size} />
      {showLabel && (
        <span className="eyebrow text-[10px] font-bold tracking-wide">{m.short}</span>
      )}
    </span>
  );
}

/** Tier mark inside a neutral circle — the marker used on the timeline and as a
 *  row avatar, replacing the food emoji. */
export function TierChip({ tier, size = 32 }: { tier: PerishTier; size?: number }) {
  const m = TIER_META[tier];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 ring-1 ring-zinc-200"
      style={{ width: size, height: size }}
      title={m.label}
      aria-label={m.label}
    >
      <Icon name={m.iconKey} size={Math.round(size * 0.5)} />
    </span>
  );
}

// A fixed palette (not a hash-to-hue) so colors stay visually consistent and
// legible — deterministic per id, but never a muddy or clashing hue.
const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-800',
  'bg-teal-100 text-teal-700',
];

function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * OUR people — volunteers and staff — get a colored initials circle. This is
 * the one avatar treatment in the app, and it's deliberately reserved for our
 * team: partners, donors, and family recipients stay plain text, so a glance
 * at a colored circle always means "one of ours is on this."
 */
export function TeamAvatar({
  id,
  name,
  size = 22,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        avatarTone(id),
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + first name, the compact "who owns this" chip used in rows. */
export function TeamBadge({ id, name }: { id: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 py-0.5 pl-0.5 pr-2 ring-1 ring-zinc-200">
      <TeamAvatar id={id} name={name} size={18} />
      <span className="text-[11px] font-medium text-zinc-700">
        {name.split(' ')[0]}
      </span>
    </span>
  );
}

/** Whoever the DONOR sent to hand off a delivery — a courier, not one of
 *  ours. Deliberately outline/neutral, never the colored TeamAvatar circle,
 *  so that signal stays reserved for our own team (see TeamAvatar above). */
export function CourierBadge({ name, phone }: { name: string; phone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pl-0.5 pr-2 ring-1 ring-zinc-300">
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 ring-1 ring-inset ring-zinc-200">
        <Icon name="user" size={10} />
      </span>
      <span className="text-[11px] font-medium text-zinc-600">{name}</span>
      <span className="eyebrow text-[9px] font-bold text-zinc-400">COURIER</span>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-zinc-400 transition-colors hover:text-zinc-700"
          aria-label={`Call ${name}`}
        >
          <Icon name="phone" size={11} />
        </a>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout bits.
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn('rounded-lg border border-zinc-200 bg-white', className)}
    >
      {children}
    </section>
  );
}

/** `EXPIRING SOON ─────────────` header with an optional right slot. */
export function SectionHeader({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="eyebrow text-xs font-bold text-zinc-950">{children}</h2>
      <div className="h-px flex-1 bg-zinc-200" />
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function EmptyCard({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
      {icon}
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls.
// ---------------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';
  const sizes = {
    sm: 'h-8 px-2.5 text-[13px]',
    md: 'h-10 px-3.5 text-sm',
    lg: 'h-12 px-5 text-base',
  };
  const variants = {
    primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
    outline: 'border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

/** Selectable pill (category chips). */
export function Chip({
  selected,
  className,
  ...props
}: ButtonProps & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1',
        selected
          ? 'border-zinc-950 bg-zinc-950 text-white'
          : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500',
        className,
      )}
      {...props}
    />
  );
}

export const inputClass =
  'h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10';

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="eyebrow mb-1.5 block text-[11px] font-semibold text-zinc-500"
      >
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

/** Compact −/＋ stepper with a tabular number. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  size = 'md',
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  const box = size === 'sm' ? 'h-8 min-w-9 text-sm' : 'h-11 min-w-12 text-base';
  const btn =
    'inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950';
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={cn(btn, dim)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Icon name="minus" size={size === 'sm' ? 14 : 16} />
      </button>
      <span
        className={cn(
          'nums inline-flex items-center justify-center px-1 font-semibold text-zinc-950',
          box,
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={cn(btn, dim)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase"
      >
        <Icon name="plus" size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  );
}
