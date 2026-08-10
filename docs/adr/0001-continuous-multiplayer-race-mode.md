---
status: accepted
date: 2026-08-10
---

# Add a host-owned continuous multiplayer race mode

Herdr F1 will add an optional multiplayer race mode that keeps available vehicles circulating so the track always feels like a race. In this mode the track conveys activity and pace, while team vehicle cards remain the authoritative source of agent state. The existing race mode remains the default and is not changed.

## Decision

### Scope and ownership

- The first implementation applies to multiplayer only.
- The multiplayer host owns the mode because vehicle motion, official distance, standings, and race control are shared state.
- The host selects `classic` or `continuous` with `herdr-f1 host --race-mode <mode>`.
- `classic` is the default. Its current behaviour, including its existing yellow-flag slowdown, remains unchanged.
- Viewers display the active mode but cannot change it. Anonymous viewer writes must not alter shared race rules.
- The dashboard labels the modes `CLASSIC RACE` and `CONTINUOUS RACE`. Korean documentation calls them `기존 레이스` and `상시 레이스`.

### Continuous-race vehicle state and pace

A vehicle's crew state uses this priority order:

1. One or more blocked agents: `BLOCKED`.
2. Otherwise, one or more working agents: `WORKING`.
3. All agents done: `DONE`.
4. All agents idle: `IDLE`.
5. A mixture of idle and done agents: `CRUISING`.

Vehicle pace is part of official scoring, not a display-only animation:

- `IDLE`, `DONE`, and `CRUISING` run at `0.75x` nominal pace.
- `WORKING` changes immediately to `1.0x` nominal pace.
- Sustained working retains multiplayer's rolling 90-second uptime incentive and increases pace up to `1.25x`.
- Per-lap random variation is reduced to `±2%`, so flavour does not obscure state and uptime.
- `BLOCKED` runs at `0x` and stops on the circuit.
- All visible movement advances official distance and therefore affects laps, gaps, position, and the finish.

One blocked agent stops its whole crew vehicle even if another crew member is working. Urgent state must not be averaged away.

### Disconnected and offline teams

A disconnected join client or unavailable local Herdr feed does not stop its vehicles in continuous mode:

- The team is prominently labelled `TEAM OFFLINE`.
- Its retained crew report is dimmed and labelled `LAST KNOWN` rather than presented as live truth.
- Its vehicles continue at the `0.75x` cruising pace and keep accumulating official distance.
- A stale blocked report does not maintain or trigger a Safety Car period.

This deliberately favours a continuously active race display. The card, rather than motion, communicates loss of telemetry.

### Safety Car period

Continuous mode uses a real queue-forming Safety Car model rather than applying one uniform slowdown factor:

- A live crew entering `BLOCKED` stops its vehicle and deploys the Safety Car.
- The dashboard shows `SAFETY CAR`, retains the yellow track treatment, and renders a distinct `SC` marker ahead of the leader.
- Blocked vehicles are excluded from the running queue and may be passed as stopped vehicles.
- The order of the remaining running vehicles is frozen when the period begins. They may close gaps but may not overtake one another.
- The SC and the leading vehicle travel at `0.40x` nominal pace.
- Following vehicles use gap-controlled speeds from `0.40x` to `0.80x`: a distant vehicle catches the car ahead, then smoothly converges on the queue pace.
- The visual target gap is approximately 1.5 vehicle-marker lengths along the circuit.
- Working bonuses and lap variation do not apply while race control determines Safety Car pace.

A vehicle that recovers from `BLOCKED` rejoins at the back of the queue rather than reclaiming its old position. A new vehicle arriving during the period also joins at the back, with its official lap and distance aligned immediately behind the queue tail so its displayed position and lap count agree.

The Safety Car remains deployed until every live block is cleared. Race resumption follows this sequence:

1. Race control displays `SC IN THIS LAP`.
2. The leader controls the queue pace while the SC marker enters the pit lane.
3. No vehicle may overtake before crossing the finish line.
4. When the leader crosses the line, normal state-derived pace and competition resume.
5. The dashboard displays `GREEN FLAG` for three seconds before returning to its normal state.

A new block during `SC IN THIS LAP` cancels the withdrawal. The Safety Car remains out until all blocks are clear again, after which a new withdrawal sequence begins.

### Team vehicle cards

Cards are the authoritative status display and must remain readable without interpreting vehicle speed or colour alone:

- Each vehicle row shows the priority badge defined above.
- A segmented bar shows the proportion of `working`, `idle`, `done`, and `blocked` agents in the crew.
- Text counts such as `W2 · I1 · D1 · B0` accompany the bar.
- A blocked vehicle keeps the existing yellow flashing row treatment.
- A team with any blocked vehicle also receives a flashing yellow card border and a header summary such as `1 BLOCKED`.
- Normal working, idle, and done states do not recolour or animate the whole team card; team livery remains stable and urgent treatments remain exceptional.
- An offline team uses a fixed `TEAM OFFLINE` header treatment instead of a live blocked treatment.

The multiplayer wire report must carry current idle and done counts in addition to working and blocked counts. This requires a multiplayer protocol version increase; mismatched host and join versions continue to fail explicitly at the handshake. Reports remain aggregate-only and do not expose agent names or identifiers.

### Grand Prix lifecycle and venues

- Continuous mode retains the existing finite Grand Prix, podium, and next-race lifecycle.
- Completing a Grand Prix does not turn continuous mode into an endless lap counter.
- Venues rotate with a shuffle bag: every available circuit appears once per cycle, the bag is reshuffled for the next cycle, and the cycle boundary cannot immediately repeat the previous venue.

## Considered options

- **Replace classic mode:** rejected so the original semantics remain the default and provide a comparison baseline.
- **Treat track motion as authoritative status:** rejected because idle and done vehicles deliberately keep moving. Cards must carry exact state.
- **Animate idle and done without scoring their distance:** rejected because visible laps would disagree with standings and the finish.
- **Apply one Safety Car factor to every vehicle:** rejected because equal slowdown preserves gaps instead of forming a recognisable queue.
- **Let viewers choose the shared mode:** rejected because multiplayer viewers are anonymous and race physics must be consistent for everyone.

- **Implement local mode first:** rejected because multiplayer is the primary product experience and its crew, uptime, offline, and host-ownership rules define this mode.
- **Use unrestricted random venue selection:** rejected because short-term repeats make an always-running display feel less varied.

## Consequences

- Continuous mode needs explicit race-control phases for Safety Car deployment, withdrawal, and the transient green flag.
- Queue order and gap control become authoritative simulation state and require deterministic tests, including wrap-around, lapped cars, recovery, new entrants, and a new block during withdrawal.
- Host and join clients must upgrade together when the crew report gains idle and done counts.
- A cruising or offline team can still finish a race, but sustained working is always faster. This is intentional: the mode rewards activity without making the track go dormant.
- Classic-mode behaviour must be covered by regression tests so adding continuous mode cannot silently change the default.
