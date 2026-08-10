import type { SyncMessage } from '../shared/protocol.js';
import type { EntryPresentation, TeamStanding } from '../shared/presentation.js';
import { contrastText, hexAlpha, rowStatusColor, teamColor } from './palette.js';

/** CONSTRUCTORS panel. Rebuilds the DOM only when the team/entry structure
 *  changes (preserving keyboard focus by terminal ID); otherwise updates rows
 *  in place — mirrors the AppKit standings controller. */
export function createStandingsPanel(
  container: HTMLElement,
  onFocus: (terminalID: string) => void,
) {
  let structure = '';
  const cards = new Map<string, ReturnType<typeof createTeamCard>>();

  function render(sync: SyncMessage): void {
    const nextStructure = sync.teams
      .map(team => `${team.id}:${team.entries.map(entry => entry.id).join(',')}`)
      .join('|') + `|${sync.raceMode}`;
    if (nextStructure !== structure) {
      structure = nextStructure;
      rebuild(sync);
      return;
    }
    for (const team of sync.teams) cards.get(team.id)?.update(team, sync.raceMode);
  }

  function rebuild(sync: SyncMessage): void {
    // Rebuilding must not kick a keyboard user out of the standings.
    const active = document.activeElement as HTMLElement | null;
    const focusedTerminal = active?.dataset?.terminalId ?? null;
    cards.clear();
    container.replaceChildren(
      ...sync.teams.map(team => {
        const card = createTeamCard(team, onFocus, sync.raceMode);
        cards.set(team.id, card);
        return card.element;
      }),
    );
    if (focusedTerminal !== null) {
      container
        .querySelector<HTMLElement>(`[data-terminal-id="${CSS.escape(focusedTerminal)}"]`)
        ?.focus();
    }
  }

  return { render };
}

function createTeamCard(
  team: TeamStanding,
  onFocus: (terminalID: string) => void,
  raceMode: SyncMessage['raceMode'],
) {
  const element = document.createElement('article');
  element.className = 'team-card';
  element.setAttribute('role', 'listitem');

  const accent = document.createElement('span');
  accent.className = 'team-accent';
  accent.style.background = teamColor(team.colorToken);

  const header = document.createElement('div');
  header.className = 'team-header';
  const rank = document.createElement('span');
  rank.className = 'team-rank';
  const name = document.createElement('span');
  name.className = 'team-name';
  const stats = document.createElement('span');
  stats.className = 'team-stats';
  const alert = document.createElement('span');
  alert.className = 'team-alert';
  header.append(rank, name, alert, stats);
  element.append(accent, header);

  const rows = new Map<string, ReturnType<typeof createAgentRow>>();

  team.entries.forEach((entry, index) => {
    if (index > 0) {
      const divider = document.createElement('div');
      divider.className = 'agent-divider';
      element.append(divider);
    }
    const row = createAgentRow(entry, teamColor(team.colorToken), onFocus, raceMode);
    rows.set(entry.id, row);
    element.append(row.element);
  });

  /** In-place text refresh; the row set and order must be unchanged
   *  (structural changes rebuild the whole card). */
  function update(team: TeamStanding, mode: SyncMessage['raceMode']): void {
    rank.textContent = `P${team.rank}`;
    name.textContent = team.label.toUpperCase();
    alert.textContent = team.isOffline
      ? 'TEAM OFFLINE'
      : team.blockedCount > 0 ? `${team.blockedCount} BLOCKED` : '';
    element.classList.toggle('is-offline', team.isOffline);
    element.classList.toggle('is-blocked', !team.isOffline && team.blockedCount > 0);
    stats.replaceChildren();
    const distance = document.createElement('span');
    distance.className = 'distance';
    distance.textContent = team.distanceText;
    stats.append(
      distance,
      `  ${team.gapText}  ${team.entries.length} CAR${team.entries.length === 1 ? '' : 'S'}`,
    );
    element.setAttribute(
      'aria-label',
      `P${team.rank}, ${team.label}, ${team.distanceText.toLowerCase()}, ${team.entries.length} cars`,
    );
    for (const entry of team.entries) rows.get(entry.id)?.update(entry, mode);
  }

  update(team, raceMode);
  return { element, update };
}

