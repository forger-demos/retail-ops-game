# PAINT RUSH

A short browser demo for an executive audience about what on-site paint mixing costs a shop. While staff mix tins to order they are off the floor, and walk-ins who find nobody to serve them leave. The demo replays one shift as it runs today, then the same shift with large orders sent to a central hub, and ends on the sales saved.

It is drawn on a 160x144 screen in four shades of green, scaled up by whole pixels. All art and sound are original. See [docs/plan-paint-rush.md](docs/plan-paint-rush.md) for the plan and [GLOSSARY.md](GLOSSARY.md) for the vocabulary.

## Run

Needs [Bun](https://bun.sh).

```sh
bun install
bunx playwright install chromium   # once, for the browser tests
bun run dev                        # http://localhost:3107
```

## Check

```sh
bun run check   # typecheck, lint, build, unit tests, then browser tests against the build
```

`bun run test` runs the unit tests (`src/**/*.test.ts`) and the Playwright tests (`tests/e2e/`); the browser tests open the built file, so build first.

## Simulate

```sh
bun run sim                  # both scenarios' metrics for the default seed, as a table
bun run sim --json --seed 7  # the same as JSON, for another seed
```

The simulation is pure and seeded: the same seed and parameters always give the same shift, and the today and hub runs of one seed share their arrivals.

## Build and present

```sh
bun run build
```

This writes `dist/paint-rush.html`, one self-contained file with every script, style and asset inlined. Copy it to the presenting laptop and open it straight from disk (file://); it needs no network or server. Make the browser full screen and press SPACE to advance.

SPACE walks the pitch: the title, today's replay, today's results, the same day with the hub, then the comparison of the two with the sales saved per day, week, year and across the estate. During a replay SPACE skips to the next narration beat. At the comparison SPACE replays the same day and R reshuffles it (the next seed). On a phone or tablet a tap anywhere on the screen does what SPACE does, the prompts read TAP, and a RESHUFFLE button appears at the comparison; taps closer together than a double tap count once. Each screen's text is also written to a visually hidden live region.

To open a step directly, for rehearsal, add `?scene=` to the URL: `shop` for a replay (with `&scenario=hub` for the hub run and `&minute=<shop minute>` to start part-way through), `results` for today's results, `comparison` for the comparison. `&seed=<n>` picks the day.

## Layout

- `src/sim/` - the simulation: parameters, seeded arrivals, the event engine, the timeline, its metrics and their extrapolation to a year and the estate. Imports nothing from the DOM or the renderer.
- `src/render/` - the screen, palette, font, sprites, the text box, and the pure replay state and narration derived from a timeline.
- `src/scenes/` - what is drawn on each screen.
- `src/flow/` - the order of the pitch, the deep links into it, and the input actions that keys, taps and buttons share, all pure.
- `src/styles/tokens.css` - the four colours; the only file that writes a colour.
