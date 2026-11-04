# Glossary

- **Walk-in** - a customer on the shop floor who wants to buy and needs a staff member to serve them.
- **Lost sale** - a walk-in who waits past their patience and leaves without buying; valued at the average sale.
- **Patience** - how long a walk-in waits for a free staff member before leaving.
- **Service time** - how long serving one walk-in occupies a staff member.
- **Staff on the floor** - staff available to serve; a staff member mixing is off the floor.
- **Mix order** - a request for paint tinted to order, of one or more tins.
- **Tin** - one container of mixed paint, sized 750ml, 2.5L or 5L. Mixing takes minutes-per-tin regardless of size.
- **Large order** - a mix order with more tins than the hub threshold (over 5 by default).
- **Hub** - the central site that prepares large orders and delivers them to the customer within 2 hours.
- **Scenario** - one way of running the shop: `today` (all mixing in store) or `hub` (large orders to the hub).
- **Shift** - one trading day, simulated in shop minutes.
- **Time scale** - real seconds per shop minute; by default 1 s stands for 5 shop minutes, one tin.
- **Seed** - the random seed that fixes arrivals; both scenarios of a run share it.
- **Timeline** - the ordered events of a simulated shift, replayed by the renderer.
- **Replay** - the shop scene playing one scenario's timeline at the time scale.
- **Beat** - one line of narration in the text box, derived from the timeline.
