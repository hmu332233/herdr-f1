import type { RacePresentation } from './presentation.js';

/** Server → browser: the complete authoritative race state. Browsers
 *  extrapolate marker positions from each
 *  entry's placement.progress + displaySpeed until the next sync. */
export type SyncMessage = { type: 'sync' } & RacePresentation;

/** Browser → server.
 *
 *  `circuit` reports the race distance of the circuit the viewer selected. The
 *  server owns the race, so it has to be told: the drawing is a per-browser
 *  choice, but the distance it implies is race state and applies to everyone. */
export type ClientMessage =
  | { type: 'focus'; terminalID: string }
  | { type: 'circuit'; totalLaps: number };
