import './style.css';
import { createChrome } from './chrome.js';
import { createMyTeamDashboard } from './my-team.js';
import { createRadioBroadcast, createRadioTicker } from './radio.js';
import { CIRCUITS, circuitByID, DEFAULT_CIRCUIT_ID } from './circuits.js';
import { createStandingsPanel } from './standings.js';
import { createTrackRenderer } from './track.js';
import type { SyncMessage } from '../shared/protocol.js';

let socket: WebSocket | null = null;
const sendFocus = (terminalID: string): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'focus', terminalID }));
  }
};

/** Tells the server how long the selected circuit's race is. The drawing is a
 *  per-browser choice, but the distance it implies is race state — the server
 *  owns the finish, so it has to be told. */
const sendCircuitLaps = (circuitID: string): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'circuit', totalLaps: circuitByID(circuitID).laps }));
  }
};

// Circuit choice is a per-browser view preference, not race state: the server
// owns standings and scoring, so two viewers may watch the same race on
// different layouts without disagreeing about anything that counts.
const CIRCUIT_STORAGE_KEY = 'herdr-f1.circuit';

function storedCircuitID(): string {
  try {
    return circuitByID(localStorage.getItem(CIRCUIT_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_CIRCUIT_ID; // Private-mode storage access can throw.
  }
}

const chrome = createChrome();
const standings = createStandingsPanel(document.getElementById('standings')!, sendFocus);
const track = createTrackRenderer(
  document.getElementById('track') as HTMLCanvasElement,
  sendFocus,
  storedCircuitID(),
);
const myTeam = createMyTeamDashboard({
  select: document.getElementById('my-team-select') as HTMLSelectElement,
  summary: document.getElementById('my-team-summary')!,
  cars: document.getElementById('my-team-cars')!,
  empty: document.getElementById('my-team-empty')!,
  onTeamChange: standings.setMyTeam,
});
const radio = createRadioBroadcast(document.getElementById('broadcast-radio')!);
const localRadio = createRadioTicker({
  panel: document.getElementById('radio-column')!,
  toggle: document.getElementById('radio-toggle') as HTMLButtonElement,
  count: document.getElementById('radio-count')!,
  container: document.getElementById('radio')!,
  empty: document.getElementById('radio-empty')!,
}, sendFocus);
const teamColumn = document.getElementById('team-column')!;
const radioColumn = document.getElementById('radio-column')!;
const standingsTitle = document.getElementById('standings-title')!;
const standingsContainer = document.getElementById('standings')!;

let sync: SyncMessage | null = null;

const circuitSelect = document.getElementById('circuit-select') as HTMLSelectElement;
circuitSelect.replaceChildren(...CIRCUITS.map(circuit => {
  const option = document.createElement('option');
  option.value = circuit.id;
  option.textContent = `${circuit.flag}  ${circuit.name}`;
  return option;
}));
circuitSelect.value = track.currentCircuitID();
circuitSelect.addEventListener('change', () => {
  track.setCircuit(circuitSelect.value);
  sendCircuitLaps(circuitSelect.value);
  try {
    localStorage.setItem(CIRCUIT_STORAGE_KEY, circuitSelect.value);
  } catch {
    // A rejected write only costs persistence; the swap already happened.
  }
  // Redraw immediately so the new layout appears before the next sync.
  if (sync) track.frame(performance.now());
});

/** Applies the lock, and only when it actually changes.
 *
 *  Gecko rolls up an open `<select>` dropdown when the element's attributes
 *  mutate, and assigning an attribute the value it already holds still counts
 *  as a mutation. Since the caller runs on every sync frame — four times a
 *  second — an unguarded write dismisses the dropdown within 250ms of the
 *  viewer opening it, so a circuit can never be picked in Firefox. */
function lockPicker(locked: boolean): void {
  if (circuitSelect.disabled === locked) return;
  circuitSelect.disabled = locked;
  if (locked) circuitSelect.title = 'Circuit is set by the multiplayer host';
  else circuitSelect.removeAttribute('title');
}

/** Multiplayer: the host owns the venue, so every viewer follows the same
 *  circuit as it rotates between races and the selector is locked — viewers
 *  are anonymous and shared race state accepts no anonymous writes. Local mode
 *  syncs carry no circuitID and the selector stays a per-browser choice. */
function followPinnedCircuit(circuitID: string | undefined): void {
  if (circuitID === undefined) {
    lockPicker(false);
    return;
  }
  if (track.currentCircuitID() !== circuitID) {
    track.setCircuit(circuitID);
    circuitSelect.value = track.currentCircuitID();
  }
  lockPicker(true);
}

function frame(now: number): void {
  if (sync) track.frame(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function connect(): void {
  socket = new WebSocket(`ws://${location.host}/ws`);
  // The server starts on a default distance and cannot know the viewer's stored
  // circuit, so announce it as soon as there is a socket to announce it on —
  // including after a reconnect, which may be a restarted server.
  socket.onopen = () => sendCircuitLaps(circuitSelect.value);
  socket.onmessage = event => {
    sync = JSON.parse(event.data as string) as SyncMessage;
    const multiplayer = sync.circuitID !== undefined;
    document.documentElement.classList.toggle('is-multiplayer', multiplayer);
    document.documentElement.classList.toggle('is-local', !multiplayer);
    teamColumn.hidden = !multiplayer;
    radioColumn.hidden = multiplayer;
    standingsTitle.textContent = multiplayer ? 'STANDINGS' : 'CONSTRUCTORS';
    standingsContainer.setAttribute(
      'aria-label',
      multiplayer ? 'Race standings' : 'Constructors standings',
    );
    followPinnedCircuit(sync.circuitID);
    chrome.render(sync);
    standings.render(sync);
    if (multiplayer) {
      myTeam.render(sync);
      radio.render(sync);
    } else {
      radio.reset();
      localRadio.render(sync);
    }
    track.setSync(sync, performance.now());
  };
  socket.onclose = () => setTimeout(connect, 1000);
}
connect();

new ResizeObserver(() => {
  track.resize();
  if (sync) track.frame(performance.now());
}).observe(document.getElementById('track-wrap')!);

// Registers the worker that makes the dashboard installable as its own window.
// It caches nothing (see public/sw.js) — this is purely so the browser offers
// the install action. A failure here costs only that offer, so it is swallowed:
// the dashboard itself works the same in a tab.
if ('serviceWorker' in navigator) {
  // After load, so registration never competes with the first race sync.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
