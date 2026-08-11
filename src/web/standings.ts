import type { SyncMessage } from '../shared/protocol.js';
import type { EntryPresentation, TeamStanding } from '../shared/presentation.js';
import { contrastText, hexAlpha, rowStatusColor, teamColor } from './palette.js';

export interface RankedVehicle {
  rank: number;
  team: TeamStanding;
  entry: EntryPresentation;
  gapText: string;
}

export function createStandingsPanel(
  container: HTMLElement,
  onFocus: (terminalID: string) => void,
) {
  let multiplayer: boolean | null = null;
  let selectedTeam: string | null = null;
  let panel: ReturnType<typeof createVehicleStandingsPanel> | ReturnType<typeof createConstructorStandingsPanel>;

  function render(sync: SyncMessage): void {
    const nextMultiplayer = sync.circuitID !== undefined;
    if (nextMultiplayer !== multiplayer) {
      multiplayer = nextMultiplayer;
      container.replaceChildren();
      panel = multiplayer
        ? createVehicleStandingsPanel(container, onFocus)
        : createConstructorStandingsPanel(container, onFocus);
      if (multiplayer) panel.setMyTeam(selectedTeam);
    }
    panel!.render(sync);
  }

  function setMyTeam(teamID: string | null): void {
    selectedTeam = teamID;
    if (multiplayer) panel!.setMyTeam(teamID);
  }

  return { render, setMyTeam };
}

/** Multiplayer individual-car leaderboard. Cards keep their DOM identity for
 * the whole race so a position change can be animated with FLIP. */
function createVehicleStandingsPanel(
  container: HTMLElement,
  onFocus: (terminalID: string) => void,
) {
  const cards = new Map<string, ReturnType<typeof createVehicleCard>>();
  const moveAnimations = new Map<string, Animation>();
  let order: string[] = [];
  let myTeamID: string | null = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function render(sync: SyncMessage): void {
    const vehicles = rankVehicles(sync);
    const nextIDs = vehicles.map(vehicle => vehicle.entry.id);
    const nextIDSet = new Set(nextIDs);

    for (const [id, card] of cards) {
      if (nextIDSet.has(id)) continue;
      moveAnimations.get(id)?.cancel();
      moveAnimations.delete(id);
      card.element.remove();
      cards.delete(id);
    }

    for (const vehicle of vehicles) {
      if (!cards.has(vehicle.entry.id)) {
        cards.set(vehicle.entry.id, createVehicleCard(vehicle, onFocus, sync.raceMode));
      }
    }

    const orderChanged = order.length > 0 && (
      order.length !== nextIDs.length || order.some((id, index) => id !== nextIDs[index])
    );
    const before = new Map<string, DOMRect>();
    if (orderChanged && !reduceMotion.matches) {
      for (const id of order) {
        const element = cards.get(id)?.element;
        if (element) before.set(id, element.getBoundingClientRect());
      }
    }

    for (const vehicle of vehicles) {
      const card = cards.get(vehicle.entry.id);
      card?.update(vehicle, sync.raceMode);
      card?.element.classList.toggle('is-my-team', vehicle.team.id === myTeamID);
    }
    container.append(...nextIDs.map(id => cards.get(id)!.element));

    if (orderChanged && !reduceMotion.matches) animateRankChange(nextIDs, before);
    order = nextIDs;
  }

  function animateRankChange(nextIDs: string[], before: Map<string, DOMRect>): void {
    for (const id of nextIDs) {
      const element = cards.get(id)?.element;
      const first = before.get(id);
      if (!element || !first) continue;
      const last = element.getBoundingClientRect();
      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;

      moveAnimations.get(id)?.cancel();
      element.style.zIndex = '3';
      element.classList.toggle('rank-gained', deltaY > 0);
      element.classList.toggle('rank-lost', deltaY < 0);
      const animation = element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
      moveAnimations.set(id, animation);
      void animation.finished.catch(() => {}).finally(() => {
        if (moveAnimations.get(id) !== animation) return;
        moveAnimations.delete(id);
        element.style.zIndex = '';
        element.classList.remove('rank-gained', 'rank-lost');
      });
    }
  }

  function setMyTeam(teamID: string | null): void {
    myTeamID = teamID;
    for (const card of cards.values()) {
      card.element.classList.toggle('is-my-team', card.element.dataset.teamId === teamID);
    }
  }

  return { render, setMyTeam };
}

