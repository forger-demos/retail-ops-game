# 0001 - Both scenarios share one seed

## Decision

The today and hub runs use the same seed, so walk-ins and mix orders arrive at the same moments with the same tin counts. The only difference between them is where large orders are mixed.

## Why

An executive audience will ask whether the hub run got a luckier day. With identical arrivals the difference in lost sales is caused by the proposal alone. Reshuffling picks a new seed for both runs together.

## Consequence

The simulation draws every random value for arrivals before or independently of scenario decisions, so a scenario cannot shift the random stream.
