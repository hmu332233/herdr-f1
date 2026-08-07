/** Venue metadata shared by the server and the browser: the published race
 *  distance per circuit. The single source of truth — the browser's circuit
 *  definitions (geometry) and the server's `host --circuit` validation both
 *  read distances from here, so the two sides can never disagree about how
 *  long a venue's race is. */
export const VENUES = [
  { id: 'herdr', laps: 58 },
  { id: 'korea', laps: 55 },
  { id: 'suzuka', laps: 53 },
  { id: 'catalunya', laps: 66 },
  { id: 'las-vegas', laps: 50 },
] as const;

export type VenueID = (typeof VENUES)[number]['id'];

export const VENUE_IDS: readonly string[] = VENUES.map(venue => venue.id);

export const DEFAULT_VENUE_ID: VenueID = 'herdr';

export function isVenueID(id: string): id is VenueID {
  return VENUE_IDS.includes(id);
}

export function venueLaps(id: VenueID): number {
  return VENUES.find(venue => venue.id === id)!.laps;
}
