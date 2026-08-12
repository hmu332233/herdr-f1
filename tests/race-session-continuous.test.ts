import { describe, expect, it } from 'vitest';
import { createRaceSession } from '../src/server/race-session.js';
import { MultiplayerRules, RaceRules } from '../src/server/rules.js';
import type { CrewCounts, CrewState } from '../src/shared/presentation.js';
import { agent, entryById, goLive, snap, team, tickTo } from './helpers/session.js';

function counts(
  working: number,
  idle: number,
  done: number,
  blocked: number,
): CrewCounts {
  return { working, idle, done, blocked };
}

function car(
  id: string,
  state: CrewState,
  crewCounts: CrewCounts,
  isLastKnown = false,
) {
  const status = state === 'cruising' ? 'idle' : state;
  return agent(id, isLastKnown ? 'idle' : status, {
    crewState: state,
    crewCounts,
    isLastKnown,
    agentKind: `crew ${crewCounts.working}/${Object.values(crewCounts).reduce((a, b) => a + b, 0)}`,
  });
}

function continuous(...cars: ReturnType<typeof car>[]) {
  const session = createRaceSession(() => 1, undefined, { raceMode: 'continuous' });
  goLive(session, snap(team('alpha', 'alpha', cars)));
  return session;
}

describe('continuous vehicle pace', () => {
  it('scores cruising cars while separating an initially overlapping grid', () => {
    const session = continuous(
      car('idle', 'idle', counts(0, 2, 0, 0)),
      car('done', 'done', counts(0, 0, 2, 0)),
      car('mixed', 'cruising', counts(0, 1, 1, 0)),
    );
    tickTo(session, 0, RaceRules.baseLapDuration);
    const entries = session.presentation().teams.flatMap(team => team.entries);
    expect(entries[0].officialDistance).toBeCloseTo(MultiplayerRules.cruisingFactor, 8);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      expect(entry.placement.kind).toBe('track');
      if (index > 0) {
        expect(entries[index - 1].officialDistance - entry.officialDistance)
          .toBeCloseTo(MultiplayerRules.continuousCatchupTargetGap, 8);
      }
    }
  });

  it('changes working immediately to 1.0x and caps its sustained uptime bonus at 1.02x', () => {
    const session = continuous(car('worker', 'working', counts(1, 0, 0, 0)));
    tickTo(session, 0, RaceRules.baseLapDuration);
    expect(entryById(session.presentation(), 'worker').officialDistance).toBeCloseTo(1, 8);

    session.setExternalPace('worker', 1.25, RaceRules.baseLapDuration);
    tickTo(session, RaceRules.baseLapDuration, RaceRules.baseLapDuration * 2);
    expect(entryById(session.presentation(), 'worker').officialDistance).toBeCloseTo(2.02, 8);
  });

  it('keeps an offline stale block cruising without deploying the Safety Car', () => {
    const session = continuous(car('offline', 'blocked', counts(0, 0, 0, 2), true));
    tickTo(session, 0, RaceRules.baseLapDuration);
    const presentation = session.presentation();
    expect(entryById(presentation, 'offline').officialDistance)
      .toBeCloseTo(MultiplayerRules.cruisingFactor, 8);
    expect(entryById(presentation, 'offline').isLastKnown).toBe(true);
    expect(presentation.teams[0].isOffline).toBe(true);
    expect(presentation.flag).toEqual({ kind: 'green' });
    expect(presentation.raceControl).toEqual({ kind: 'green' });
  });

  it('smoothly boosts a lower-ranked car according to the gap ahead', () => {
    const session = continuous(car('leader', 'working', counts(1, 0, 0, 0)));
    tickTo(session, 0, 9);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('follower', 'working', counts(1, 0, 0, 0)),
    ])), 9);

    const before = session.presentation();
    const initialGap = entryById(before, 'leader').officialDistance
      - entryById(before, 'follower').officialDistance;
    expect(initialGap).toBeCloseTo(RaceRules.newEntrantDeficit, 8);
    expect(entryById(before, 'follower').displaySpeed)
      .toBeGreaterThan(entryById(before, 'leader').displaySpeed);

    tickTo(session, 9, 27);
    const after = session.presentation();
    const finalGap = entryById(after, 'leader').officialDistance
      - entryById(after, 'follower').officialDistance;
    expect(finalGap).toBeLessThan(initialGap);
  });

  it('lets a cruising follower close on a working leader but not pass it', () => {
    const session = continuous(car('leader', 'working', counts(1, 0, 0, 0)));
    tickTo(session, 0, 9);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('follower', 'idle', counts(0, 1, 0, 0)),
    ])), 9);

    const initial = session.presentation();
    const initialGap = entryById(initial, 'leader').officialDistance
      - entryById(initial, 'follower').officialDistance;
    expect(entryById(initial, 'follower').displaySpeed)
      .toBeGreaterThan(entryById(initial, 'leader').displaySpeed);

    tickTo(session, 9, 300, 0.25);
    const after = session.presentation();
    const finalGap = entryById(after, 'leader').officialDistance
      - entryById(after, 'follower').officialDistance;
    expect(finalGap).toBeGreaterThanOrEqual(-1e-9);
    expect(finalGap).toBeLessThan(initialGap);
    expect(finalGap).toBeLessThanOrEqual(MultiplayerRules.continuousCatchupTargetGap + 1e-6);
  });

  it('gives a working car a short boost to pass a nearby cruising car', () => {
    const session = continuous(car('cruiser', 'idle', counts(0, 1, 0, 0)));
    tickTo(session, 0, 9);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('cruiser', 'idle', counts(0, 1, 0, 0)),
      car('worker', 'working', counts(1, 0, 0, 0)),
    ])), 9);

    let now = 9;
    while (now < 90) {
      const view = session.presentation();
      const gap = entryById(view, 'cruiser').officialDistance
        - entryById(view, 'worker').officialDistance;
      if (gap <= MultiplayerRules.continuousOvertakeRange) break;
      now = tickTo(session, now, now + 1);
    }

    const inRange = session.presentation();
    const cruiser = entryById(inRange, 'cruiser');
    const worker = entryById(inRange, 'worker');
    expect(cruiser.officialDistance - worker.officialDistance)
      .toBeLessThanOrEqual(MultiplayerRules.continuousOvertakeRange);
    expect(worker.displaySpeed - cruiser.displaySpeed)
      .toBeGreaterThan(RaceRules.baseSpeed * 0.05);

    tickTo(session, now, now + 25);
    const after = session.presentation();
    expect(entryById(after, 'worker').officialDistance)
      .toBeGreaterThan(entryById(after, 'cruiser').officialDistance);
  });

  it('wears tyres only while working and completes a mandatory pit stop', () => {
    const session = continuous(car('worker', 'working', counts(1, 0, 0, 0)));
    tickTo(session, 0, MultiplayerRules.tireWorkingSecondsToPit, 0.25);
    let entry = entryById(session.presentation(), 'worker');
    expect(entry.tireLife).toBeCloseTo(MultiplayerRules.tireLifePitThreshold, 6);
    expect(entry.pitState).toBe('pitIn');
    expect(entry.placement.kind).toBe('pit');
    expect(entry.displaySpeed).toBe(0);

    let now = MultiplayerRules.tireWorkingSecondsToPit;
    now = tickTo(session, now, now + MultiplayerRules.pitEntrySeconds, 0.1);
    expect(entryById(session.presentation(), 'worker').pitState).toBe('pitting');
    now = tickTo(session, now, now + MultiplayerRules.pitServiceSeconds, 0.1);
    entry = entryById(session.presentation(), 'worker');
    expect(entry.pitState).toBe('pitOut');
    expect(entry.tireLife).toBeCloseTo(MultiplayerRules.tireLifeFresh, 6);
    now = tickTo(session, now, now + MultiplayerRules.pitExitSeconds, 0.1);
    entry = entryById(session.presentation(), 'worker');
    expect(entry.pitState).toBe('racing');
    expect(entry.tireLife).toBeGreaterThan(99);
  });

  it('does not consume tyre life while cruising', () => {
    const session = continuous(car('cruiser', 'idle', counts(0, 1, 0, 0)));
    tickTo(session, 0, 180);
    const entry = entryById(session.presentation(), 'cruiser');
    expect(entry.tireLife).toBe(MultiplayerRules.tireLifeFresh);
    expect(entry.pitState).toBe('racing');
  });

  it('preserves existing tyre wear when a working car starts cruising', () => {
    const session = continuous(car('car', 'working', counts(1, 0, 0, 0)));
    let now = tickTo(session, 0, 90);
    const worn = entryById(session.presentation(), 'car').tireLife!;
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('car', 'idle', counts(0, 1, 0, 0)),
    ])), now);
    now = tickTo(session, now, now + 90);
    expect(entryById(session.presentation(), 'car').tireLife).toBeCloseTo(worn, 8);
  });

  it('loses track position during the mandatory stop', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('follower', 'idle', counts(0, 1, 0, 0)),
    );
    tickTo(session, 0, MultiplayerRules.tireWorkingSecondsToPit, 0.25);
    expect(entryById(session.presentation(), 'leader').pitState).toBe('pitIn');
    tickTo(session, MultiplayerRules.tireWorkingSecondsToPit,
      MultiplayerRules.tireWorkingSecondsToPit + 2, 0.25);
    const after = session.presentation();
    expect(entryById(after, 'follower').officialDistance)
      .toBeGreaterThan(entryById(after, 'leader').officialDistance);
  });
});

