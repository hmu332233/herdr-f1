import type { AgentStatus } from '../../shared/presentation.js';
import type { SourceAgent, SourceSnapshot, SourceTeam } from './types.js';

// herdr 0.7.5 ships protocol 17; the snapshot shape (workspaces/tabs/panes/
// agents with object agent_session) is unchanged from 16, so both are accepted.
export const SUPPORTED_PROTOCOL = 17;

/** Any malformed, unsupported, or server-reported protocol problem. */
export class HerdrProtocolFault extends Error {}

const STATUSES: ReadonlySet<string> = new Set(['idle', 'working', 'done', 'blocked']);

/** Unwraps a session.snapshot response envelope and projects it. */
export function decodeSnapshotResponse(envelope: unknown): SourceSnapshot {
  const result = (envelope as { result?: unknown })?.result as
    | { type?: unknown; snapshot?: unknown }
    | undefined;
  if (typeof result !== 'object' || result === null) {
    throw new HerdrProtocolFault('Invalid Herdr response: missing result');
  }
  if (result.type !== 'session_snapshot') {
    throw new HerdrProtocolFault(`Unsupported Herdr response: ${String(result.type)}`);
  }
  return projectSnapshot(result.snapshot);
}

export function projectSnapshot(snapshot: unknown): SourceSnapshot {
  const raw = snapshot as {
    protocol?: unknown;
    workspaces?: unknown;
    tabs?: unknown;
    agents?: unknown;
    focused_pane_id?: unknown;
  } | null;
  if (
    typeof raw !== 'object' || raw === null ||
    !Array.isArray(raw.workspaces) || !Array.isArray(raw.agents)
  ) {
    throw new HerdrProtocolFault('Invalid Herdr response: malformed snapshot');
  }
  if (typeof raw.protocol !== 'number' || raw.protocol > SUPPORTED_PROTOCOL) {
    throw new HerdrProtocolFault(`Unsupported Herdr protocol ${String(raw.protocol)}`);
  }

  const tabs = new Map<string, { label?: string | null; title?: string | null; name?: string | null }>();
  for (const tab of (Array.isArray(raw.tabs) ? raw.tabs : []) as Array<{ tab_id?: string }>) {
    if (typeof tab?.tab_id === 'string') tabs.set(tab.tab_id, tab as never);
  }

  const focusedPaneID = typeof raw.focused_pane_id === 'string' ? raw.focused_pane_id : null;
  const agentsByWorkspace = new Map<string, SourceAgent[]>();
  for (const agent of raw.agents as Array<Record<string, unknown>>) {
    const status = agent?.agent_status;
    if (typeof status !== 'string' || !STATUSES.has(status)) continue;
    const workspaceID = String(agent.workspace_id ?? '');
    const paneID = String(agent.pane_id ?? '');
    const entry: SourceAgent = {
      terminalID: String(agent.terminal_id ?? ''),
      paneID,
      workspaceID,
      tabLabel: tabLabel(agent, tabs),
      agentKind:
        firstVisible(agent.display_agent, agent.agent, agent.name) ?? 'Agent',
      agentSessionReference: sessionReference(agent),
      isFocused: agent.focused === true || (focusedPaneID !== null && paneID === focusedPaneID),
      status: status as AgentStatus,
    };
    const list = agentsByWorkspace.get(workspaceID) ?? [];
    list.push(entry);
    agentsByWorkspace.set(workspaceID, list);
  }

  const teams: SourceTeam[] = [];
  for (const workspace of raw.workspaces as Array<{ workspace_id?: string; label?: string }>) {
    const id = workspace?.workspace_id;
    if (typeof id !== 'string') continue;
    const agents = agentsByWorkspace.get(id);
    if (!agents || agents.length === 0) continue;
    teams.push({ id, label: workspace.label ?? id, agents });
  }
  return { teams };
}

function tabLabel(
  agent: Record<string, unknown>,
  tabs: Map<string, { label?: string | null; title?: string | null; name?: string | null }>,
): string {
  const tabID = typeof agent.tab_id === 'string' ? agent.tab_id : null;
  const tab = tabID === null ? undefined : tabs.get(tabID);
  if (!tab) return tabID ?? String(agent.pane_id ?? '');
  return firstVisible(tab.label, tab.title, tab.name) ?? (tabID as string);
}

/** Opaque identity token used only for NEW STINT detection; never shown. */
function sessionReference(agent: Record<string, unknown>): string | null {
  const session = agent.agent_session as
    | { source?: string | null; agent?: string | null; kind?: string | null; value?: string | null }
    | undefined;
  if (session && firstVisible(session.value) !== null) {
    return [session.source, session.kind, session.value]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join('|');
  }
  return firstVisible(agent.agent_session_id, agent.agent_session_path);
}

function firstVisible(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}