export function rankVehicles(sync: SyncMessage): RankedVehicle[] {
  const vehicles = sync.teams.flatMap(team => team.entries.map(entry => ({ team, entry })));
  vehicles.sort((a, b) => {
    const distance = Math.round(b.entry.officialDistance * 1e6)
      - Math.round(a.entry.officialDistance * 1e6);
    return distance || a.entry.carNumber - b.entry.carNumber || a.entry.id.localeCompare(b.entry.id);
  });
  const leaderDistance = vehicles[0]?.entry.officialDistance ?? 0;
  return vehicles.map(({ team, entry }, index) => ({
    rank: index + 1,
    team,
    entry,
    gapText: index === 0 ? 'LEADER' : formatVehicleGap(leaderDistance - entry.officialDistance),
  }));
}

function formatVehicleGap(gap: number): string {
  if (gap < 1) return `+${gap.toFixed(3)} LAP`;
  return `+${gap.toFixed(1)} LAPS`;
}

function createVehicleCard(
  vehicle: RankedVehicle,
  onFocus: (terminalID: string) => void,
  raceMode: SyncMessage['raceMode'],
) {
  const element = document.createElement('article');
  element.className = 'vehicle-card';
  element.setAttribute('role', 'listitem');

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'vehicle-row';
  action.dataset.terminalId = vehicle.entry.id;
  action.addEventListener('click', () => onFocus(vehicle.entry.id));

  const rank = document.createElement('span');
  rank.className = 'vehicle-rank mono';

  const chip = document.createElement('span');
  chip.className = 'vehicle-chip';

  const body = document.createElement('span');
  body.className = 'vehicle-body';
  const identity = document.createElement('span');
  identity.className = 'vehicle-identity';
  const teamName = document.createElement('span');
  teamName.className = 'vehicle-team';
  const separator = document.createElement('span');
  separator.className = 'vehicle-separator';
  separator.textContent = ' / ';
  const tab = document.createElement('span');
  tab.className = 'vehicle-tab';
  identity.append(teamName, separator, tab);

  const meta = document.createElement('span');
  meta.className = 'vehicle-meta';
  const kind = document.createElement('span');
  kind.className = 'vehicle-kind';
  const onboard = document.createElement('span');
  onboard.className = 'onboard-tag';
  onboard.textContent = 'ONBOARD';
  const status = document.createElement('span');
  status.className = 'vehicle-status';
  const stint = document.createElement('span');
  stint.className = 'vehicle-stint';
  const alert = document.createElement('span');
  alert.className = 'vehicle-alert';
  meta.append(kind, onboard, status, stint, alert);

  const crewDetail = document.createElement('span');
  crewDetail.className = 'crew-detail';
  const counts = document.createElement('span');
  counts.className = 'crew-counts mono';
  crewDetail.append(counts);
  body.append(identity, meta, crewDetail);

  const telemetry = document.createElement('span');
  telemetry.className = 'vehicle-telemetry mono';
  const gap = document.createElement('span');
  gap.className = 'vehicle-gap';
  const distance = document.createElement('span');
  distance.className = 'vehicle-distance';
  telemetry.append(gap, distance);

  action.append(rank, chip, body, telemetry);
  element.append(action);

  function update(next: RankedVehicle, mode: SyncMessage['raceMode']): void {
    const { entry, team } = next;
    const color = teamColor(team.colorToken, true);
    element.style.setProperty('--team-color', color);
    element.dataset.teamId = team.id;
    element.classList.toggle('is-offline', entry.isLastKnown);
    element.classList.toggle('is-yellow-flag', entry.causesYellowFlag);
    element.classList.toggle('is-onboard', entry.isFocused);
    action.dataset.terminalId = entry.id;
    rank.textContent = `P${next.rank}`;
    chip.style.background = color;
    chip.style.color = contrastText(color);
    chip.textContent = String(entry.carNumber);
    teamName.textContent = team.label.toUpperCase();
    tab.textContent = entry.tabLabel;
    kind.textContent = mode === 'continuous' ? entry.statusText : entry.agentKind.toUpperCase();
    const statusColor = rowStatusColor(entry);
    status.textContent = mode === 'continuous' ? entry.crewState.toUpperCase() : entry.statusText;
    status.style.color = statusColor;
    status.style.background = hexAlpha(statusColor, 0.14);
    stint.textContent = entry.showsNewStint ? 'NEW STINT' : '';
    alert.textContent = entry.isLastKnown ? 'LAST KNOWN' : '';
    onboard.hidden = !entry.isFocused;
    crewDetail.hidden = mode !== 'continuous';
    counts.textContent =
      `W${entry.crewCounts.working} · I${entry.crewCounts.idle} · ` +
      `D${entry.crewCounts.done} · B${entry.crewCounts.blocked}`;
    gap.textContent = next.gapText;
    distance.textContent = `${entry.officialDistance.toFixed(2)} LAPS`;
    action.setAttribute(
      'aria-label',
      `Position ${next.rank}, car ${entry.carNumber}, ${team.label}, ${entry.tabLabel}, ` +
        `${entry.statusText.toLowerCase()}, ${next.gapText.toLowerCase()}, focus in Herdr`,
    );
  }

  update(vehicle, raceMode);
  return { element, update };
}

