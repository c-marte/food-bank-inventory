import type { LotStatus } from '../domain/types';
import { parseLocalDate } from '../domain/dates';

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
