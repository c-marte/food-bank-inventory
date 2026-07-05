# Shelf — pantry inventory

A lightweight, decay-forward inventory tool for a small, single-site,
volunteer-run food bank. **One glance tells the truth about the shelves, with
the clock running on every item shown first.**

Built as a take-home design exercise. React + TypeScript + Vite + Tailwind +
Motion, no backend — all state is in-memory React state seeded from a constants
file, with a reset-to-seed control and same-day `localStorage` mirroring.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # 40 assertions (dates, status, zones, confirm/decrement)
npm run build    # type-check + production build → dist/ (static, Vercel-ready)
```

The app always loads populated. **Reset** restores the seeded demo state.

## The scope decision: one surface

Early versions had three role-switched views (Volunteer / Staff / Partner).
That was breadth pretending to be architecture, and it was cut deliberately:

- **Volunteer intake isn't a persona — it's an action.** At a small pantry the
  same person wears multiple hats across a shift, so "Log donation" is the
  header's primary button, opening a fast sheet over the dashboard.
- **The partner isn't a surface — it's an input.** Partners coordinate
  informally (they call or text); staff records the request ("Record pickup")
  and confirms it when the food leaves. Building a partner-facing storefront
  would have been a second product.

What remains is one operating surface for the person who holds the shelves:
**one surface, two mutations (food in, food out), one clock.** In production,
sign-in would land the shelf-keeper here directly — there is no role UI to fake.

## The 60-second demo

1. **Log donation** (header) → name, tap a category chip, quick-set an expiry
   (`+3d`), Add. It becomes a **new lot** and lands in the clock behind the
   sheet immediately.
2. **Move first** (the clock) → Today / Tomorrow / This week buckets, each lot
   with a time-to-zero bar draining toward death. Readable without reading.
3. **Record pickup** (Pickups card) → choose a partner, pick lots (soonest
   expiry first, capped at what's on hand) → it joins the queue as REQUESTED.
4. **Confirm** → the referenced lots **decrement** (watch the zone reflow and
   the triage numbers spring), and a single `Reminder queued: …` line renders.
   Confirm the seeded Hope Street request (6 bananas when only 5 remain after
   Northside) to see **partial fulfillment** with the shortfall named.

## Two invariants (one-way doors, honored from the first commit)

1. **Lot, not item.** Every intake event appends a **new** `InventoryLot`, even
   when the name already exists — two donations of the same food can carry
   different expiry dates and must never be merged. Grouping by name is a
   display concern only. Enforced in `store/useStore.tsx` (`ADD_DONATION` only
   ever appends) and visible in the UI (two `Whole Milk` lots, two `Sweet Corn`
   lots).
2. **Confirm decrements.** Confirming a pickup reduces the referenced lots'
   quantity, clamped at zero. A confirm that doesn't decrement shows phantom
   stock — the exact failure this product prevents. Enforced in
   `domain/requests.ts` (`confirmRequest` returns a new lots array with
   decrements applied). Requests reserve nothing; first confirm wins the stock.

## Date correctness (the highest-risk bug)

All date logic is calendar-date arithmetic in **local** time on `'YYYY-MM-DD'`
strings. `daysUntil` parses via components — `new Date(year, month-1, day)` —
never `new Date(isoString)`, which would parse as UTC midnight and reintroduce
an off-by-one that makes every expiry status wrong by a day. `today` is passed
explicitly to every logic function (never `new Date()` inside them), so the demo
is deterministic and the seed is testable. The boundary assertions in
`domain/dates.test.ts` pin this, including DST spring-forward/fall-back guards.

## Architecture

- **`src/domain/`** — pure, framework-free logic. `dates`, `status` (per-lot
  status + per-category low-stock, kept separate), `dashboard` (the zones),
  `requests` (availability + confirm). Every function takes `(…, today, config)`
  and is covered by tests. **Status is derived at render, never stored.** The
  entire v3 UI rework shipped without touching this layer — the payoff of
  keeping it pure.
- **`src/data/seed.ts`** — 18 lots authored **relative to today** (`today+3`,
  `today-2`, …) spanning every status, plus a zero-quantity lot, shared-name
  lots, 2 partners, and 2 pending requests. The dashboard populates whenever
  the app is opened, on any date.
- **`src/store/useStore.tsx`** — the single client-side store (reducer +
  context). `today` captured once at load. Mirrors to `localStorage` same-day;
  re-seeds fresh on a new day so async reviewers always open to live data.
- **The surface** (`components/Dashboard.tsx`), top to bottom:
  - **Act first** (`TriageBar`) — the focusing layer: the single most urgent
    lot as a headline, then state-of-the-shelf counts.
  - **Move first** (`MoveFirstZone`) — the clock. Time buckets carry the
    "when" once; each lot gets a **time-to-zero bar** (days left vs. the 7-day
    window — nearly empty means nearly dead) plus a day glyph. No status pills
    here: the zone itself means "expiring."
  - **Low stock** — per-category, sum of non-expired quantity vs. threshold,
    lowest fill ratio first. Independent of the clock by design: a lot can be
    in both zones and that's two true facts, not a duplicate.
  - **Pickups** (`PickupsQueue` + `RecordPickupSheet`) — the outflow queue.
  - **Full inventory** (`LotList`) — the ledger: every lot, statuses mixed
    (badges allowed here), zero-quantity kept and de-emphasized as "0
    remaining," corrections behind a tap-to-reveal stepper.
- **Motion** (`ui/motion.ts`) — spring-first, and only on real mutations:
  the reminder springs in, zone rows reflow when a confirm drains a lot,
  triage numbers pop on change. Collapses to instant under
  `prefers-reduced-motion` via `<MotionConfig reducedMotion="user">`.
- **Accessibility** — status is always color **plus** icon/text/number, never
  color alone; large tap targets; visible focus rings; sheets close on Escape.

## Assumptions (locked in; flagged for discussion)

- Expiring window is **inclusive**: `daysUntil ∈ [0, 7]` is `expiring_soon`.
- Low-stock is **strictly** below threshold; at-threshold is not low.
- Requests **reserve nothing**; conflicts resolve at confirm (first-confirm-wins).
- A lot that expires between request and confirm ships **0** and is not
  decremented — the app never records handing out expired food.
- Over-request at confirm is **partial fulfillment**, not an error; the
  shortfall is named in the reminder.
- Partner coordination is informal at this scale, so staff records requests;
  a partner-facing availability page is the first thing I'd add back if the
  pantry outgrew phone-call coordination.

## Cut deliberately (per the brief)

Real auth and role UI, email/SMS delivery, barcode scanning, calendar
scheduling, analytics, multi-site/locations, offline mode, a standalone
activity feed. The reminder is one line, not a feed. Each cut is defended in
the PRD from the user's real needs.
