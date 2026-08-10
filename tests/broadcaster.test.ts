import { describe, expect, it } from 'vitest';
import { createRaceBroadcaster } from '../src/server/broadcaster.js';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules } from '../src/server/rules.js';
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

  it('updates host-owned circuit metadata at the next Grand Prix boundary', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    session.setTotalLaps(1, 0);
    let now = 0;
    let circuit = 'herdr';
    const starts: number[] = [];
    const broadcaster = createRaceBroadcaster(
      session,
      () => now,
      250,
      () => circuit,
      (grandPrix, at) => {
        starts.push(grandPrix);
        circuit = 'suzuka';
        session.setTotalLaps(53, at);
      },
    );

    // One lap finishes at 18s; the next Grand Prix begins after the 8s podium.
    for (now = 1; now <= RaceRules.baseLapDuration + RaceRules.podiumDuration; now += 1) {
      broadcaster.tick();
    }

    expect(starts).toEqual([2]);
    expect(broadcaster.buildSync()).toMatchObject({
      grandPrix: 2,
      phase: 'live',
      circuitID: 'suzuka',
      totalLaps: 53,
    });
  });
});
