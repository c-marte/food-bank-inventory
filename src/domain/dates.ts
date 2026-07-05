import type { ISODate } from './types';

// ---------------------------------------------------------------------------
// Calendar-date arithmetic in LOCAL time.
//
// The one bug this module exists to prevent: `new Date('2026-07-04')` parses
// as UTC midnight, which in any timezone west of UTC renders as the *previous*
// day. That single off-by-one makes every expiry status wrong by a day.
//
// So we NEVER construct a Date from an ISO string. We split the string and
// build the date from its components with `new Date(year, month - 1, day)`,
// which is interpreted in local time.
// ---------------------------------------------------------------------------

/** Parse 'YYYY-MM-DD' as a LOCAL midnight Date via components. Never via string. */
export function parseLocalDate(iso: ISODate): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a Date as a local 'YYYY-MM-DD' string (component-based, no UTC). */
export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today, as a local 'YYYY-MM-DD' string. Call this ONCE at app start and thread
 *  the result through logic functions — never call it inside them. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/**
 * Whole calendar days from `today` to `expiry`.
 *   0  = expires today
 *   1  = expires tomorrow
 *  -1  = expired yesterday
 *
 * Implemented by parsing both as local midnights and dividing the millisecond
 * difference by one day. Math.round guards the ±1 hour that DST transitions
 * introduce into an otherwise whole-day difference.
 */
export function daysUntil(expiry: ISODate, today: ISODate): number {
  const MS_PER_DAY = 86_400_000;
  const from = parseLocalDate(today).getTime();
  const to = parseLocalDate(expiry).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** Add (or subtract) whole days to an ISO date, returning an ISO date.
 *  Used to author seed data relative to today. */
export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Human-friendly relative label for a day count. */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
