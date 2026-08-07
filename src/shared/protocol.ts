import type { RacePresentation } from './presentation.js';

/** Server → browser: the complete authoritative race state. Browsers
 *  extrapolate marker positions from each
 *  entry's placement.progress + displaySpeed until the next sync.
 *
 *  `circuitID` is present only in multiplayer, where the venue is pinned when
 *  the host is launched: every viewer renders this circuit and the selector is
 *  locked. Absent in local mode, where the circuit is a per-browser choice. */
export type SyncMessage = { type: 'sync'; circuitID?: string } & RacePresentation;

/** Browser → server.
 *
 *  `circuit` reports the race distance of the circuit the viewer selected. The
 *  server owns the race, so it has to be told: the drawing is a per-browser
 *  choice, but the distance it implies is race state and applies to everyone.
 *  Local mode only — the viewer is the owner there. A multiplayer host ignores
 *  it (viewers are anonymous, so this would be an unauthenticated write to
 *  shared race state; same reasoning that disables focus). */
export type ClientMessage =
  | { type: 'focus'; terminalID: string }
  | { type: 'circuit'; totalLaps: number };
