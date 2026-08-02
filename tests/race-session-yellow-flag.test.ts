import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { RaceRules } from '../src/server/rules.js';
import { agent, entryById, goLive, snap, team, tickTo } from './helpers/session.js';

/** One working car, already live, at pace 1.0 so distances are exact. */
function oneCar() {
  const session = createRaceSession(() => 1);
  goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working')])));
  return session;
}

/** Two cars on one team: t1 races, t2 is the one that gets into trouble. */
function twoCars() {
  const session = createRaceSession(() => 1);
  goLive(
    session,
    snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working')])),
  );
  return session;
}

describe('yellow flag condition', () => {
  it('is green with nobody blocked', () => {
    expect(oneCar().presentation().flag).toEqual({ kind: 'green' });
  });

  it('goes yellow when a car stops out on the circuit', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'blocked')])), 1);
    expect(session.presentation().flag).toEqual({ kind: 'yellow', terminalIDs: ['t1'] });
  });

  it('clears back to green once the car recovers', () => {
    const session = oneCar();
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'blocked')])), 1);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 2);
    expect(session.presentation().flag).toEqual({ kind: 'green' });
  });

  it('stays yellow while any one of several cars is still stopped', () => {
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'blocked'), agent('t2', 'blocked')])),
      1,
    );
    expect(session.presentation().flag).toEqual({
      kind: 'yellow',
      terminalIDs: expect.arrayContaining(['t1', 't2']),
    });

    // One recovers; the other is still stopped, so the flag stays out for it.
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      2,
    );
    expect(session.presentation().flag).toEqual({ kind: 'yellow', terminalIDs: ['t2'] });

    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working')])),
      3,
    );
    expect(session.presentation().flag).toEqual({ kind: 'green' });
  });

  it('stays green for a car that blocked while parked in the pit', () => {
    // An agent that blocks from idle never left its box, so there is nothing on
    // the circuit for marshals to wave at.
    const session = createRaceSession(() => 1);
    goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'idle')])));
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'blocked')])), 1);
    const presentation = session.presentation();
    expect(presentation.flag).toEqual({ kind: 'green' });
    expect(entryById(presentation, 't1').placement.kind).toBe('incidentPit');
    expect(entryById(presentation, 't1').causesYellowFlag).toBe(false);
  });

  it('clears when the blocked car disappears from the snapshot entirely', () => {
    // A retired car is off the circuit; leaving the flag out would strand the
    // race in a permanent yellow for a terminal that is gone.
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      1,
    );
    expect(session.presentation().flag.kind).toBe('yellow');
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'working')])), 2);
    expect(session.presentation().flag).toEqual({ kind: 'green' });
  });

  it('marks exactly the cars that caused it', () => {
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      1,
    );
    const presentation = session.presentation();
    expect(entryById(presentation, 't1').causesYellowFlag).toBe(false);
    expect(entryById(presentation, 't2').causesYellowFlag).toBe(true);
  });

  it('lists the flagged cars in standings order', () => {
    // Both cars are blocked with different distances covered, so the flag list
    // has to agree with the order the standings put them in.
    const session = twoCars();
    tickTo(session, 0, 20);
    session.applySnapshot(snap(team('ws-1', 'alpha', [agent('t1', 'blocked')])), 21);
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'blocked'), agent('t2', 'blocked')])),
      22,
    );
    const presentation = session.presentation();
    const flagged = presentation.teams
      .flatMap(t => t.entries)
      .filter(entry => entry.causesYellowFlag)
      .map(entry => entry.id);
    expect(presentation.flag).toEqual({ kind: 'yellow', terminalIDs: flagged });
  });
});

