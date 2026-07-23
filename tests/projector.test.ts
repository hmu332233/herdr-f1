import { describe, expect, it } from 'vitest';
import { decodeSnapshotResponse, projectSnapshot } from '../src/server/herdr/projector.js';

/** Raw herdr wire shapes (snake_case) as session.snapshot returns them. */
function rawSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocol: 16,
    workspaces: [
      { workspace_id: 'ws-a', number: 1, label: 'herdr' },
      { workspace_id: 'ws-b', number: 2, label: 'herdr-f1' },
      { workspace_id: 'ws-empty', number: 3, label: 'no-agents' },
    ],
    tabs: [
      { tab_id: 'tab-1', workspace_id: 'ws-a', label: 'core' },
      { tab_id: 'tab-2', workspace_id: 'ws-a', label: '', title: 'socket', name: 'ignored' },
      { tab_id: 'tab-3', workspace_id: 'ws-b', label: null, title: null, name: 'dashboard' },
    ],
    agents: [
      {
        terminal_id: 't1', pane_id: 'p1', workspace_id: 'ws-a', tab_id: 'tab-1',
        agent_status: 'working', display_agent: 'claude', focused: false,
        agent_session: { source: 'herdr:claude', kind: 'id', value: 'uuid-1' },
      },
      {
        terminal_id: 't2', pane_id: 'p2', workspace_id: 'ws-a', tab_id: 'tab-2',
        agent_status: 'idle', agent: 'codex', focused: true,
        agent_session_id: 'legacy-session',
      },
      {
        terminal_id: 't3', pane_id: 'p3', workspace_id: 'ws-b', tab_id: 'tab-3',
        agent_status: 'blocked', name: 'aider',
      },
      // unknown status → filtered out entirely
      { terminal_id: 't4', pane_id: 'p4', workspace_id: 'ws-b', tab_id: 'tab-3', agent_status: 'unknown' },
      // missing tab → falls back to pane id; missing kind → 'Agent'
      { terminal_id: 't5', pane_id: 'p5', workspace_id: 'ws-b', agent_status: 'done' },
    ],
    focused_pane_id: 'p3',
    ...overrides,
  };
}

describe('projectSnapshot', () => {
  it('projects workspaces with agents into ordered teams', () => {
    const snapshot = projectSnapshot(rawSnapshot());
    expect(snapshot.teams.map(team => team.id)).toEqual(['ws-a', 'ws-b']);
    expect(snapshot.teams.map(team => team.label)).toEqual(['herdr', 'herdr-f1']);
    expect(snapshot.teams[0].agents.map(agent => agent.terminalID)).toEqual(['t1', 't2']);
    expect(snapshot.teams[1].agents.map(agent => agent.terminalID)).toEqual(['t3', 't5']);
  });

  it('maps labels, kinds, focus, and session references', () => {
    const [teamA, teamB] = projectSnapshot(rawSnapshot()).teams;
    const [t1, t2] = teamA.agents;
    expect(t1.tabLabel).toBe('core');
    expect(t1.agentKind).toBe('claude');
    expect(t1.agentSessionReference).toBe('herdr:claude|id|uuid-1');
    expect(t1.isFocused).toBe(false);
    expect(t2.tabLabel).toBe('socket'); // empty label falls through to title
    expect(t2.agentKind).toBe('codex');
    expect(t2.agentSessionReference).toBe('legacy-session');
    expect(t2.isFocused).toBe(true); // focused flag
    const [t3, t5] = teamB.agents;
    expect(t3.tabLabel).toBe('dashboard'); // label/title null falls through to name
    expect(t3.agentKind).toBe('aider');
    expect(t3.isFocused).toBe(true); // focused_pane_id === p3
    expect(t5.tabLabel).toBe('p5'); // no tab id → pane id
    expect(t5.agentKind).toBe('Agent');
    expect(t5.agentSessionReference).toBeNull();
  });

  it('filters unknown statuses and empty workspaces', () => {
    const snapshot = projectSnapshot(rawSnapshot());
    const ids = snapshot.teams.flatMap(team => team.agents.map(agent => agent.terminalID));
    expect(ids).not.toContain('t4');
    expect(snapshot.teams.find(team => team.id === 'ws-empty')).toBeUndefined();
  });

  it('rejects unsupported protocol versions', () => {
    expect(() => projectSnapshot(rawSnapshot({ protocol: 999 })))
      .toThrowError(/Unsupported Herdr protocol 999/);
  });

  it('rejects malformed snapshots', () => {
    expect(() => projectSnapshot(null)).toThrowError(/malformed snapshot/);
    expect(() => projectSnapshot({ protocol: 16 })).toThrowError(/malformed snapshot/);
  });
});

describe('decodeSnapshotResponse', () => {
  it('unwraps a session_snapshot result', () => {
    const envelope = { id: 'snapshot-1', result: { type: 'session_snapshot', snapshot: rawSnapshot() } };
    expect(decodeSnapshotResponse(envelope).teams).toHaveLength(2);
  });

  it('rejects unexpected result types', () => {
    const envelope = { id: 'x', result: { type: 'something_else', snapshot: rawSnapshot() } };
    expect(() => decodeSnapshotResponse(envelope)).toThrowError(/Unsupported Herdr response: something_else/);
  });

  it('rejects a missing result', () => {
    expect(() => decodeSnapshotResponse({ id: 'x' })).toThrowError(/missing result/);
  });
});
