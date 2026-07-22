import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules, stableHash } from '../src/server/rules.js';
import { agent, entryById, goLive, snap, team, tickTo } from './helpers/session.js';

describe('identity', () => {
  it('derives the car number from the terminal-ID hash (1–99)', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    const expected = Number(stableHash('t1') % BigInt(RaceRules.maximumGridNumber)) + 1;
    expect(entryById(session.presentation(), 't1').carNumber).toBe(expected);
  });

  it('assigns 12 unique palette slots, then pattern tokens', () => {
    const session = createRaceSession(() => 1);
    const teams = Array.from({ length: 14 }, (_, i) =>
      team(`ws-${i}`, `project-${i}`, [agent(`t-${i}`, 'working')]));
    goLive(session, snap(...teams));
    const tokens = session.presentation().teams.map(t => t.colorToken);
    const palette = tokens.filter(t => t.kind === 'palette');
    const pattern = tokens.filter(t => t.kind === 'pattern');
    expect(palette).toHaveLength(12);
    expect(new Set(palette.map(t => t.slot)).size).toBe(12);
    expect(pattern).toHaveLength(2);
  });

  it('keeps identity stable across snapshots', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    const before = entryById(session.presentation(), 't1');
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'idle')])), 1);
    const after = entryById(session.presentation(), 't1');
    expect(after.carNumber).toBe(before.carNumber);
    expect(after.colorToken).toEqual(before.colorToken);
  });
});

describe('grid lifecycle', () => {
  const twoCars = () => snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working')]));

  it('a new entrant joins just behind the current last car', () => {
    const session = createRaceSession(() => 1);
    goLive(session, twoCars());
    const now = tickTo(session, 0, 36); // both at 2.0 laps
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working'), agent('t3', 'working')])),
      now,
    );
    expect(entryById(session.presentation(), 't3').officialDistance)
      .toBeCloseTo(2 - RaceRules.newEntrantDeficit, 6);
  });

  it('the very first entrants start at zero, not negative', () => {
    const session = createRaceSession(() => 1);
    goLive(session, twoCars());
    expect(entryById(session.presentation(), 't1').officialDistance).toBe(0);
  });

  it('a terminal missing from a snapshot is RETIRED but stays in the standings', () => {
    const session = createRaceSession(() => 1);
    goLive(session, twoCars());
    const now = tickTo(session, 0, 9);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), now);
    const retired = entryById(session.presentation(), 't2');
    expect(retired.statusText).toBe('RETIRED · LAP 1');
    expect(retired.placement.kind).toBe('retired');
    expect(retired.displaySpeed).toBe(0);
  });

  it('a retired terminal reappearing before race end restores its entry', () => {
    const session = createRaceSession(() => 1);
    goLive(session, twoCars());
    let now = tickTo(session, 0, 18); // both at 1.0
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), now);
    const numberBefore = entryById(session.presentation(), 't2').carNumber;
    now = tickTo(session, now, now + 9);
    session.applySnapshot(twoCars(), now);
    const restored = entryById(session.presentation(), 't2');
    expect(restored.placement.kind).toBe('track');
    expect(restored.carNumber).toBe(numberBefore);
    expect(restored.officialDistance).toBeCloseTo(1.0, 6); // frozen while retired
  });

  it('a live workspace move transfers the entry with its distance and number', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(
      team('ws-1', 'alpha', [agent('t1', 'working')]),
      team('ws-2', 'beta', [agent('t2', 'working')]),
    ));
    const now = tickTo(session, 0, 18);
    const numberBefore = entryById(session.presentation(), 't1').carNumber;
    session.applySnapshot(snap(
      team('ws-2', 'beta', [agent('t2', 'working'), agent('t1', 'working')]),
    ), now);
    const moved = entryById(session.presentation(), 't1');
    expect(moved.teamID).toBe('ws-2');
    expect(moved.carNumber).toBe(numberBefore);
    expect(moved.officialDistance).toBeCloseTo(1.0, 6);
    // ws-1 has no unretired entries left → hidden from standings.
    expect(session.presentation().teams.map(t => t.id)).toEqual(['ws-2']);
  });

  it('a new agent session in the same terminal is NEW STINT, not a new car', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [
      agent('t1', 'working', { agentSessionReference: 'session-a' }),
    ])));
    let now = tickTo(session, 0, 18);
    session.applySnapshot(snap(team('ws-1', 'alpha', [
      agent('t1', 'working', { agentSessionReference: 'session-b' }),
    ])), now);
    let entry = entryById(session.presentation(), 't1');
    expect(entry.showsNewStint).toBe(true);
    expect(entry.officialDistance).toBeCloseTo(1.0, 6);
    // The treatment expires after 4 race seconds.
    now = tickTo(session, now, now + RaceRules.newStintDuration + 0.5);
    entry = entryById(session.presentation(), 't1');
    expect(entry.showsNewStint).toBe(false);
  });

  it('a session reference appearing for the first time is not a new stint', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
    session.applySnapshot(snap(team('ws-1', 'alpha', [
      agent('t1', 'working', { agentSessionReference: 'session-a' }),
    ])), 1);
    expect(entryById(session.presentation(), 't1').showsNewStint).toBe(false);
  });

  it('focus flows through from the snapshot', () => {
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [
      agent('t1', 'working', { isFocused: true }), agent('t2', 'working'),
    ])));
    expect(entryById(session.presentation(), 't1').isFocused).toBe(true);
    expect(entryById(session.presentation(), 't2').isFocused).toBe(false);
  });
});
