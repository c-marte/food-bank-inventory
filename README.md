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

- **Shelf** (`Home`) — one urgent headline, then a **two-tile summary**
  (`FlowTiles`): **Food In** / **Food Out**, side by side, **mirrored row for
  row** so the two cards read as one language: header, KPI, metadata, visual
  anchor, footer — same structure, same typography, on both sides. `TriageBar`
  stays headline-only — one elevated fact ("Baby Spinach expires today"), no
  repeated counts, since those live on the tiles. The rich status — the
  **decay timeline**, **Move first**, **Low stock** — is one tap away behind
  **"View the full shelf"** (reference, not the daily driver).

  - **Header** — the tile's title (`TileHeader`) is itself the click-through:
    hovering "Food in" / "Food out" reveals a chevron and a hover state, and
    clicking navigates to Intake / Distribution. Replaces a separate "View
    intake" / "View distribution" link — one affordance instead of two.
  - **KPI row** — 2 (Food In) or 3 (Food Out) equal-size number+label blocks,
    identical typography (`Count`, always plain black — no urgency color on a
    tile's hero number; color is reserved for status elsewhere, like tier
    marks). Food In's are **tabs** (`MetricTab`): **pickups (we go)** vs.
    **deliveries**, never lumped (a delivery is the donor coming to us; a
    pickup is one of ours driving out — same "expected" status, opposite
    direction), and clicking one swaps the metadata + map below it. Pickup is
    the default. Food Out's are static (`KpiBlock`) — Pack / Match / Handoff —
    the same counts that used to live inside the visual anchor, promoted up so
    both tiles' KPI rows match in structure and height.
  - **Metadata** — a fixed-height row (`min-h-14`) on both tiles, sized for the
    tallest case (Food In's delivery tab, which adds a **cross-check item
    list** — `CrossCheckItems`: "12 Wheat Bread · 15 Bananas · 6 Whole Milk" —
    so the receiver can verify what arrives against what was promised, and
    deliberately **no avatar**, since anyone can receive a delivery; only a
    pickup has one specific person who has to go get it, so pickup keeps its
    `TeamBadge`). Fixed height means neither tile's metadata row changes size
    as its content changes, keeping the rows mirrored underneath it too.
  - **Visual anchor** — `flex-1`, so it absorbs whatever height difference is
    left once the rows above it are equal, and both tiles end up the same
    overall height automatically (no manual height math). Food In:
    `DeliveryOriginMap`, a static, non-live **origin → dock illustration** — a
    pinned donor name, an abstract dashed route (no fabricated street data), a
    home glyph, a direction chip ("DROP-OFF" / "WE PICK UP"). Modeled on
    package-tracking UIs (Shop, Klarna) but deliberately **not** live GPS — we
    have no real-time position, so a moving dot would be a lie the interface
    tells. Food Out: `OutboundStatusBoard`, now just the **Pack → Match →
    Handoff connector** (dot-line-dot, owner names underneath) — the counts
    moved to the KPI row above, so nothing is shown twice. A literal 4-node
    per-item tracker (Selected → Packed → Ready → Released) was considered
    and rejected first: our domain only has two real states per record
    (pending, released), so a 4-stage per-item stepper would have invented
    progress that didn't
    exist. Building the real Pack/Match/Handoff pipeline (below) resolved that
    honestly instead of faking it.
- **Intake** (`IntakePage`) — food IN, split the same way as the tile:
  **Deliveries** and **Our pickups** as two labeled lists (`IncomingDeliveries`),
  each row showing the assigned team member's avatar. The two capture paths
  (dictate / photo) still feed the promise sheet.
- **Distribution** (`DistributionPage`) — food OUT as a **pipeline of
  movements**, not a log of instants:

  ```
  ① PACK     box it / stage it cold           (owner: packer)
  ② MATCH    find a taker — call the list     (owner: caller)
  ③ HANDOFF  they pick up, or we deliver      (owner: driver/receiver)
  ```

  Stage is **derived** from what's missing (`getMovementStage`), never stored —
  house rule. Three doors in: a **partner/family request** is born *matched*
  (the caller told us who); a **decay push** (dying lots, `getDyingLots`) is
  born *unmatched* — the real "volunteer calls the shelters" moment the old
  instant-release model skipped entirely; a **FEFO box** (`buildFefoBox`) is
  born *packed*. Pack and Match **reserve nothing** — consistent with "requests
  reserve nothing, first-commit-wins." **Completing the handoff is the single
  commit point** (`completeHandoff`, rule 2): referenced lots decrement,
  clamped, expired ships 0, shortfall named in the reminder — the outbound
  mirror of the dock. Recipient kind sets the trip default (kitchens → we
  deliver; families → pick up here), adjustable per movement. `PickupRequest`
  and `DistributionRecord` are retired — a request is just a movement born
  matched, so there's one model for push, box, and order instead of two half
  models of the same physical reality.
- **Inventory** (`LotList`) — the ledger (reached from a Shelf card, not the
  top nav): every lot, statuses mixed, an **Expired only** filter, zero-quantity
  kept and de-emphasized.

### People — who owns the trip

A seeded roster (`TeamMember`, `SEED_TEAM`: Maya, Dan, Jo) makes accountability
visible without auth: every delivery and movement carries an optional
`assigneeId`. **Our people get one avatar treatment reserved for them** — a
colored initials circle (`TeamAvatar`/`TeamBadge`, deterministic palette, not a
hash-to-hue) — so a glance at a colored circle always means "one of ours is on
this." Partners, donors, and family recipients stay plain text; the contrast is
the point. Every trip also carries a **`TransportMode`** (`they_come` /
`we_go`) — the direction of physical movement, since a donation pickup, a
catering-surplus pickup, a grocery drop-off, and a partner delivery are all the
"same" event type but opposite directions, and conflating them was the bug
this fixed.

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