/** Personal-mode constructor standings, kept identical to the original local dashboard. */
function createConstructorStandingsPanel(
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
    const active = document.activeElement as HTMLElement | null;
    const focusedTerminal = active?.dataset?.terminalId ?? null;
    cards.clear();
    container.replaceChildren(...sync.teams.map(team => {
      const card = createTeamCard(team, onFocus, sync.raceMode);
      cards.set(team.id, card);
      return card.element;
    }));
    if (focusedTerminal !== null) {
      container.querySelector<HTMLElement>(
        `[data-terminal-id="${CSS.escape(focusedTerminal)}"]`,
      )?.focus();
    }
  }

  return { render, setMyTeam: (_teamID: string | null) => {} };
}

function createTeamCard(
  team: TeamStanding,
  onFocus: (terminalID: string) => void,
  raceMode: SyncMessage['raceMode'],
) {
  const color = teamColor(team.colorToken);
  const element = document.createElement('article');
  element.className = 'team-card';
  element.setAttribute('role', 'listitem');
  const accent = document.createElement('span');
  accent.className = 'team-accent';
  accent.style.background = color;
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
    const row = createAgentRow(entry, color, onFocus, raceMode);
    rows.set(entry.id, row);
    element.append(row.element);
  });

  function update(next: TeamStanding, mode: SyncMessage['raceMode']): void {
    rank.textContent = `P${next.rank}`;
    name.textContent = next.label.toUpperCase();
    alert.textContent = next.isOffline
      ? 'TEAM OFFLINE'
      : next.blockedCount > 0 ? `${next.blockedCount} BLOCKED` : '';
    element.classList.toggle('is-offline', next.isOffline);
    element.classList.toggle('is-blocked', !next.isOffline && next.blockedCount > 0);
    const distance = document.createElement('span');
    distance.className = 'distance';
    distance.textContent = next.distanceText;
    stats.replaceChildren(
      distance,
      `  ${next.gapText}  ${next.entries.length} CAR${next.entries.length === 1 ? '' : 'S'}`,
    );
    element.setAttribute('aria-label', `P${next.rank}, ${next.label}, ${next.distanceText.toLowerCase()}, ${next.entries.length} cars`);
    for (const entry of next.entries) rows.get(entry.id)?.update(entry, mode);
  }

  update(team, raceMode);
  return { element, update };
}

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

  function update(next: EntryPresentation, mode: SyncMessage['raceMode']): void {
    const workspace = document.createElement('span');
    workspace.className = 'workspace';
    workspace.textContent = next.workspaceLabel;
    const separator = document.createElement('span');
    separator.className = 'separator';
    separator.textContent = ' / ';
    const tab = document.createElement('span');
    tab.className = 'tab';
    tab.textContent = next.tabLabel;
    main.replaceChildren(workspace, separator, tab);
    kind.textContent = mode === 'continuous' ? next.statusText : next.agentKind.toUpperCase();
    const statusColor = rowStatusColor(next);
    status.textContent = mode === 'continuous' ? next.crewState.toUpperCase() : next.statusText;
    status.style.color = statusColor;
    status.style.background = hexAlpha(statusColor, 0.14);
    stint.textContent = next.showsNewStint ? 'NEW STINT' : '';
    crewDetail.hidden = mode !== 'continuous';
    const total = Object.values(next.crewCounts).reduce((sum, value) => sum + value, 0);
    for (const [key, segment] of segments) {
      segment.style.width = `${total === 0 ? 0 : next.crewCounts[key] / total * 100}%`;
    }
    counts.textContent = `W${next.crewCounts.working} · I${next.crewCounts.idle} · D${next.crewCounts.done} · B${next.crewCounts.blocked}`;
    lastKnown.textContent = next.isLastKnown ? 'LAST KNOWN' : '';
    element.classList.toggle('is-onboard', next.isFocused);
    element.classList.toggle('is-yellow-flag', next.causesYellowFlag);
    onboard.hidden = !next.isFocused;
    element.setAttribute('aria-label', `Car ${next.carNumber}, ${next.workspaceLabel}, ${next.tabLabel}, ${next.agentKind}, ${next.statusText.toLowerCase()}, ${next.causesYellowFlag ? 'yellow flag, ' : ''}Focus in Herdr`);
  }

  update(entry, raceMode);
  return { element, update };
}
