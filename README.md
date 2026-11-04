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

## Build and present

```sh
bun run build
```

This writes `dist/paint-rush.html`, one self-contained file with every script, style and asset inlined. Copy it to the presenting laptop and open it straight from disk (file://); it needs no network or server. Make the browser full screen and press SPACE to advance.

## Layout

- `src/render/` - the screen, palette, font and sprites.
- `src/scenes/` - what is drawn on each screen.
- `src/styles/tokens.css` - the four colours; the only file that writes a colour.
