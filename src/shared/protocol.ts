import type { RacePresentation } from './presentation.js';

/** Server → browser: the complete authoritative race state. Browsers
 *  extrapolate marker positions from each
 *  entry's placement.progress + displaySpeed until the next sync. */
export type SyncMessage = { type: 'sync' } & RacePresentation;

/** Browser → server. Focusing is the only action the dashboard can take. */
export type ClientMessage = { type: 'focus'; terminalID: string };
