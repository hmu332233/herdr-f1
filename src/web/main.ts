import './style.css';
import { createChrome } from './chrome.js';
import { createStandingsPanel } from './standings.js';
import { createTrackRenderer } from './track.js';
import type { SyncMessage } from '../shared/protocol.js';

let socket: WebSocket | null = null;
const sendFocus = (terminalID: string): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'focus', terminalID }));
  }
};

const chrome = createChrome();
const standings = createStandingsPanel(document.getElementById('standings')!, sendFocus);
const track = createTrackRenderer(document.getElementById('track') as HTMLCanvasElement, sendFocus);

let sync: SyncMessage | null = null;

function frame(now: number): void {
  if (sync) track.frame(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function connect(): void {
  socket = new WebSocket(`ws://${location.host}/ws`);
  socket.onmessage = event => {
    sync = JSON.parse(event.data as string) as SyncMessage;
    chrome.render(sync);
    standings.render(sync);
    track.setSync(sync, performance.now());
  };
  socket.onclose = () => setTimeout(connect, 1000);
}
connect();

new ResizeObserver(() => {
  track.resize();
  if (sync) track.frame(performance.now());
}).observe(document.getElementById('track-wrap')!);
