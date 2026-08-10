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
  /** Constructor liveries, one per palette slot. This is a max-contrast
   *  sequence for the dashboard's near-black background: the earliest colors
   *  deliberately jump between distant hues, so the common 2–6 team field is
   *  distinguishable at a glance. The server hands them out in this order and
   *  never changes an existing team's slot during the session.
   *
   *  Keep this the same length as RaceRules.paletteSize — the server hands out
   *  slot indices against that count, and a shorter array here would wrap two
   *  teams onto one colour. */
  teamColors: [
    '#FF8C1A', // orange
    '#C44DFF', // purple
    '#00E6E6', // cyan
    '#00E600', // green
    '#FF4D88', // rose
    '#2B8CEE', // blue
    '#D4D411', // yellow
    '#ECB093', // peach
    '#EC93EC', // lilac
    '#22C373', // emerald
    '#93BFEC', // sky blue
  ],
} as const;

export function teamColor(token: TeamColorToken): string {
  return palette.teamColors[token.slot % palette.teamColors.length];
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