/** One keyboard-focusable button per agent. Activation focuses the exact
 *  herdr terminal; it never mutates agent state locally. */
function createAgentRow(
  entry: EntryPresentation,
  color: string,
  onFocus: (terminalID: string) => void,
  raceMode: SyncMessage['raceMode'],
) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'agent-row';
  element.dataset.terminalId = entry.id;
  element.style.setProperty('--team-color', color);
  element.addEventListener('click', () => onFocus(entry.id));

  const chip = document.createElement('span');
  chip.className = 'agent-chip';
  chip.style.background = color;
  chip.style.color = contrastText(color);
  chip.textContent = String(entry.carNumber);

  const main = document.createElement('span');
  main.className = 'agent-main';

  const onboard = document.createElement('span');
  onboard.className = 'onboard-tag';
  onboard.textContent = 'ONBOARD';

  const sub = document.createElement('span');
  sub.className = 'agent-sub';
  const kind = document.createElement('span');
  kind.className = 'agent-kind';
  const status = document.createElement('span');
  status.className = 'agent-status';
  const stint = document.createElement('span');
  stint.className = 'agent-stint';
  sub.append(kind, onboard, status, stint);

  const crewDetail = document.createElement('span');
  crewDetail.className = 'crew-detail';
  const crewBar = document.createElement('span');
  crewBar.className = 'crew-bar';
  const segments = (['working', 'idle', 'done', 'blocked'] as const).map(key => {
    const segment = document.createElement('span');
    segment.className = `crew-${key}`;
    crewBar.append(segment);
    return [key, segment] as const;
  });
  const counts = document.createElement('span');
  counts.className = 'crew-counts mono';
  const lastKnown = document.createElement('span');
  lastKnown.className = 'last-known';
  crewDetail.append(crewBar, counts, lastKnown);

  element.append(chip, main, sub, crewDetail);

  function update(entry: EntryPresentation, mode: SyncMessage['raceMode']): void {
    const workspace = document.createElement('span');
    workspace.className = 'workspace';
    workspace.textContent = entry.workspaceLabel;
    const separator = document.createElement('span');
    separator.className = 'separator';
    separator.textContent = ' / ';
    const tab = document.createElement('span');
    tab.className = 'tab';
    tab.textContent = entry.tabLabel;
    main.replaceChildren(workspace, separator, tab);

    kind.textContent = mode === 'continuous' ? entry.statusText : entry.agentKind.toUpperCase();
    const statusColor = rowStatusColor(entry);
    status.textContent = mode === 'continuous' ? entry.crewState.toUpperCase() : entry.statusText;
    status.style.color = statusColor;
    status.style.background = hexAlpha(statusColor, 0.14);
    stint.textContent = entry.showsNewStint ? 'NEW STINT' : '';
    crewDetail.hidden = mode !== 'continuous';
    const total = Object.values(entry.crewCounts).reduce((sum, value) => sum + value, 0);
    for (const [key, segment] of segments) {
      segment.style.width = `${total === 0 ? 0 : entry.crewCounts[key] / total * 100}%`;
    }
    counts.textContent =
      `W${entry.crewCounts.working} · I${entry.crewCounts.idle} · ` +
      `D${entry.crewCounts.done} · B${entry.crewCounts.blocked}`;
    lastKnown.textContent = entry.isLastKnown ? 'LAST KNOWN' : '';
    element.classList.toggle('is-onboard', entry.isFocused);
    // Flashes in step with the track and this car's marker: the row is how a
    // viewer gets from "something is yellow" to which agent needs them.
    element.classList.toggle('is-yellow-flag', entry.causesYellowFlag);
    onboard.hidden = !entry.isFocused;
    element.setAttribute(
      'aria-label',
      `Car ${entry.carNumber}, ${entry.workspaceLabel}, ${entry.tabLabel}, ${entry.agentKind}, ` +
        `${entry.statusText.toLowerCase()}, ` +
        `${entry.causesYellowFlag ? 'yellow flag, ' : ''}Focus in Herdr`,
    );
  }

  update(entry, raceMode);
  return { element, update };
}