describe('safety car', () => {
  it('slows the rest of the field while the flag is out', () => {
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      0,
    );
    tickTo(session, 0, 18);
    // 18 s at pace 1.0 would be a full lap; behind the safety car it is only
    // safetyCarFactor of one.
    expect(entryById(session.presentation(), 't1').officialDistance)
      .toBeCloseTo(RaceRules.safetyCarFactor, 6);
  });

  it('runs at full pace again once the flag is cleared', () => {
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      0,
    );
    tickTo(session, 0, 18);
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'working')])),
      18,
    );
    tickTo(session, 18, 36);
    // Neutralized lap + a full one: the second 18 s stretch is scored at 1.0.
    expect(entryById(session.presentation(), 't1').officialDistance)
      .toBeCloseTo(RaceRules.safetyCarFactor + 1, 6);
  });

  it('reports the neutralized speed as the display speed', () => {
    // The browser extrapolates marker motion from displaySpeed between syncs,
    // so it has to be the speed the server is actually scoring at.
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      1,
    );
    expect(entryById(session.presentation(), 't1').displaySpeed)
      .toBeCloseTo(RaceRules.baseSpeed * RaceRules.safetyCarFactor, 9);
  });

  it('preserves the gap between two running cars', () => {
    // One factor applied to everyone neutralizes the race without reordering it.
    const session = twoCars();
    tickTo(session, 0, 30);
    const before = session.presentation().teams[0].entries;
    const gapBefore = before[0].officialDistance - before[1].officialDistance;

    session.applySnapshot(
      snap(team('ws-1', 'alpha', [
        agent('t1', 'working'), agent('t2', 'working'), agent('t3', 'blocked'),
      ])),
      30,
    );
    tickTo(session, 30, 60);
    const after = session.presentation().teams[0].entries;
    const gapAfter =
      (after.find(e => e.id === before[0].id)?.officialDistance ?? 0)
      - (after.find(e => e.id === before[1].id)?.officialDistance ?? 0);
    expect(gapAfter).toBeCloseTo(gapBefore, 6);
  });

  it('slows the done-cooldown display motion too', () => {
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'done'), agent('t2', 'blocked')])),
      0,
    );
    expect(entryById(session.presentation(), 't1').displaySpeed).toBeCloseTo(
      RaceRules.baseSpeed * RaceRules.doneCooldownFactor * RaceRules.safetyCarFactor,
      9,
    );
  });

  it('still lets a neutralized race finish', () => {
    // Scoring is slowed, not stopped: the finish must still be reachable, or a
    // blocked agent would freeze the Grand Prix indefinitely.
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])),
      0,
    );
    const neutralizedRace =
      (RaceRules.totalLaps * RaceRules.baseLapDuration) / RaceRules.safetyCarFactor;
    tickTo(session, 0, neutralizedRace + 5);
    expect(session.presentation().phase).toBe('podium');
  });

  it('leaves scoring step-size independent under the flag', () => {
    const coarse = createRaceSession(() => 1);
    const fine = createRaceSession(() => 1);
    for (const session of [coarse, fine]) {
      goLive(session, snap(team('ws-1', 'alpha', [agent('t1', 'working'), agent('t2', 'blocked')])));
    }
    tickTo(coarse, 0, 60, 1);
    tickTo(fine, 0, 60, 0.25);
    expect(entryById(coarse.presentation(), 't1').officialDistance)
      .toBeCloseTo(entryById(fine.presentation(), 't1').officialDistance, 9);
  });

  it('does not slow the podium victory lap', () => {
    // The result is already frozen by then, so a car stopped on track is no
    // longer neutralizing anything.
    // t1 races to the finish; t3 stays stopped on track the whole way, so the
    // podium is reached with the yellow flag still out.
    const session = twoCars();
    session.applySnapshot(
      snap(team('ws-1', 'alpha', [
        agent('t1', 'working'), agent('t2', 'done'), agent('t3', 'blocked'),
      ])),
      0,
    );
    const race = RaceRules.totalLaps * RaceRules.baseLapDuration;
    tickTo(session, 0, race / RaceRules.safetyCarFactor + 5);
    const presentation = session.presentation();
    expect(presentation.phase).toBe('podium');
    expect(presentation.flag.kind).toBe('yellow');
    // Podium cooldown motion is unscaled even though the flag is still out.
    expect(entryById(presentation, 't2').displaySpeed)
      .toBeCloseTo(RaceRules.baseSpeed * RaceRules.doneCooldownFactor, 9);
  });
});
