/** join↔host protocol version. Mismatches are rejected with a clear error at
 *  the handshake, mirroring the herdr protocol policy. v3 carries a complete
 *  aggregate state partition for each two-car crew, still without per-agent
 *  rows or identities. */
export const MULTIPLAYER_PROTOCOL = 3;

export const CREWS_PER_TEAM = 2;

export const NAME_LENGTH_LIMIT = 24;

/** Cumulative counts of real agent status transitions since the join client
 *  started, kept per crew (M8). The host reads radio-worthy events off the
 *  diffs, so a lost snapshot or a reconnect can never lose an event — only
 *  batch it. */
export interface CrewCounters {
  incidents: number;   // → blocked
  recoveries: number;  // blocked → working | idle
  pits: number;        // working → idle
  greens: number;      // idle → working
  chequered: number;   // → done
  stints: number;      // agent session replaced (NEW STINT)
}

/** Everything a participant reports about one car's crew. Deliberately the
 *  entire vocabulary — counts only, no names, no per-agent identifiers
 *  (decision 12 strengthened by M7: hiding happens at transmission). */
export interface CrewReport {
  /** Agents assigned to this crew. A crew of 0 fields no car (M5). */
  size: number;
  /** Currently working — the power input (M3). */
  working: number;
  /** Currently blocked — an incident on this car. */
  blocked: number;
  /** The remaining mutually-exclusive crew states. Protocol v3 makes the
   *  complete aggregate available to the authoritative vehicle card. */
  idle: number;
  done: number;
  counters: CrewCounters;
}

/** join → host. `snapshot` always carries one report per potential car.
 *  `offline` marks the retained report as stale; the host applies the active
 *  race mode's offline motion rule. */
export type JoinMessage =
  | { type: 'hello'; protocol: number; name: string }
  | { type: 'snapshot'; crews: CrewReport[] }
  | { type: 'offline' };

/** host → join. `reject` reasons are user-facing terminal text. */
export type HostMessage =
  | { type: 'welcome' }
  | { type: 'reject'; reason: string };

export function emptyCounters(): CrewCounters {
  return { incidents: 0, recoveries: 0, pits: 0, greens: 0, chequered: 0, stints: 0 };
}

export function emptyCrewReport(): CrewReport {
  return { size: 0, working: 0, idle: 0, done: 0, blocked: 0, counters: emptyCounters() };
}

const COUNTER_KEYS = ['incidents', 'recoveries', 'pits', 'greens', 'chequered', 'stints'] as const;
const CREW_SIZE_LIMIT = 999;
const COUNTER_LIMIT = 1_000_000_000;

/** Trimmed display name, or null when unusable. The name is the team label and
 *  the reconnect key, so it must be visible text of a sane length. */
export function normalizeParticipantName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0 || name.length > NAME_LENGTH_LIMIT) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) return null;
  return name;
}

/** Strictly decodes one join-side message. Anything malformed — wrong shape,
 *  oversized fields, inconsistent counts — returns null; the join socket is
 *  untrusted network input, so nothing is coerced or partially accepted. */
export function decodeJoinMessage(raw: string): JoinMessage | null {
  const value = parseObject(raw);
  if (value === null) return null;
  if (value.type === 'hello') {
    if (typeof value.protocol !== 'number' || typeof value.name !== 'string') return null;
    const name = normalizeParticipantName(value.name);
    if (name === null) return null;
    return { type: 'hello', protocol: value.protocol, name };
  }
  if (value.type === 'offline') return { type: 'offline' };
  if (value.type === 'snapshot') {
    if (!Array.isArray(value.crews) || value.crews.length > CREWS_PER_TEAM) return null;
    const crews: CrewReport[] = [];
    for (const item of value.crews as unknown[]) {
      const crew = decodeCrew(item);
      if (crew === null) return null;
      crews.push(crew);
    }
    return { type: 'snapshot', crews };
  }
  return null;
}

function decodeCrew(value: unknown): CrewReport | null {
  if (typeof value !== 'object' || value === null) return null;
  const crew = value as Record<string, unknown>;
  const size = boundedCount(crew.size, CREW_SIZE_LIMIT);
  const working = boundedCount(crew.working, CREW_SIZE_LIMIT);
  const blocked = boundedCount(crew.blocked, CREW_SIZE_LIMIT);
  const idle = boundedCount(crew.idle, CREW_SIZE_LIMIT);
  const done = boundedCount(crew.done, CREW_SIZE_LIMIT);
  if (size === null || working === null || idle === null || done === null || blocked === null) return null;
  if (working + idle + done + blocked !== size) return null;
  if (typeof crew.counters !== 'object' || crew.counters === null) return null;
  const raw = crew.counters as Record<string, unknown>;
  const counters = emptyCounters();
  for (const key of COUNTER_KEYS) {
    const count = boundedCount(raw[key], COUNTER_LIMIT);
    if (count === null) return null;
    counters[key] = count;
  }
  return { size, working, idle, done, blocked, counters };
}

function boundedCount(value: unknown, limit: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 0 || value > limit) return null;
  return value;
}

/** Decodes one host-side reply on the join client. */
export function decodeHostMessage(raw: string): HostMessage | null {
  const value = parseObject(raw);
  if (value === null) return null;
  if (value.type === 'welcome') return { type: 'welcome' };
  if (value.type === 'reject' && typeof value.reason === 'string') {
    return { type: 'reject', reason: value.reason.slice(0, 200) };
  }
  return null;
}

function parseObject(raw: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
