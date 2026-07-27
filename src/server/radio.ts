import { stableHash } from './rules.js';
import type { RadioKind } from '../shared/presentation.js';

/**
 * Team radio phrasing. Every line is invented race commentary chosen from a
 * fixed script by status transition — the dashboard never reads terminal
 * output, so no agent text can ever reach here.
 *
 * Selection is a pure function of the seed, so one transition keeps the same
 * line for as long as it stays in the history window: sync re-sends the whole
 * window several times a second and the text must not flicker between them.
 */
const SCRIPTS: Record<RadioKind, readonly string[]> = {
  boxBox: [
    'Box this lap, box this lap.',
    'In the pits, in the pits.',
    'Coming in for service.',
    'Understood, box now.',
  ],
  greenAgain: [
    "Out of the pits, let's go.",
    'Back to green, pushing now.',
    'Clear track ahead, hammer time.',
    'Rejoining the circuit.',
  ],
  incident: [
    "We have a problem, I'm stopping.",
    "Something's not right, need help.",
    'Losing power, pulling over.',
    "I'm stuck out here.",
  ],
  recovered: [
    'All clear, back under way.',
    'Recovered, resuming the race.',
    'Problem solved, back to it.',
    'Good to go again.',
  ],
  chequered: [
    "That's the chequered flag. Great job.",
    'Race complete, well done everyone.',
    'Crossed the line. Superb work.',
    "That's a finish, brilliant stuff.",
  ],
  newStint: [
    'New driver in the car.',
    'Fresh stint, fresh tyres.',
    'Driver change complete.',
    'New hands on the wheel.',
  ],
  retired: [
    "That's a retirement. Into the garage.",
    'Car is out of the race.',
    'Retiring the car, that is all.',
    "We're done for today.",
  ],
};

/**
 * Picks the radio line for one transition. The seed should identify the
 * transition (terminal, lap, kind) so replays of the same event read
 * identically and tests stay deterministic.
 */
export function radioText(kind: RadioKind, seed: string): string {
  const script = SCRIPTS[kind];
  const index = Number(stableHash(`${kind}|${seed}`) % BigInt(script.length));
  return script[index];
}
