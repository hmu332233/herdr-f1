import type { SyncMessage } from '../shared/protocol.js';
import type { RadioMessage } from '../shared/presentation.js';
import { contrastText, teamColor } from './palette.js';

const DISPLAY_MS = 5_000;
const EXIT_MS = 320;
const MAX_QUEUE = 4;

const COLLAPSED_KEY = 'herdr-f1.radio-collapsed';

export interface RadioTickerElements {
  panel: HTMLElement;
  toggle: HTMLButtonElement;
  count: HTMLElement;
  container: HTMLElement;
  empty: HTMLElement;
}

/** Personal-mode TEAM RADIO ticker. */
export function createRadioTicker(
  elements: RadioTickerElements,
  onFocus: (terminalID: string) => void,
) {
  const { panel, toggle, count, container, empty } = elements;
  const rows = new Map<number, HTMLElement>();
  let highWaterMark = 0;
  let collapsed = loadCollapsed();

  applyCollapsed();
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    applyCollapsed();
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* optional */ }
  });

  function applyCollapsed(): void {
    panel.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? 'Expand team radio' : 'Collapse team radio');
  }

  function render(sync: SyncMessage): void {
    const radio = sync.radio;
    empty.hidden = radio.length > 0;
    count.textContent = radio.length === 0 ? '' : String(radio.length);
    const present = new Set(radio.map(message => message.id));
    for (const [id, row] of rows) {
      if (present.has(id)) continue;
      row.remove();
      rows.delete(id);
    }
    if (radio.length === 0) {
      highWaterMark = 0;
      return;
    }
    let nextHighWaterMark = highWaterMark;
    let anchor: HTMLElement | null = null;
    for (let index = radio.length - 1; index >= 0; index -= 1) {
      const message = radio[index];
      let row = rows.get(message.id) ?? null;
      if (row === null) {
        row = createRadioRow(message, message.id > highWaterMark, onFocus);
        rows.set(message.id, row);
        if (anchor === null) container.prepend(row);
        else anchor.after(row);
        nextHighWaterMark = Math.max(nextHighWaterMark, message.id);
      }
      anchor = row;
    }
    highWaterMark = nextHighWaterMark;
  }

  return { render };
}

function loadCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; }
  catch { return false; }
}

function createRadioRow(
  message: RadioMessage,
  isNew: boolean,
  onFocus: (terminalID: string) => void,
): HTMLElement {
  const color = teamColor(message.colorToken);
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'radio-row' + (isNew ? ' is-new' : '');
  element.dataset.terminalId = message.terminalID;
  element.style.setProperty('--team-color', color);
  element.addEventListener('click', () => onFocus(message.terminalID));

  const time = document.createElement('span');
  time.className = 'radio-time';
  time.textContent = message.timeText;
  const lap = document.createElement('span');
  lap.className = 'radio-lap';
  lap.textContent = `L${message.lap}`;
  const chip = document.createElement('span');
  chip.className = 'radio-chip';
  chip.style.background = color;
  chip.style.color = contrastText(color);
  chip.textContent = String(message.carNumber);
  const source = document.createElement('span');
  source.className = 'radio-source';
  const team = document.createElement('span');
  team.className = 'radio-team';
  team.textContent = message.teamLabel.toUpperCase();
  const separator = document.createElement('span');
  separator.className = 'radio-separator';
  separator.textContent = ' / ';
  const tab = document.createElement('span');
  tab.className = 'radio-tab';
  tab.textContent = message.tabLabel;
  source.append(team, separator, tab);
  const text = document.createElement('span');
  text.className = 'radio-text';
  text.textContent = message.text;
  element.append(time, lap, chip, source, text);
  element.setAttribute('aria-label', `${message.timeText}, lap ${message.lap}, car ${message.carNumber}, ${message.teamLabel} ${message.tabLabel}: ${message.text} Focus in Herdr`);
  return element;
}

/** Shared race-broadcast radio graphic. Every viewer receives the same radio
 * window from the host; this client only sequences new lines into a TV-style
 * overlay without replaying the whole history after every sync. */
