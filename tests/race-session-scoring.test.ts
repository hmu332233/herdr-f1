import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules, type RacePaceSource } from '../src/server/rules.js';
import { agent, entryById, goLive, snap, team, tickTo } from './helpers/session.js';

const one = (status: 'idle' | 'working' | 'done' | 'blocked' = 'working') =>
  snap(team('ws-1', 'alpha', [agent('t1', status)]));

describe('RaceSession scoring', () => {
  it('a working agent completes one lap per 18 seconds at pace 1.0', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    tickTo(session, 0, 18);
    const entry = entryById(session.presentation(), 't1');
    expect(entry.officialDistance).toBeCloseTo(1, 6);
    expect(entry.lap).toBe(2);
    expect(entry.statusText).toBe('LAP 2');
    expect(entry.placement.kind).toBe('track');
    expect(session.presentation().headerLap).toBe(2);
  });

  it('scoring is step-size independent', () => {
    const coarse = createRaceSession(() => 1.1);
    const fine = createRaceSession(() => 1.1);
    goLive(coarse, one());
    goLive(fine, one());
    tickTo(coarse, 0, 60, 1);
    tickTo(fine, 0, 60, 0.25);
    expect(entryById(coarse.presentation(), 't1').officialDistance)
      .toBeCloseTo(entryById(fine.presentation(), 't1').officialDistance, 9);
  });

  it('caps a single step at one second (no phantom laps after sleep)', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    session.advance(100); // one giant step
    expect(entryById(session.presentation(), 't1').officialDistance)
      .toBeCloseTo(RaceRules.baseSpeed * RaceRules.maximumAcceptedStep, 9);
  });

  it('resamples pace at each official lap boundary', () => {
    const paceByLap: RacePaceSource = (_gp, _id, lap) => (lap === 0 ? 1.0 : 0.75);
    const session = createRaceSession(paceByLap);
    goLive(session, one());
    // Lap 1 takes 18 s at pace 1.0; lap 2 runs at 0.75 → 24 s. 18+24 = 42.
    tickTo(session, 0, 42);
    expect(entryById(session.presentation(), 't1').officialDistance).toBeCloseTo(2, 6);
  });

  it('idle freezes official distance and resumes from it', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    let now = tickTo(session, 0, 9); // 0.5 laps
    session.applySnapshot(one('idle'), now);
    now = tickTo(session, now, now + 30);
    let entry = entryById(session.presentation(), 't1');
    expect(entry.officialDistance).toBeCloseTo(0.5, 6);
    expect(entry.placement.kind).toBe('pit');
    expect(entry.statusText).toBe('PIT');
    session.applySnapshot(one('working'), now);
    tickTo(session, now, now + 9);
    entry = entryById(session.presentation(), 't1');
    expect(entry.officialDistance).toBeCloseTo(1, 6);
  });

  it('done freezes official distance but keeps display cooling down at quarter speed', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    let now = tickTo(session, 0, 9); // display = official = 0.5
    session.applySnapshot(one('done'), now);
    now = tickTo(session, now, now + 18);
    const entry = entryById(session.presentation(), 't1');
    expect(entry.officialDistance).toBeCloseTo(0.5, 6);
    expect(entry.statusText).toBe('DONE · LAP 1');
    expect(entry.placement.kind).toBe('cooldown');
    if (entry.placement.kind === 'cooldown') {
      // 18 s * (1/18) * 0.25 = 0.25 laps of display-only motion.
      expect(entry.placement.progress).toBeCloseTo(0.75, 6);
    }
    expect(entry.displaySpeed).toBeCloseTo(RaceRules.baseSpeed * 0.25, 9);
  });

  it('blocked stops in place as an incident', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    let now = tickTo(session, 0, 9);
    session.applySnapshot(one('blocked'), now);
    tickTo(session, now, now + 30);
    const entry = entryById(session.presentation(), 't1');
    expect(entry.statusText).toBe('INCIDENT · LAP 1');
    expect(entry.placement.kind).toBe('incidentTrack');
    if (entry.placement.kind === 'incidentTrack') expect(entry.placement.progress).toBeCloseTo(0.5, 6);
    expect(entry.displaySpeed).toBe(0);
  });

  it('a block that occurs while parked stays a pit-lane incident', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one('idle'));
    session.applySnapshot(one('blocked'), 1);
    expect(entryById(session.presentation(), 't1').placement.kind).toBe('incidentPit');
  });

  it('time does not accrue while the connection is not live', () => {
    const session = createRaceSession(() => 1);
    goLive(session, one());
    let now = tickTo(session, 0, 9);
    session.applyConnection({ kind: 'offline' }, now);
    now = tickTo(session, now, now + 300);
    expect(entryById(session.presentation(), 't1').officialDistance).toBeCloseTo(0.5, 6);
    expect(session.presentation().overlay.kind).toBe('redFlag');
    expect(entryById(session.presentation(), 't1').displaySpeed).toBe(0);
    session.applyConnection({ kind: 'live' }, now);
    // Re-anchor the tick chain the way the live broadcaster does on every
    // tick; applyConnection deliberately breaks it (frozen span excluded), so
    // without this the first post-reconnect step would be discarded.
    session.advance(now);
    tickTo(session, now, now + 9);
    expect(entryById(session.presentation(), 't1').officialDistance).toBeCloseTo(1, 6);
  });

  it('before any snapshot the session awaits the grid', () => {
    const session = createRaceSession(() => 1);
    const presentation = session.presentation();
    expect(presentation.phase).toBe('awaitingGrid');
    expect(presentation.overlay.kind).toBe('formationLap');
    expect(presentation.headerLap).toBe(1);
    expect(presentation.teams).toEqual([]);
  });
});
