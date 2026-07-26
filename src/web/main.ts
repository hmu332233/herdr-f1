import './style.css';
import { createChrome } from './chrome.js';
import { createRadioTicker } from './radio.js';
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
const radio = createRadioTicker(
  {
    panel: document.getElementById('radio-column')!,
    toggle: document.getElementById('radio-toggle') as HTMLButtonElement,
    count: document.getElementById('radio-count')!,
    container: document.getElementById('radio')!,
    empty: document.getElementById('radio-empty')!,
  },
  sendFocus,
);

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
    chrome.render(sync);
    standings.render(sync);
    radio.render(sync);
    track.setSync(sync, performance.now());
  };
  socket.onclose = () => setTimeout(connect, 1000);
}
connect();

new ResizeObserver(() => {
  track.resize();
  if (sync) track.frame(performance.now());
}).observe(document.getElementById('track-wrap')!);
