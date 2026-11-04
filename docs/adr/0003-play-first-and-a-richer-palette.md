# 0003 - Play first, and a richer palette

## Decision

The default experience is played, not watched: the audience is the shop assistant for two short rounds, and the full-shift simulation follows as the evidence. The screen draws from a limited 8-bit handheld palette with real colour, defined once as tokens, instead of four greens.

## Why

v1 was a faithful replay that nobody touched, in a palette that read as drab on a projector. The brief asks to demonstrate a difficulty "think Pokemon from the Game Boy": the difficulty is felt when you are the one choosing between the till and the mixer, and the reference is about charm and readability, not about the original hardware's colours.

## Consequence

- Tests assert that colours come from tokens, not that the screen uses a fixed number of shades.
- The simulation stays the source of every number. The played rounds draw their arrivals from it with a fixed seed, so both rounds face the same customers; the player's choices are the decision policy (`src/sim/control.ts`).
- Autoplay survives as presenter mode.
- This supersedes the palette part of the v1 plan; ADR 0001 (same seed) and ADR 0002 (time scale) still hold, with rounds using a faster scale than the full-shift debrief.
