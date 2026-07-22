import { describe, expect, it } from 'vitest';
import { createRaceBroadcaster } from '../src/server/broadcaster.js';
import { createRaceSession } from '../src/server/race-session.js';
import type { SyncMessage } from '../src/shared/protocol.js';
import { agent, goLive, snap, team } from './helpers/session.js';

function makeRig(status: 'working' | 'idle' = 'working') {
  const session = createRaceSession(() => 1);
  goLive(session, snap(team('ws-1', 'alpha', [agent('t1', status)])));
  let now = 0;
  const clock = () => now;
  const setNow = (value: number) => { now = value; };
  const broadcaster = createRaceBroadcaster(session, clock);
  const sent: SyncMessage[] = [];
  broadcaster.addClient(json => sent.push(JSON.parse(json)));
  return { broadcaster, sent, setNow };
}

describe('RaceBroadcaster', () => {
  it('sends a full sync immediately when a client connects', () => {
    const { sent } = makeRig();
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('sync');
    expect(sent[0].teams[0].entries[0].id).toBe('t1');
    expect(sent[0].teams[0].entries[0].displaySpeed).toBeGreaterThan(0);
  });

  it('broadcasts the latest full sync on every tick', () => {
    const rig = makeRig();
    rig.setNow(0.25);
    rig.broadcaster.tick();
    expect(rig.sent.length).toBe(2);
  });

  it('keeps serving remaining clients after one is removed', () => {
    const rig = makeRig('idle');
    const extra: SyncMessage[] = [];
    const send = (json: string) => extra.push(JSON.parse(json));
    rig.broadcaster.addClient(send);
    expect(extra).toHaveLength(1);
    rig.broadcaster.removeClient(send);
    rig.setNow(0.25);
    rig.broadcaster.tick();
    expect(extra).toHaveLength(1);
    expect(rig.sent.length).toBe(2);
  });
});
