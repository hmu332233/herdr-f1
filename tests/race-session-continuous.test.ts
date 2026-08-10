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
  it('scores idle, done, and mixed crews at 0.75x official pace', () => {
    const session = continuous(
      car('idle', 'idle', counts(0, 2, 0, 0)),
      car('done', 'done', counts(0, 0, 2, 0)),
      car('mixed', 'cruising', counts(0, 1, 1, 0)),
    );
    tickTo(session, 0, RaceRules.baseLapDuration);
    for (const id of ['idle', 'done', 'mixed']) {
      const entry = entryById(session.presentation(), id);
      expect(entry.officialDistance).toBeCloseTo(0.75, 8);
      expect(entry.placement.kind).toBe('track');
    }
  });

  it('changes working immediately to 1.0x and accepts its sustained uptime bonus', () => {
    const session = continuous(car('worker', 'working', counts(1, 0, 0, 0)));
    tickTo(session, 0, RaceRules.baseLapDuration);
    expect(entryById(session.presentation(), 'worker').officialDistance).toBeCloseTo(1, 8);

    session.setExternalPace('worker', 1.25, RaceRules.baseLapDuration);
    tickTo(session, RaceRules.baseLapDuration, RaceRules.baseLapDuration * 2);
    expect(entryById(session.presentation(), 'worker').officialDistance).toBeCloseTo(2.25, 8);
  });

  it('keeps an offline stale block cruising without deploying the Safety Car', () => {
    const session = continuous(car('offline', 'blocked', counts(0, 0, 0, 2), true));
    tickTo(session, 0, RaceRules.baseLapDuration);
    const presentation = session.presentation();
    expect(entryById(presentation, 'offline').officialDistance).toBeCloseTo(0.75, 8);
    expect(entryById(presentation, 'offline').isLastKnown).toBe(true);
    expect(presentation.teams[0].isOffline).toBe(true);
    expect(presentation.flag).toEqual({ kind: 'green' });
    expect(presentation.raceControl).toEqual({ kind: 'green' });
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
    const initialGap = entryById(before, 'leader').officialDistance
      - entryById(before, 'follower').officialDistance;
    tickTo(session, 36, 54);
    const after = session.presentation();
    const finalGap = entryById(after, 'leader').officialDistance
      - entryById(after, 'follower').officialDistance;
    expect(entryById(after, 'blocked').officialDistance).toBeCloseTo(
      entryById(before, 'blocked').officialDistance,
      8,
    );
    expect(finalGap).toBeGreaterThanOrEqual(MultiplayerRules.safetyCarQueueGap - 1e-9);
    expect(finalGap).toBeLessThan(initialGap);
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
