# 0002 - Time scale defaults to one tin per second

## Decision

The renderer replays shop time at a time scale where 1 real second stands for 5 shop minutes, the time to mix one tin. Shift length and time scale are both parameters; replay length is shift length divided by time scale.

## Why

The owner's framing is "mixing a tin takes 1 second instead of 5 minutes", extrapolated from there. A default 8-hour shift then plays in about a minute and a half, which suits a narrated pitch.
