# Plan - PAINT RUSH v2: play it, then prove it

## The brief, verbatim

"I have to present an idea to an executive team where I need to demonstrate the difficulty a retail team faces with manufacturing on-site. We produce paint to order by clients; it takes on average five minutes per tin and during that time a staff member is no longer present on the shop floor. In that time we can potentially lose sales because there isn't anyone there to serve. I want to demonstrate that in an 8-bit, think Pokemon from the Game Boy."

Every v2 ticket is judged against this paragraph, not only against its acceptance criteria. "Think Pokemon from the Game Boy" sets the feel: playful, readable, a shop you recognise, a character you play. It is not a hardware spec; the four-green palette of v1 read as drab and is retired ([ADR 0003](adr/0003-play-first-and-a-richer-palette.md)).

## Goal

The executives feel the problem before they see the numbers. They play two short rounds as the shop assistant, first mixing every order in store, then with large orders sent to the hub. Then the demo shows a whole real day from the simulation, and the annual and estate figures.

## The moment the room must feel

A trade customer at the till wants 10 tins. You are alone. Mixing them means the counter is unmanned while a queue builds, and people walk out. In round 2 the same order goes to the hub with one press and you keep serving.

## In scope

- **Style frame first**: a finished look approved by the owner before anything else is built on it.
- **Look**: a limited 8-bit handheld palette with real colour, defined as tokens; a drawn handheld console around the screen; a recognisable shop: checkered floor, tinting machine and shaker, till, colour-swatch wall, shelves of tins, plants; a shop assistant and varied customers with shadows; order speech bubbles; colour-coded patience bars; a COUNTER UNMANNED banner.
- **Play mode** as the default: two short rounds, big labelled action buttons on the console (SERVE, MIX N TINS, SEND TO HUB) that work by key, click and tap, and a scripted opening dilemma.
- **Customer types**, so the audience sees what is lost: colour advice, sample pots, small purchases, and mix orders.
- **Juice**: every action gets visual, audio and motion feedback.
- **Debrief**: after the rounds, the existing full-shift simulation (today vs hub, same seed) and the extrapolation.
- **Presenter mode**: the v1 autoplay flow, kept for narrating without playing.

## Out of scope

- Central preparation and delivery costs (the comparison still says it excludes them).
- Any sprite, tile, font, sound, name or likeness from an existing game.
- Network dependencies: fonts and sounds stay inlined or synthesised.

## Build order

1. `v2-style-frame` - the look, as a still frame and a short capture. Owner approval gate.
2. `v2-play-mode` - the two played rounds with the opening dilemma.
3. `v2-debrief` - rounds -> whole real day -> comparison; title offers PLAY and PRESENTER.
4. `v2-customer-types` and `v2-juice` - in either order.
5. `v2-capture` - a recorded play-through for the slide deck.

## Progress archive

Every v1 screen is archived into `docs/progress/` before v2 overwrites it, so the archive shows v1 -> v2.

## Open questions

- Real share of orders over 5 tins, store count and trading days (still placeholders).
- Whether the boardroom wants sound on by default; v2 keeps it muted with a visible SFX button.
