import type { LotStatus, PerishTier } from '../domain/types';
import { parseLocalDate } from '../domain/dates';

/** Tier display metadata. Shape (icon) carries the handling class; color is
 *  reserved for STATUS, so tiers stay monochrome and never collide with the
 *  red/amber/green urgency system. */
export interface TierMeta {
  short: string;
  label: string;
  iconKey: 'flame' | 'snowflake' | 'box';
  order: number;
}

export const TIER_META: Record<PerishTier, TierMeta> = {
  prepared: { short: 'EAT NOW', label: 'Eat now', iconKey: 'flame', order: 0 },
  fresh: { short: 'KEEP COLD', label: 'Keep cold', iconKey: 'snowflake', order: 1 },
  shelf_stable: { short: 'SHELF', label: 'Shelf-stable', iconKey: 'box', order: 2 },
};

/** Dense clock label for a day-count column: TODAY, +1d, -2d. */
export function shortDayLabel(days: number): string {
  if (days === 0) return 'TODAY';
  if (days > 0) return `+${days}d`;
  return `${days}d`; // negative sign already present
}

/** 'Jul 6' */
export function fullDateLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** 'Sat, Jul 5' */
export function weekdayDateLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type IconKey = 'x' | 'alert' | 'check';

export interface StatusMeta {
  label: string;
  iconKey: IconKey;
  bar: string; // marker background
  text: string; // foreground text
  soft: string; // soft background for badges
  ring: string; // ring/border color
}

/** The one status system, used everywhere. Every use pairs COLOR with an ICON
 *  and a TEXT label — never color alone. */
export const STATUS_META: Record<LotStatus, StatusMeta> = {
  expired: {
    label: 'EXPIRED',
    iconKey: 'x',
    bar: 'bg-red-600',
    text: 'text-red-700',
    soft: 'bg-red-50',
    ring: 'ring-red-200',
  },
  expiring_soon: {
    label: 'EXPIRING',
    iconKey: 'alert',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    soft: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  ok: {
    label: 'OK',
    iconKey: 'check',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50',
    ring: 'ring-emerald-200',
  },
};
