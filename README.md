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
  `src/store/useUI.tsx` holds shell state: which spoke is visible, which sheet
  is open.

### IA: the standing picture + two verbs

Nav is **Shelf · Intake · Distribution** — the two operational verbs (food in,
food out) plus the standing picture (the Mercury home pattern: status is the
page, flows are the buttons; tabs, not a sidebar, because nav chrome should
match destination count). "Pickup" was **retired** — it's directionally
ambiguous (a volunteer picks up *from* a vendor = intake; a partner picks up =
distribution).

- **Shelf** (`Home`) — status + entry points. The action row (*Expect a
  delivery*, *Log a request*, *Walk-in*), then **Act first** (`TriageBar`): the
  single most urgent lot as a tappable headline, plus counts with paths
  (expired → filtered ledger, arriving → Intake, to-release → Distribution).
  Then the clock in two readings: the **decay timeline** and **Move first**
  (time buckets + a **time-to-zero bar** per lot), **Low stock** beside it.
  Three summary cards jump to Intake / Distribution / Inventory.
- **Intake** (`IntakePage`) — food IN: the two capture paths and the incoming
  queue (`IncomingDeliveries`).
- **Distribution** (`PickupsQueue`) — food OUT, **decay-forward** (the outflow
  mirror of decay-forward intake — the shelf leads instead of waiting for a
  request):
  - **Move it out** — dying lots (`getDyingLots`), soonest first; one tap
    **Sends** to a **meal program** (kitchens only — routed by `Partner.kind`).
  - **Family box** — the app builds a **FEFO** box (`buildFefoBox`:
    soonest-expiring groceries, one per category, prepared excluded → it goes to
    kitchens); **Pack** releases FEFO and tallies households served.
  - **Partner orders** — standing requests; **Release** confirms them.
  All paths go through `releaseLots` (immediate, rule 2: decrement, clamped,
  never ships expired) and log a `DistributionRecord` → the "N households, M lots
  out today" tally.
- **Inventory** (`LotList`) — the ledger (reached from a Shelf card, not the
  top nav): every lot, statuses mixed, an **Expired only** filter, zero-quantity
  kept and de-emphasized.

### Perishability tiers — the axis the job turns on

Every lot carries a **handling tier** (`PerishTier`: prepared / fresh /
shelf_stable) distinct from its grocery `category` — a chicken tray, frozen
chicken, and canned tuna are all "protein" but three different tiers. Tier is
inferred at capture (`inferTier`) and verified at the dock. It drives a
**tier-aware expiring window** (`getLotStatus`: a prepared tray is "soon" at
1–2 days, a can only within weeks), and it's the one per-item visual asset —
rendered as a monochrome **tier mark** (flame / snowflake / box; shape carries
the semantic so color stays reserved for status). Section groups get one brand
icon (a truck on Intake). No per-food emoji — assets are semantic, not
decorative.

### The verb layer

Every lot, everywhere it appears — timeline marker, Move-first row, ledger
row, the Act-first headline — opens the same **lot action sheet**
(`LotActionSheet`) with three verbs mapping to physical reality:

| Physical act | Verb | Behavior |
|---|---|---|
| "Call a partner, move it" | **Send to partner** | Opens Record pickup **prefilled** with the lot; disabled for expired (never ships) |
| "Pull it, toss it" | **Mark as waste** | **Partial allowed** (half the bananas can be fine), clamped, records a `WasteEvent` — spoilage is the #1 success metric and unrecorded waste can't be measured (`domain/waste.ts`, pure + tested) |
| "Count is off" | **Adjust quantity** | Correction only; no waste record |

### Deliveries (food in) — promise → verify → create

Real donations don't start at the dock from zero — the **phone call is the
manifest**. Grocery rescue, catering surplus, and food-bank allocations are all
*known before they arrive*; the one thing that genuinely can't be known until the
dock is the **expiry date printed on the physical item**. So intake is designed
as **"automate the transcription, keep the human at the verification."**

Deliveries are the exact **mirror of Pickups**:

| | Promise | Commit | Effect on lots |
|---|---|---|---|
| **Pickup** (out) | `requested` | Confirm | **decrements** referenced lots |
| **Delivery** (in) | `expected` | Receive | **creates** one new lot per line |

- **Expect a delivery** (`ExpectDeliverySheet`) — the 10-second call capture,
  genuinely rough: donor (one-tap chips for recurring sources), when, and
  **just a name + count** per line. Category is inferred silently
  (`guessCategory`) and expiry guessed from it (`categoryDefaultExpiry`) —
  neither is shown or asked here, so precision isn't done twice.
- **Incoming** (`IncomingDeliveries`, on Home) — expected promises, time-sorted.
- **Receive at the dock** (`ReceiveDeliverySheet`) — the one human checkpoint,
  and it now *looks* like one: every inferred category and guessed best-before
  renders with a visible **amber "guessed" state** (a ring + a one-tap confirm
  affordance) that clears the instant the volunteer confirms or edits it —
  turning to a quiet emerald "verified." A running "N guessed fields
  unconfirmed" caption sits by the submit button, so the checkpoint is
  something you can *see*, not just something the architecture claims exists.
  Confirm/edit counts, verify against the printed label, toss what's unusable,
  add surprises, then `receiveDelivery` creates a new lot per kept line
  (rule 1: never merged). Pure + tested.

#### Capture layer — automate the transcription, not the verification

The promise can be drafted from a **dictation** or a **photo of the manifest**
(`CaptureBar`), because the phone call / the slip *is* the data. The
speech-to-text and photo-OCR are **simulated** (a typewriter transcript, a
canned "read"); the part that matters — `parseDonation`, which turns a sentence
like *"6 trays of baked ziti, 24 turkey sandwiches good till tomorrow"* into
structured lines with inferred category and a date hint — is **real and tested**
(handles number words, "a dozen", unit-vs-name disambiguation, relative expiry).
Capture only ever produces a **draft**; every line is still verified at the dock,
so a bad guess is caught, never shipped. That's the honest framing that keeps it
from being a gimmick.

The walk-in fast form survives as the demoted exception (a ghost "Walk-in"
button) — it's the only inflow that truly starts at zero. *Conceptual-range note:
a weigh-only "no item entry" concept was rejected precisely because it kills the
per-lot expiry clock — the one thing the product exists to protect.*

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