export function createRadioBroadcast(container: HTMLElement) {
  let grandPrix = 0;
  let highWaterMark = 0;
  let bootstrapped = false;
  let showing = false;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;
  const queue: RadioMessage[] = [];

  function render(sync: SyncMessage): void {
    if (sync.grandPrix !== grandPrix) {
      grandPrix = sync.grandPrix;
      highWaterMark = 0;
      bootstrapped = false;
      queue.length = 0;
      hideImmediately();
    }

    if (!bootstrapped) {
      bootstrapped = true;
      const latest = sync.radio[sync.radio.length - 1];
      highWaterMark = latest?.id ?? 0;
      if (latest) enqueue([latest]);
      return;
    }

    const incoming = sync.radio.filter(message => message.id > highWaterMark);
    if (incoming.length === 0) return;
    highWaterMark = Math.max(highWaterMark, ...incoming.map(message => message.id));
    enqueue(incoming);
  }

  function enqueue(messages: RadioMessage[]): void {
    queue.push(...messages);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (!showing) showNext();
  }

  function showNext(): void {
    const message = queue.shift();
    if (!message) {
      showing = false;
      return;
    }
    showing = true;
    paint(message);
    container.hidden = false;
    container.classList.remove('is-leaving');
    container.classList.remove('is-entering');
    void container.offsetWidth;
    container.classList.add('is-entering');
    showTimer = setTimeout(() => {
      container.classList.remove('is-entering');
      container.classList.add('is-leaving');
      exitTimer = setTimeout(() => {
        container.hidden = true;
        container.classList.remove('is-leaving');
        showing = false;
        showNext();
      }, EXIT_MS);
    }, DISPLAY_MS);
  }

  function paint(message: RadioMessage): void {
    const color = teamColor(message.colorToken, true);
    container.style.setProperty('--radio-team-color', color);

    const header = document.createElement('div');
    header.className = 'broadcast-radio-header';
    const team = document.createElement('strong');
    team.className = 'broadcast-radio-team';
    team.textContent = message.teamLabel.toUpperCase();
    const label = document.createElement('strong');
    label.className = 'broadcast-radio-label';
    label.textContent = 'RADIO';
    header.append(team, label);

    const signal = document.createElement('div');
    signal.className = 'broadcast-radio-signal';
    const chip = document.createElement('span');
    chip.className = 'broadcast-radio-chip mono';
    chip.style.background = color;
    chip.style.color = contrastText(color);
    chip.textContent = String(message.carNumber);
    const waveform = document.createElement('span');
    waveform.className = 'broadcast-radio-waveform';
    waveform.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 18; index += 1) {
      const bar = document.createElement('i');
      const height = 4 + ((message.id * 7 + index * 11) % 15);
      bar.style.height = `${height}px`;
      bar.style.animationDelay = `${index * -37}ms`;
      waveform.append(bar);
    }
    const lap = document.createElement('span');
    lap.className = 'broadcast-radio-lap mono';
    lap.textContent = `LAP ${message.lap}`;
    signal.append(chip, waveform, lap);

    const quote = document.createElement('blockquote');
    quote.className = 'broadcast-radio-quote';
    quote.textContent = `“${message.text}”`;
    const source = document.createElement('div');
    source.className = 'broadcast-radio-source';
    source.textContent = `${message.tabLabel.toUpperCase()} · ${message.timeText}`;

    container.replaceChildren(header, signal, quote, source);
    container.setAttribute(
      'aria-label',
      `Team radio from ${message.teamLabel}, car ${message.carNumber}: ${message.text}`,
    );
  }

  function hideImmediately(): void {
    if (showTimer) clearTimeout(showTimer);
    if (exitTimer) clearTimeout(exitTimer);
    showTimer = null;
    exitTimer = null;
    showing = false;
    container.hidden = true;
    container.classList.remove('is-entering', 'is-leaving');
  }

  return { render, reset: hideImmediately };
}
