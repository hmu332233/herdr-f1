import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** Builds a raw wire-shape snapshot (snake_case) around a list of raw agents. */
export function rawSnapshot(
  agents: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const workspaceIDs = [...new Set(agents.map(agent => String(agent.workspace_id ?? 'ws-1')))];
  return {
    protocol: 16,
    workspaces: workspaceIDs.length > 0
      ? workspaceIDs.map((id, index) => ({ workspace_id: id, number: index + 1, label: id }))
      : [{ workspace_id: 'ws-1', number: 1, label: 'ws-1' }],
    tabs: [],
    agents,
    focused_pane_id: null,
    ...overrides,
  };
}

export function rawAgent(
  terminalID: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    terminal_id: terminalID,
    pane_id: `pane-${terminalID}`,
    workspace_id: 'ws-1',
    agent_status: status,
    display_agent: 'claude',
    ...overrides,
  };
}

export async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitUntil timed out');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

/**
 * Fake herdr with the measured transport semantics: session.snapshot and
 * agent.focus answer one line then close; events.subscribe holds the
 * connection open, allows exactly one subscribe, and streams emitted events.
 */
export class FakeHerdr {
  snapshot: unknown;
  focusRequests: Array<Record<string, any>> = [];
  subscribeRequests: Array<Record<string, any>> = [];
  snapshotRequests = 0;
  /** Raw response line override per method (newline appended automatically). */
  rawResponses = new Map<string, string>();

  private readonly server: net.Server;
  private readonly sockets = new Set<net.Socket>();
  private readonly eventSockets = new Set<net.Socket>();

  private constructor(readonly socketPath: string, snapshot: unknown) {
    this.snapshot = snapshot;
    this.server = net.createServer(socket => this.handle(socket));
  }

  static async start(snapshot: unknown): Promise<FakeHerdr> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-herdr-'));
    const fake = new FakeHerdr(path.join(dir, 'herdr.sock'), snapshot);
    await new Promise<void>((resolve, reject) => {
      fake.server.once('error', reject);
      fake.server.listen(fake.socketPath, () => resolve());
    });
    return fake;
  }

  emit(event: string, data: object = {}): void {
    const line = JSON.stringify({ event, data }) + '\n';
    for (const socket of this.eventSockets) socket.write(line);
  }

  dropAllConnections(): void {
    for (const socket of this.sockets) socket.destroy();
  }

  async close(): Promise<void> {
    this.dropAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
    fs.rmSync(path.dirname(this.socketPath), { recursive: true, force: true });
  }

  private handle(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => {
      this.sockets.delete(socket);
      this.eventSockets.delete(socket);
    });
    let buffer = '';
    let subscribed = false;
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (line.trim().length === 0) continue;
        const request = JSON.parse(line);
        const override = this.rawResponses.get(request.method);
        switch (request.method) {
          case 'session.snapshot':
            this.snapshotRequests += 1;
            socket.end(
              (override ??
                JSON.stringify({ id: request.id, result: { type: 'session_snapshot', snapshot: this.snapshot } })) + '\n',
            );
            break;
          case 'agent.focus':
            this.focusRequests.push(request);
            socket.end((override ?? JSON.stringify({ id: request.id, result: { type: 'agent_focused' } })) + '\n');
            break;
          case 'events.subscribe':
            if (subscribed) {
              socket.destroy(); // herdr allows one subscribe per connection
              break;
            }
            subscribed = true;
            this.subscribeRequests.push(request);
            socket.write(
              (override ?? JSON.stringify({ id: request.id, result: { type: 'subscription_started' } })) + '\n',
            );
            this.eventSockets.add(socket);
            break;
          default:
            socket.end(
              JSON.stringify({ id: '', error: { code: 'invalid_request', message: `unknown method ${request.method}` } }) + '\n',
            );
        }
      }
    });
  }
}
