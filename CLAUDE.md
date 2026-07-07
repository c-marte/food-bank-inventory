# Shelf — food bank inventory prototype

Take-home design exercise. React + TypeScript + Vite + Tailwind, Motion for animation, Leaflet + react-leaflet (CARTO Positron muted basemap, no API key) for a real interactive map. No backend — everything is in-memory + localStorage, seeded relative to `today`.

## Scope lock (read this first)

**Only Food In (intake) is active scope right now.** The original brief covered three goals — tracking donations, managing stock, coordinating pickups — and we deliberately narrowed to one: **tracking incoming food donations**, specifically the two intake types:
- **Pickups** — we drive out to collect (e.g. catering surplus)
- **Deliveries** — the donor brings it to us

**Inventory management (Move First / Low Stock / decay timeline) and Food Out (Distribution, the Pack→Match→Handoff pipeline) are feature-frozen.** They exist, work, and are tested — don't redesign or "improve" them unless explicitly asked. Effort goes into `FoodInPanel.tsx` and its supporting pieces.

## Non-negotiable honesty principles

These were each earned by rejecting a more obvious, dishonest alternative. Do not reintroduce the rejected version by default when adding a "nice" feature:

- **No fabricated live position.** The map shows two static points (donor, our dock) + a straight dashed connector, never a moving vehicle / live GPS dot. We have no real-time courier data.
- **No fabricated travel times.** No inline "walk 12m · drive 5m" chips — that needs a routing API we don't have. Instead: a real "Get directions" deep-link into Google Maps (which computes real times) + a QR code so a volunteer can scan it to their phone.
- **No clock-time ETAs.** The entire date module is calendar-days-only (`daysUntil`, local-date parsing) — this is load-bearing, not a limitation. "Expected" is a human-entered window (e.g. "by 3pm" from the donor's own words), never a computed/tracked ETA.
- **No fabricated multi-stage progress.** The delivery stepper (Scheduled → En route → Received) is *derived* from real fields (`expectedDate` vs `today`, `status`) every render — never stored, never invented intermediate states like "preparing."
- **Team avatars (`TeamAvatar`, colored initials) are reserved for our people only** — volunteers/staff. A courier or donor contact must get a visually distinct (neutral/outline) treatment, or the "colored circle = one of ours" signal breaks.
- **No mixed-unit totals.** Never sum "6 gallons + 12 loaves + 3 cans" into a fake "units delivered" number. Count records (lots, deliveries), don't sum incompatible quantities.

## Key files (Food In)

- `src/components/FoodInPanel.tsx` — the main surface. Full-width, left column = pickup/delivery toggle + donor list, right column = map + detail.
- `src/components/DeliveryTrackerMap.tsx` — the real Leaflet map + the derived arrival stepper.
- `src/domain/deliveries.ts` — `getDeliveryStage`, receive logic.
- `src/data/geo.ts` — donor/dock coordinates (seed-only, fictional but real-feeling lat/lngs).
- `src/data/seed.ts` — all seed data, authored relative to `today` (never hardcoded absolute dates).
- `src/domain/types.ts` — `Delivery`, `DeliveryItem`, `TransportMode` (`they_come` / `we_go`).

## Pending task (not yet built)

Rework `FoodInPanel`'s right-hand detail panel so pickup and delivery are **bespoke, not sharing one template**:
- **Pickup:** no stepper (it's awaiting *our* initiative, not tracking an inbound journey). Show "Ready for pickup" + map + **"Get directions"** (Maps deep-link) + a **QR code** encoding that link ("scan to open on your phone").
- **Delivery:** keep the stepper. Add an **expected window** (human string, not a computed ETA), a **summarized manifest** that expands to full detail, and a **courier block** (neutral avatar + name + "courier" label + `tel:` phone link — NOT `TeamAvatar`). Keep the **Receive** CTA (pickup does not get this CTA — its job is "go get it," not "receive at the dock").
- New dep needed: `qrcode` (renders locally, no network call).
- Left column: replace the big hero-count KPIs with a simple `[Pickups · n] [Deliveries · n]` toggle → always-visible donor list for the active type → **"View all in Intake →"** tertiary link.

## Where the full history lives

`git log` has ~20 commits, each with a detailed rationale paragraph (why a design was rejected, what honesty tradeoff was made). `README.md` is kept current with the same reasoning at a project level. Prefer reading those over asking for a recap — they're more complete than any chat summary would be.
