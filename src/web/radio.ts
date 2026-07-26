import type { SyncMessage } from '../shared/protocol.js';
import type { RadioMessage } from '../shared/presentation.js';
import { contrastText, teamColor } from './palette.js';

const COLLAPSED_KEY = 'herdr-f1.radio-collapsed';

export interface RadioTickerElements {
  /** The whole panel; carries the collapsed state for CSS. */
  panel: HTMLElement;
  /** Header button that toggles the panel. */
  toggle: HTMLButtonElement;
  /** Line count shown while collapsed. */
  count: HTMLElement;
  /** Row list. */
  container: HTMLElement;
  /** RADIO SILENCE placeholder. */
  empty: HTMLElement;
}

/** TEAM RADIO ticker. Newest line first. Sync carries the whole history
 *  window every tick, so rows are keyed by message ID: existing rows are left
 *  untouched and only genuinely new lines animate in.
 *
 *  The panel collapses to its header; the choice persists so it survives the
 *  reloads and reconnects that a long-running dashboard accumulates. */
export function createRadioTicker(
  elements: RadioTickerElements,
  onFocus: (terminalID: string) => void,
) {
  const { panel, toggle, count, container, empty } = elements;
  const rows = new Map<number, HTMLElement>();
  /** Highest ID seen. Anything above it is new and gets the entry animation;
   *  this also keeps a full-window replay after reconnect from animating. */
  let highWaterMark = 0;
  let collapsed = loadCollapsed();

  applyCollapsed();
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    applyCollapsed();
    // Storage can be unavailable (private mode, blocked cookies); the toggle
    // must still work, it just will not be remembered.
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignored: persistence is a convenience, not a requirement.
    }
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

    // A new Grand Prix clears the radio; restart so its first lines animate.
    if (radio.length === 0) {
      highWaterMark = 0;
      return;
    }

    let nextHighWaterMark = highWaterMark;
    // Newest line on top. Walking oldest-to-newest and prepending each would
    // invert a multi-line batch (the whole window on first paint), so insert
    // newest-first and anchor each row ahead of the next-oldest one already
    // in the DOM.
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

/** Expanded unless the viewer previously collapsed the panel. */
function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
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

  // Workspace / tab, matching how the standings name an agent.
  const source = document.createElement('span');
  source.className = 'radio-source';
  const teamLabel = document.createElement('span');
  teamLabel.className = 'radio-team';
  teamLabel.textContent = message.teamLabel.toUpperCase();
  const separator = document.createElement('span');
  separator.className = 'radio-separator';
  separator.textContent = ' / ';
  const tabLabel = document.createElement('span');
  tabLabel.className = 'radio-tab';
  tabLabel.textContent = message.tabLabel;
  source.append(teamLabel, separator, tabLabel);

  const text = document.createElement('span');
  text.className = 'radio-text';
  text.textContent = message.text;

  element.append(time, lap, chip, source, text);
  element.setAttribute(
    'aria-label',
    `${message.timeText}, lap ${message.lap}, car ${message.carNumber}, ` +
      `${message.teamLabel} ${message.tabLabel}: ${message.text} Focus in Herdr`,
  );
  return element;
}
