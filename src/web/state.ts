import type { EntryPlacement } from '../shared/presentation.js';

/** Extrapolates a marker's fractional circuit progress `elapsedSeconds` after
 *  the last authoritative sync using the entry's displaySpeed (laps/second).
 *  Returns null for placements that are not on the circuit. */
export function extrapolateProgress(
  placement: EntryPlacement,
  displaySpeed: number,
  elapsedSeconds: number,
): number | null {
  if (placement.kind !== 'track' && placement.kind !== 'cooldown' && placement.kind !== 'incidentTrack') {
    return null;
  }
  const progress = placement.progress + displaySpeed * elapsedSeconds;
  return progress - Math.floor(progress);
}
