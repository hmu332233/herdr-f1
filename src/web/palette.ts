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
  teamColors: [
    '#E10600', '#00A3E0', '#00C853', '#FF8700',
    '#A855F7', '#00E5FF', '#FFD500', '#F72585',
    '#00BFA5', '#C58B4E', '#90A4AE', '#6C63FF',
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
