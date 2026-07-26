import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules } from '../src/server/rules.js';
import { agent, goLive, snap, team, tickTo } from './helpers/session.js';
import type { RacePresentation, RadioKind } from '../src/shared/presentation.js';

const RACE_SECONDS = RaceRules.totalLaps * RaceRules.baseLapDuration; // 1044

function kinds(presentation: RacePresentation): RadioKind[] {
  return presentation.radio.map(message => message.kind);
}

/** One working car on one team, already live. */
function oneCar() {
  const session = createRaceSession(() => 1);
  goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
  return session;
}

describe('radio emission', () => {
  it('stays silent on the bootstrap snapshot', () => {
    const session = createRaceSession(() => 1);
    goLive(
      session,
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
    );
    expect(session.presentation().radio).toEqual([]);
  });

  it('announces a pit stop when working turns idle', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    expect(kinds(session.presentation())).toEqual(['boxBox']);
  });

  it('announces the return to green when idle turns working', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 2);
    expect(kinds(session.presentation())).toEqual(['boxBox', 'greenAgain']);
  });

  it('announces an incident and the recovery that follows', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'blocked')])), 1);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 2);
    expect(kinds(session.presentation())).toEqual(['incident', 'recovered']);
  });

  it('announces the chequered flag when an agent finishes', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'done')])), 1);
    expect(kinds(session.presentation())).toEqual(['chequered']);
  });

  it('announces a new stint when the agent session is replaced', () => {
    const session = createRaceSession(() => 1);
    goLive(
      session,
      snap(team('ws-1', 'alpha', [agent('t1', 'working', { agentSessionReference: 'a' })])),
    );
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working', { agentSessionReference: 'b' })])),
      1,
    );
    expect(kinds(session.presentation())).toEqual(['newStint']);
  });

  it('announces a retirement when a terminal leaves the snapshot', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 1);
    expect(kinds(session.presentation())).toEqual(['retired']);
  });

  it('repeats neither an unchanged status nor a standing retirement', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 2);
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 3);
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 4);
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 5);
    expect(kinds(session.presentation())).toEqual(['boxBox', 'retired']);
  });

  it('announces again when a retired terminal returns and leaves once more', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 1);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 2);
    session.applySnapshot(snap(team('ws-1', 'alpha', [])), 3);
    expect(kinds(session.presentation())).toEqual(['retired', 'retired']);
  });
});

describe('radio content', () => {
  it('carries the car identity and the lap the transition happened on', () => {
    const session = oneCar();
    const now = tickTo(session, 0, 3 * RaceRules.baseLapDuration);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), now);

    const [message] = session.presentation().radio;
    const entry = session.presentation().teams[0].entries[0];
    expect(message).toMatchObject({
      terminalID: 't1',
      teamLabel: 'alpha',
      tabLabel: entry.tabLabel,
      carNumber: entry.carNumber,
      lap: entry.lap,
    });
    expect(message.text.length).toBeGreaterThan(0);
    expect(message.colorToken).toEqual(entry.colorToken);
  });

  it('stamps the wall-clock time the line was emitted', () => {
    const session = createRaceSession(
      () => 1,
      () => new Date(2026, 6, 27, 9, 5, 3),
    );
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    expect(session.presentation().radio[0].timeText).toBe('09:05:03');
  });

  it('keeps the text and id of a line stable once emitted', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    const first = session.presentation().radio[0];
    const now = tickTo(session, 1, 30);
    session.advance(now);
    expect(session.presentation().radio[0]).toEqual(first);
  });

  it('issues strictly increasing ids', () => {
    const session = oneCar();
    let status: 'idle' | 'working' = 'idle';
    for (let step = 1; step <= 6; step += 1) {
      session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', status)])), step);
      status = status === 'idle' ? 'working' : 'idle';
    }
    const ids = session.presentation().radio.map(message => message.id);
    expect(ids).toHaveLength(6);
    for (let i = 1; i < ids.length; i += 1) expect(ids[i]).toBeGreaterThan(ids[i - 1]);
  });
});

describe('radio history window', () => {
  it('keeps only the most recent lines, oldest first', () => {
    const session = oneCar();
    const total = RaceRules.radioHistoryLimit + 10;
    let status: 'idle' | 'working' = 'idle';
    for (let step = 1; step <= total; step += 1) {
      session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', status)])), step);
      status = status === 'idle' ? 'working' : 'idle';
    }
    const radio = session.presentation().radio;
    expect(radio).toHaveLength(RaceRules.radioHistoryLimit);
    // The window ends on the newest line and dropped the first ten.
    expect(radio[radio.length - 1].id).toBe(total);
    expect(radio[0].id).toBe(total - RaceRules.radioHistoryLimit + 1);
  });

  it('clears the radio when the next Grand Prix starts', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 0);
    let now = tickTo(session, 0, 5);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), now);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), now);
    expect(session.presentation().radio.length).toBeGreaterThan(0);

    now = tickTo(session, now, RACE_SECONDS);
    now = tickTo(session, now, now + RaceRules.podiumDuration + 1);
    expect(session.presentation().grandPrix).toBe(2);
    expect(session.presentation().radio).toEqual([]);
  });
});
