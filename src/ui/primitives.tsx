import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LotStatus } from '../domain/types';
import { STATUS_META, type IconKey } from './format';
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
  | 'clock',
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
