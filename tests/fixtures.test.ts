import { describe, expect, it } from 'vitest';
import { FIXTURE_NAMES, loadFixture } from '../src/server/fixtures.js';
import { createRaceSession } from '../src/server/race-session.js';

describe('fixtures', () => {
  it('exposes the fixture names', () => {
    expect([...FIXTURE_NAMES]).toEqual(['grid', 'dense', 'redflag', 'error', 'podium']);
  });

  it('grid: 4 teams, 8 cars, all four statuses, live and spread out', () => {
    const session = createRaceSession();
    loadFixture('grid', session);
    const presentation = session.presentation();
    expect(presentation.teams).toHaveLength(4);
    const entries = presentation.teams.flatMap(t => t.entries);
    expect(entries).toHaveLength(8);
    expect(new Set(entries.map(e => e.status))).toEqual(new Set(['working', 'idle', 'done', 'blocked']));
    expect(presentation.connection.kind).toBe('live');
    expect(presentation.overlay.kind).toBe('none');
    const distances = new Set(entries.map(e => e.officialDistance.toFixed(2)));
    expect(distances.size).toBeGreaterThan(4); // staggered, not bunched
    expect(entries.some(e => e.isFocused)).toBe(true);
  });

  it('is deterministic', () => {
    const a = createRaceSession();
    const b = createRaceSession();
    loadFixture('grid', a);
    loadFixture('grid', b);
    expect(JSON.stringify(a.presentation())).toBe(JSON.stringify(b.presentation()));
  });

  it('dense: more than 12 teams so pattern tokens appear', () => {
    const session = createRaceSession();
    loadFixture('dense', session);
    const presentation = session.presentation();
    expect(presentation.teams.length).toBe(14);
    expect(presentation.teams.some(t => t.colorToken.kind === 'pattern')).toBe(true);
  });

  it('redflag: frozen race under RED FLAG · HERDR OFFLINE', () => {
    const session = createRaceSession();
    loadFixture('redflag', session);
    const presentation = session.presentation();
    expect(presentation.connection.kind).toBe('offline');
    expect(presentation.overlay.kind).toBe('redFlag');
    expect(presentation.teams.length).toBeGreaterThan(0);
  });

  it('error: SESSION SUSPENDED with detail', () => {
    const session = createRaceSession();
    loadFixture('error', session);
    expect(session.presentation().overlay).toEqual({
      kind: 'suspended',
      detail: 'Unsupported Herdr protocol 999',
    });
  });

  it('podium: finished race showing the team podium', () => {
    const session = createRaceSession();
    loadFixture('podium', session);
    const presentation = session.presentation();
    expect(presentation.phase).toBe('podium');
    expect(presentation.podium?.top.length).toBe(3);
  });
});
