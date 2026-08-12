import type { SyncMessage } from '../shared/protocol.js';
import type { EntryPresentation, TeamStanding } from '../shared/presentation.js';
import { rowStatusColor, teamColor } from './palette.js';
import { rankVehicles, type RankedVehicle } from './standings.js';

const STORAGE_KEY = 'herdr-f1.my-team';
const NOMINAL_LAPS_PER_SECOND = 1 / 18;

interface MyTeamElements {
  select: HTMLSelectElement;
  summary: HTMLElement;
  cars: HTMLElement;
  empty: HTMLElement;
  onTeamChange?: (teamID: string | null) => void;
}

/** Browser-local identity panel. The host remains anonymous and authoritative;
 * choosing MY TEAM only changes this viewer's presentation. */
export function createMyTeamDashboard(elements: MyTeamElements) {
  const { select, summary, cars, empty, onTeamChange } = elements;
  let selectedTeamID: string | null = loadStoredTeam();
  let notifiedTeamID: string | null | undefined;
  const teamHint = new URLSearchParams(location.search).get('team');
  let optionSignature = '';
  let latestSync: SyncMessage | null = null;

  select.addEventListener('change', () => {
    selectedTeamID = select.value || null;
    try {
      if (selectedTeamID === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, selectedTeamID);
    } catch {
      // The selection still works for this page when persistence is blocked.
    }
    if (latestSync) renderSelected(latestSync);
    notifyTeamChange();
  });

  function render(sync: SyncMessage): void {
    latestSync = sync;
    reconcileOptions(sync.teams);
    if (selectedTeamID === null && teamHint) {
      const normalized = teamHint.trim().toLocaleLowerCase();
      const hinted = sync.teams.find(team =>
        team.id.toLocaleLowerCase() === normalized || team.label.toLocaleLowerCase() === normalized);
      if (hinted) {
        selectedTeamID = hinted.id;
        try { localStorage.setItem(STORAGE_KEY, hinted.id); } catch { /* optional */ }
      }
    }
    if (selectedTeamID !== null && !sync.teams.some(team => team.id === selectedTeamID)) {
      selectedTeamID = null;
    }
    select.value = selectedTeamID ?? '';
    notifyTeamChange();
    renderSelected(sync);
  }

  function reconcileOptions(teams: TeamStanding[]): void {
    const ordered = teams.slice().sort((a, b) =>
      a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
    const signature = ordered.map(team => `${team.id}:${team.label}`).join('|');
    if (signature === optionSignature) return;
    optionSignature = signature;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'SELECT TEAM';
    select.replaceChildren(placeholder, ...ordered.map(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.label.toUpperCase();
      return option;
    }));
  }

  function renderSelected(sync: SyncMessage): void {
    const team = sync.teams.find(candidate => candidate.id === selectedTeamID);
    empty.hidden = team !== undefined;
    cars.hidden = team === undefined;
    if (!team) {
      summary.textContent = '';
      cars.replaceChildren();
      return;
    }

    summary.textContent = `TEAM P${team.rank} · ${team.gapText}`;
    const ranked = rankVehicles(sync);
    const byID = new Map(ranked.map(vehicle => [vehicle.entry.id, vehicle]));
    const entries = team.entries.slice().sort((a, b) =>
      (byID.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER) -
        (byID.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER) ||
      a.carNumber - b.carNumber);
    cars.replaceChildren(
      createTimingHeader(sync.raceMode === 'continuous'),
      ...entries.map(entry => createMyCar(
        team, entry, byID.get(entry.id), sync.raceMode === 'continuous',
      )),
    );
  }

  function notifyTeamChange(): void {
    if (notifiedTeamID === selectedTeamID) return;
    notifiedTeamID = selectedTeamID;
    onTeamChange?.(selectedTeamID);
  }

  return { render };
}

function createTimingHeader(showsTires: boolean): HTMLElement {
  const header = document.createElement('div');
  header.className = 'my-team-table-header my-team-grid';
  header.classList.toggle('has-tires', showsTires);
  header.setAttribute('role', 'presentation');
  const labels = ['', 'CAR', 'POS', 'SESSION', 'STATUS', 'GAP', 'PACE'];
  if (showsTires) labels.push('TYRE');
  labels.push('STINT', 'CREW');
  for (const label of labels) {
    const cell = document.createElement('span');
    cell.textContent = label;
    header.append(cell);
  }
  return header;
}

function createMyCar(
  team: TeamStanding,
  entry: EntryPresentation,
  ranked: RankedVehicle | undefined,
  showsTires: boolean,
): HTMLElement {
  const color = teamColor(team.colorToken, true);
  const row = document.createElement('article');
  row.className = 'my-car my-team-grid';
  row.classList.toggle('has-tires', showsTires);
  row.setAttribute('role', 'listitem');
  row.style.setProperty('--team-color', color);
  row.classList.toggle('is-working', entry.crewState === 'working');
  row.classList.toggle('is-offline', entry.isLastKnown);
  row.classList.toggle('is-blocked', entry.causesYellowFlag);

  const marker = document.createElement('span');
  marker.className = 'my-car-marker';
  marker.style.background = color;

  const carNumber = document.createElement('strong');
  carNumber.className = 'my-car-number mono';
  carNumber.textContent = String(entry.carNumber);

  const position = document.createElement('strong');
  position.className = 'my-car-position mono';
  position.textContent = ranked ? `P${ranked.rank}` : '—';

  const session = document.createElement('span');
  session.className = 'my-car-session';
  session.textContent = entry.tabLabel.toUpperCase();

  const state = document.createElement('span');
  state.className = 'my-car-state';
  const stateColor = rowStatusColor(entry);
  state.textContent = entry.crewState.toUpperCase();
  state.style.color = stateColor;

  const gap = document.createElement('strong');
  gap.className = 'my-car-gap mono';
  gap.textContent = ranked?.gapText ?? '—';

  const pace = document.createElement('span');
  pace.className = 'my-car-pace mono';
  pace.textContent = entry.displaySpeed <= 0
    ? '0.00×'
    : `${(entry.displaySpeed / NOMINAL_LAPS_PER_SECOND).toFixed(2)}×`;

  const stint = document.createElement('span');
  stint.className = 'my-car-stint mono';
  stint.textContent = entry.statusText;

  const tire = document.createElement('span');
  tire.className = 'my-car-tire mono';
  const tireLife = entry.tireLife ?? 0;
  tire.dataset.level = tireLife <= 20 ? 'critical' : tireLife <= 50 ? 'worn' : 'fresh';
  tire.textContent = entry.tireLife === null ? '—' : `${Math.round(tireLife)}%`;

  const counts = document.createElement('span');
  counts.className = 'my-car-counts mono';
  counts.textContent =
    `W${entry.crewCounts.working} · I${entry.crewCounts.idle} · ` +
    `D${entry.crewCounts.done} · B${entry.crewCounts.blocked}`;

  const freshness = document.createElement('span');
  freshness.className = 'my-car-freshness';
  freshness.textContent = entry.isLastKnown ? 'LAST KNOWN' : '';

  row.append(marker, carNumber, position, session, state, gap, pace);
  if (showsTires) row.append(tire);
  row.append(stint, counts, freshness);
  row.setAttribute(
    'aria-label',
    `${team.label}, ${entry.tabLabel}, ${ranked ? `position ${ranked.rank}` : 'unranked'}, ` +
      `${entry.crewState}, ${showsTires ? `tyre ${Math.round(tireLife)} percent, ` : ''}` +
      `${ranked?.gapText ?? ''}`,
  );
  return row;
}

function loadStoredTeam(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
}
