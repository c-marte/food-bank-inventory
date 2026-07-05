import type { Transition } from 'motion/react';

/* ─────────────────────────────────────────────────────────
 * MOTION STORYBOARD — mutations should be felt, not just happen.
 *
 * Every animation in the app expresses one of two ideas, and only
 * fires on a real state change (a donation logged, a pickup confirmed):
 *
 *   reflow  — a lot leaves the expiring zone, a category enters/leaves
 *             low stock, a request reorders. The list closes the gap
 *             with a calm spring so the change reads.
 *   pop     — a headline number swaps (8 → 7 expiring) or the reminder
 *             line arrives. A slightly bouncier spring draws the eye.
 *
 * Spring-first (no duration easing). Values are tuned by feel; adjust
 * `visualDuration` for speed and `bounce` for liveliness.
 * All of it collapses to instant under prefers-reduced-motion via the
 * <MotionConfig reducedMotion="user"> at the app root.
 * ───────────────────────────────────────────────────────── */

export const SPRING = {
  reflow: { type: 'spring', visualDuration: 0.28, bounce: 0.16 },
  pop: { type: 'spring', visualDuration: 0.34, bounce: 0.32 },
} satisfies Record<string, Transition>;
