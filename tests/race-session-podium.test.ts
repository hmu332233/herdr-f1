import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules, type RacePaceSource } from '../src/server/rules.js';
import { agent, entryById, goLive, snap, team, tickTo } from './helpers/session.js';

const RACE_SECONDS = RaceRules.totalLaps * RaceRules.baseLapDuration; // 1044

describe('finish and podium', () => {
  it('freezes results and shows the team podium when the leader reaches 58 laps', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    const now = tickTo(session, 0, RACE_SECONDS);
    const presentation = session.presentation();
    expect(presentation.phase).toBe('podium');
    expect(presentation.headerLap).toBe(58);
    expect(presentation.podium).not.toBeNull();
    expect(presentation.podium!.grandPrix).toBe(1);
    expect(presentation.podium!.top[0]).toMatchObject({ rank: 1, teamID: 'ws-1', label: 'alpha' });
    expect(presentation.podium!.top[0].distance).toBeCloseTo(58, 6);
    // Official distance is frozen during the podium.
    tickTo(session, now, now + 4);
    expect(entryById(session.presentation(), 't1').officialDistance).toBeCloseTo(58, 6);
  });

  it('other cars only advance up to the earliest finish instant', () => {
    const paces = new Map([['fast', 1.25], ['slow', 1.0]]);
    const source: RacePaceSource = (_gp, id) => paces.get(id)!;
    const session = createRaceSession(source);
    goLive(session, snap(team('ws-1', 'alpha', [agent('fast', 'working'), agent('slow', 'working')])));
    // Stop just after fast finishes (835.2 s) but well inside the 8 s podium,
    // before the automatic next Grand Prix resets the grid.
    tickTo(session, 0, 838); // fast finishes at 58*18/1.25 = 835.2 s
    const slow = entryById(session.presentation(), 'slow');
    expect(entryById(session.presentation(), 'fast').officialDistance).toBeCloseTo(58, 6);
    expect(slow.officialDistance).toBeCloseTo((RACE_SECONDS / 1.25) * RaceRules.baseSpeed, 3); // 46.4
  });

  it('starts the next Grand Prix after 8 podium seconds with a fresh grid', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    let now = tickTo(session, 0, RACE_SECONDS);
    now = tickTo(session, now, now + RaceRules.podiumDuration + 1);
    const presentation = session.presentation();
    expect(presentation.phase).toBe('live');
    expect(presentation.grandPrix).toBe(2);
    expect(presentation.podium).toBeNull();
    expect(presentation.headerLap).toBe(1);
    expect(entryById(presentation, 't1').officialDistance).toBeLessThan(1);
  });

  it('drops still-absent retired entries at the next grid, keeps present ones', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working')])));
    let now = tickTo(session, 0, 9);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), now); // t2 retired
    now = tickTo(session, now, RACE_SECONDS + 1);
    now = tickTo(session, now, now + RaceRules.podiumDuration + 1);
    const ids = session.presentation().teams.flatMap(t => t.entries.map(e => e.id));
    expect(ids).toContain('t1');
    expect(ids).not.toContain('t2');
  });

  it('an agent detected during the podium queues for the next grid', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    let now = tickTo(session, 0, RACE_SECONDS);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t9', 'working')])), now);
    let queued = entryById(session.presentation(), 't9');
    expect(queued.isQueuedNextGrid).toBe(true);
    expect(queued.statusText).toBe('NEXT GRID');
    expect(queued.placement.kind).toBe('nextGrid');
    now = tickTo(session, now, now + RaceRules.podiumDuration + 1);
    queued = entryById(session.presentation(), 't9');
    expect(queued.isQueuedNextGrid).toBe(false);
    // Reset onto the fresh grid at zero; the extra tick past the 8 s podium
    // boundary lets it score a fraction of a lap — the point is it did not
    // carry the finished race's distance.
    expect(queued.officialDistance).toBeLessThan(1);
  });
});

describe('standings', () => {
  it('ranks teams by exact distance sum with no size normalization', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(
      team('ws-solo', 'solo', [agent('s1', 'working')]),
      team('ws-duo', 'duo', [agent('d1', 'working'), agent('d2', 'working')]),
    ));
    tickTo(session, 0, 18);
    const presentation = session.presentation();
    expect(presentation.teams.map(t => t.id)).toEqual(['ws-duo', 'ws-solo']);
    expect(presentation.teams[0].rank).toBe(1);
    expect(presentation.teams[0].distance).toBeCloseTo(2, 6);
    expect(presentation.teams[0].distanceText).toBe('2.0 LAPS');
    expect(presentation.teams[0].gapText).toBe('—');
    // Gap of 1.0 lap → shown in laps.
    expect(presentation.teams[1].gapText).toBe('+1.0 LAPS');
  });

  it('shows sub-lap gaps in nominal seconds', () => {
    const paces = new Map([['a', 1.0], ['b', 0.75]]);
    const source: RacePaceSource = (_gp, id) => paces.get(id)!;
    const session = createRaceSession(source);
    goLive(session, snap(
      team('ws-a', 'alpha', [agent('a', 'working')]),
      team('ws-b', 'beta', [agent('b', 'working')]),
    ));
    tickTo(session, 0, 6); // a=1/3, b=1/4 → gap 1/12 lap = 1.5 nominal s
    expect(session.presentation().teams[1].gapText).toBe('+1.5s');
  });

  it('sorts agents inside a team by personal distance', () => {
    const paces = new Map([['a', 1.25], ['b', 0.75]]);
    const source: RacePaceSource = (_gp, id) => paces.get(id)!;
    const session = createRaceSession(source);
    goLive(session, snap(team('ws-1', 'alpha', [agent('b', 'working'), agent('a', 'working')])));
    tickTo(session, 0, 18);
    expect(session.presentation().teams[0].entries.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('overlays and display motion', () => {
  it('protocol errors suspend the session', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    session.applyConnection({ kind: 'protocolError', detail: 'Unsupported Herdr protocol 999' }, 1);
    const presentation = session.presentation();
    expect(presentation.overlay).toEqual({ kind: 'suspended', detail: 'Unsupported Herdr protocol 999' });
  });

  it('an all-retired grid shows NO CARS ON GRID', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    session.applySnapshot(snap(), 1);
    const presentation = session.presentation();
    expect(presentation.overlay.kind).toBe('noCarsOnGrid');
    expect(presentation.teams).toEqual([]);
  });

  it('working entries expose their pace as displaySpeed', () => {
    const session = createRaceSession(() => 1.2);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    tickTo(session, 0, 2); // walk() has sampled lap 0 pace by now
    expect(entryById(session.presentation(), 't1').displaySpeed)
      .toBeCloseTo(RaceRules.baseSpeed * 1.2, 9);
  });
});
