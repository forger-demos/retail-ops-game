# Plan - PAINT RUSH

## Goal

Give the executive team a short, memorable demonstration of what on-site paint mixing costs a shop. While a staff member mixes tins to order they are off the shop floor, and walk-ins who find nobody to serve them leave. The demo plays one shift as it is today, then the same shift with the proposal: orders over 5 tins go to a central hub that prepares them and delivers within 2 hours. It ends on the sales saved, scaled to a year and to the estate.

## In scope

- An 8-bit look in the style of the original Game Boy: four greens, pixel sprites, dialogue text boxes. All art and sound original.
- Autoplay by default, narrated by the presenter; SPACE advances. An optional take-control mode.
- A deterministic simulation (seeded) shared by both runs, so the only difference is where large orders are mixed ([ADR 0001](adr/0001-same-seed-comparison.md)).
- Time compressed so one tin (5 shop minutes) takes 1 real second, adjustable ([ADR 0002](adr/0002-time-scale.md)).
- Every parameter editable in a settings menu.
- A single offline HTML file to present from a laptop.

## Out of scope

- Cost of central preparation and delivery; the comparison says it excludes them.
- Peak-time patterns; arrivals are steady across the shift.
- Real store data feeds; parameters are entered by hand.

## Defaults

The settings menu starts from these values; the owner edits them in the demo.

- Shift: 8 hours. Time scale: 1 s = 5 min.
- Staff on the floor: 1 (1-4).
- Walk-ins: 10 per hour, served in 4 minutes, average sale GBP95, patience 10 minutes.
- Mix orders: 3 per hour; 5 minutes per tin, whatever the size.
- Order size: 1 tin 55%, 2-3 tins 25%, 4-5 tins 12%, 6-12 tins 8%.
- Tin prices: 750ml GBP45, 2.5L GBP85, 5L GBP120. Tin size split: 750ml 15%, 2.5L 40%, 5L 45% (average near GBP95).
- Hub threshold: orders over 5 tins. Hub delivery: 2 hours.
- Stores and trading days per year: set for the extrapolation.

## Build order

1. `scaffold` - gates, canvas, offline build.
2. `sim-engine` - the model, tested, with a JSON command.
3. `shop-scene` - the replay (wireframe approval first).
4. `two-run-results` - the full pitch flow (wireframe approval first).
5. `settings` - editable parameters (wireframe approval first).
6. `take-control` and `chiptune-sound` - polish, in either order.

## Progress archive

Superseded wireframes, screenshots and other visual artefacts are not deleted; they move into `docs/progress/` in running order, so the folder tells the story of the build. See [docs/progress/README.md](progress/README.md).

## Open questions

- Real share of orders over 5 tins; the default is a placeholder until the owner supplies it.
- Number of stores and trading days for the extrapolation.
