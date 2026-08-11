import type { EntryPresentation, TeamColorToken } from '../shared/presentation.js';

export const palette = {
  canvas: '#0A0C10',
  card: '#12161D',
  asphalt: '#171B22',
  textSoft: 'rgba(255,255,255,0.75)',
  textMuted: 'rgba(255,255,255,0.45)',
  liveRed: '#E10600',
  statusWorking: '#00C853',
  statusIdle: '#8B93A1',
  statusPit: '#4DA6FF',
  statusDone: '#E0E0E0',
  statusBlocked: '#FF9F0A',
  /** Marshal's yellow. Brighter and less orange than statusBlocked so a flashing
   *  track edge reads as a track condition rather than as another status chip. */
  flagYellow: '#FFD400',
  /** Original high-contrast constructor colours used by the personal dashboard. */
  localTeamColors: [
    '#FF8C1A', '#C44DFF', '#00E6E6', '#00E600', '#FF4D88', '#2B8CEE',
    '#D4D411', '#ECB093', '#EC93EC', '#22C373', '#93BFEC',
  ],
  /** Muted 2026 F1 live-timing team colours, one per palette slot. The order
   *  separates similar reds and blues so generic Herdr teams remain readable
   *  without returning to the previous neon rainbow. The server hands them out
   *  in this order and never changes an existing team's slot during a session.
   *
   *  Keep this the same length as RaceRules.paletteSize — the server hands out
   *  slot indices against that count, and a shorter array here would wrap two
   *  teams onto one colour. */
  teamColors: [
    '#F47600', // McLaren papaya
    '#00D7B6', // Mercedes teal
    '#ED1131', // Ferrari red
    '#4781D7', // Red Bull blue
    '#229971', // Aston Martin green
    '#9C9FA2', // Haas silver
    '#F50537', // Audi red
    '#1868DB', // Williams blue
    '#909090', // Cadillac grey
    '#00A1E8', // Alpine blue
    '#6C98FF', // Racing Bulls blue
  ],
} as const;

export function teamColor(token: TeamColorToken, multiplayer = false): string {
  const colors = multiplayer ? palette.teamColors : palette.localTeamColors;
  return colors[token.slot % colors.length];
}

export function rowStatusColor(entry: EntryPresentation): string {
  if (entry.placement.kind === 'nextGrid' || entry.placement.kind === 'retired') {
    return palette.statusIdle;
  }
  switch (entry.status) {
    case 'working': return palette.statusWorking;
    case 'idle': return palette.statusPit;
    case 'done': return palette.statusDone;
    case 'blocked': return palette.liveRed;
  }
}

/** Dark text on light team colors, white otherwise (same threshold as Swift). */
export function contrastText(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.62 ? palette.canvas : '#FFFFFF';
}

export function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