describe('continuous Safety Car', () => {
  it('stops the blocked car while the leader and followers form a no-overtaking queue', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('follower', 'working', counts(1, 0, 0, 0)),
    );
    session.setExternalPace('leader', 1.25, 0);
    tickTo(session, 0, 36);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('follower', 'working', counts(1, 0, 0, 0)),
      car('blocked', 'blocked', counts(0, 0, 0, 1)),
    ])), 36);

    const before = session.presentation();
    tickTo(session, 36, 54);
    const after = session.presentation();
    const finalGap = entryById(after, 'leader').officialDistance
      - entryById(after, 'follower').officialDistance;
    expect(entryById(after, 'blocked').officialDistance).toBeCloseTo(
      entryById(before, 'blocked').officialDistance,
      8,
    );
    expect(finalGap).toBeGreaterThanOrEqual(MultiplayerRules.safetyCarQueueGap - 1e-9);
    expect(finalGap).toBeCloseTo(MultiplayerRules.safetyCarQueueGap, 8);
    expect(after.raceControl).toMatchObject({ kind: 'safetyCar', phase: 'deployed' });
  });

  it('puts a recovered car and a new arrival immediately behind the queue tail', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('blocked', 'blocked', counts(0, 0, 0, 1)),
    );
    tickTo(session, 0, 5);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('blocked', 'working', counts(1, 0, 0, 0)),
      car('new', 'idle', counts(0, 1, 0, 0)),
    ])), 5);
    const presentation = session.presentation();
    const leader = entryById(presentation, 'leader').officialDistance;
    const recovered = entryById(presentation, 'blocked').officialDistance;
    const newcomer = entryById(presentation, 'new').officialDistance;
    expect(leader - recovered).toBeCloseTo(MultiplayerRules.safetyCarQueueGap, 8);
    expect(recovered - newcomer).toBeCloseTo(MultiplayerRules.safetyCarQueueGap, 8);
    expect(presentation.raceControl).toMatchObject({ kind: 'safetyCar', phase: 'inThisLap' });
  });

  it('preserves absolute order across lap wrap-around and lapped-car catch-up', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('lapped', 'idle', counts(0, 1, 0, 0)),
    );
    session.setExternalPace('leader', 1.25, 0);
    tickTo(session, 0, 36);
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('lapped', 'idle', counts(0, 1, 0, 0)),
      car('incident', 'blocked', counts(0, 0, 0, 1)),
    ])), 36);

    tickTo(session, 36, 216);
    const leader = entryById(session.presentation(), 'leader').officialDistance;
    const lapped = entryById(session.presentation(), 'lapped').officialDistance;
    expect(leader).toBeGreaterThan(lapped);
    expect(leader - lapped).toBeCloseTo(MultiplayerRules.safetyCarQueueGap, 6);
  });

  it('cancels SC IN THIS LAP when a new live block appears', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('incident', 'blocked', counts(0, 0, 0, 1)),
    );
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('incident', 'working', counts(1, 0, 0, 0)),
    ])), 1);
    expect(session.presentation().raceControl).toMatchObject({ phase: 'inThisLap' });

    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'blocked', counts(0, 0, 0, 1)),
      car('incident', 'working', counts(1, 0, 0, 0)),
    ])), 2);
    expect(session.presentation().raceControl).toMatchObject({ phase: 'deployed' });
  });

  it('resumes only when the leader crosses the line and shows GREEN FLAG for three seconds', () => {
    const session = continuous(
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('incident', 'blocked', counts(0, 0, 0, 1)),
    );
    session.applySnapshot(snap(team('alpha', 'alpha', [
      car('leader', 'working', counts(1, 0, 0, 0)),
      car('incident', 'working', counts(1, 0, 0, 0)),
    ])), 0);
    expect(session.presentation().raceControl).toMatchObject({ phase: 'inThisLap' });

    tickTo(session, 0, 45);
    expect(session.presentation().raceControl).toEqual({ kind: 'greenFlag' });
    tickTo(session, 45, 47);
    expect(session.presentation().raceControl).toEqual({ kind: 'greenFlag' });
    tickTo(session, 47, 49);
    expect(session.presentation().raceControl).toEqual({ kind: 'green' });
  });
});
