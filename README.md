# PAINT RUSH

A short browser demo for an executive audience about what on-site paint mixing costs a shop. While staff mix tins to order they are off the floor, and walk-ins who find nobody to serve them leave. The audience first plays two short rounds as the shop assistant, mixing every order in store and then sending large orders to a central hub. The demo then replays one whole shift as it runs today, the same shift with the hub, and ends on the sales saved.

It is drawn on a 160x144 screen in a limited 8-bit palette with real colour, inside a drawn handheld console, scaled up by whole pixels. All art and sound are original. The look is chosen in [docs/adr/0003-play-first-and-a-richer-palette.md](docs/adr/0003-play-first-and-a-richer-palette.md) and judged against the brief in [docs/plan-paint-rush-v2.md](docs/plan-paint-rush-v2.md). See [docs/plan-paint-rush.md](docs/plan-paint-rush.md) for the plan and [GLOSSARY.md](GLOSSARY.md) for the vocabulary.

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

The title offers two modes, PLAY (chosen first) and PRESENTER. The arrow keys switch between them (the MODE button does on a phone or with a mouse), and SPACE, a click or a tap starts the one chosen.

### Play mode (the default)

Starting play mode opens round 1. You are alone in the shop and a trade customer wants 10 tins mixed while a queue forms. The console's buttons choose every action: SERVE serves the walk-in who has waited longest, MIX N TINS takes you to the mixing room for N tins (the counter is unmanned until you are back), and in round 2 SEND TO HUB sends an order over the hub threshold away in one press and keeps you at the till. Keys 1, 2 and 3 press them, and a click or tap works as well. A button that cannot act now is greyed out and says why (SERVING, MIXING, NOBODY WAITING, or ONLY OVER the hub threshold), and pressing it says that aloud. Each round lasts the ROUND LENGTH setting, and both face the same customers. Round 1 ends on its result: sales made, walked out and time unmanned. Round 2 ends on the two rounds side by side and which made more in sales. Then a card, NOW A WHOLE REAL DAY, leads into the full-shift replays and the comparison described below. The whole day always runs on autoplay, with no take-control, so its comparison is the same like-for-like pair whatever was pressed in the rounds.

### Presenter mode

Presenter mode is the autoplay pitch with no played rounds, for narrating without playing. Choose it on the title, or add `?mode=presenter` to the URL to open with it chosen.

SPACE walks the pitch: the title, today's replay, today's results, the same day with the hub, then the comparison of the two with the sales saved per day, week, year and across the estate. During a replay SPACE skips to the next narration beat. At the comparison SPACE replays the same day and R reshuffles it (the next seed). On a phone or tablet a tap anywhere on the screen does what SPACE does, the prompts read TAP, and a RESHUFFLE button appears at the comparison; taps closer together than a double tap count once. Each screen's text is also written to a visually hidden live region.

In presenter mode, C during a replay takes control (a TAKE CONTROL button does on a phone). When a free staff member faces both a waiting walk-in and a waiting mix order, the shift stops and the text box asks: W serves the walk-in, O mixes the order (or the SERVE WALK-IN and MIX ORDER buttons). With no pick after a few seconds autoplay's choice is taken, so doing nothing is autoplay. The results and comparison that follow use the shift as it was played; replaying from the comparison starts afresh. C again returns to autoplay for the rest of the shift.

S on the title opens the settings menu (a SETTINGS button does on a phone). It lists every parameter of the simulation plus the replay speed and the round length: up and down choose a row, left and right change it, and on a phone you tap a row and use the on-screen - and + buttons. RESHUFFLE draws a new day, RESET restores the defaults, and BACK (or Enter or Escape) returns to the title. Order-size percentages must total 100, and so must the walk-in type shares, before BACK is allowed. Each walk-in type (colour advice, sample pot, small buy) has its own share and value; the average sale is whatever they work out to. Values are kept in the browser's storage and used by the next run; when storage is blocked they still apply for the session and the menu says they are not saved.

To open a step directly, for rehearsal, add `?scene=` to the URL: `play` for round 1 (`&round=2` for round 2), `round-result` for round 1's result, `rounds` for the round comparison, `whole-day` for the card before the whole day, `shop` for a replay (with `&scenario=hub` for the hub run and `&minute=<shop minute>` to start part-way through), `results` for today's results, `comparison` for the comparison, `style-frame` for the still the v2 look is judged on (the ten-tin dilemma at the till; `&moment=unmanned` for the counter left empty while it is mixed). `&seed=<n>` picks the day.

## Layout

- `src/sim/` - the simulation: parameters, seeded arrivals, the event engine and its decision policy, the played round driven by the player's presses, the timeline, its metrics and their extrapolation to a year and the estate. Imports nothing from the DOM or the renderer.
- `src/render/` - the screen, palette, font, sprites, the text box, and the pure replay state and narration derived from a timeline.
- `src/scenes/` - what is drawn on each screen.
- `src/flow/` - the order of the pitch, the deep links into it, the input actions that keys, taps and buttons share, and the settings model and its storage, all pure.
- `src/audio/` - the sound effects: which timeline events make which effect, and the Web Audio player that synthesises them. Muted until M or the SFX button on the console; no audio files. `src/render/juice.ts` maps every action and event to its visual, motion and sound, and holds the motion that reduced motion turns off.
- `src/styles/tokens.css` - the screen palette and the console's colours; the only file that writes a colour. `src/render/palette.ts` indexes the palette tokens, and sprites name each pixel by its palette key.
- `docs/captures/` - short recordings of the demo running.
