import type { SyncMessage } from '../shared/protocol.js';
import type { EntryPresentation } from '../shared/presentation.js';
import { centerline, cumulativeLengths, pointAt, tangentAt, type CircuitPoint } from './geometry.js';
import { contrastText, hexAlpha, palette, teamColor } from './palette.js';
import { extrapolateProgress } from './state.js';

// Fixed logical scene, aspect-fitted into the canvas (mirrors the SKScene).
const SCENE_W = 620;
const SCENE_H = 540;
const DESIGN_W = 600;
const DESIGN_H = 540;
const RADIUS = 12.5;
const PIT_ROUTE_SECONDS = 1.4;
const PIT_RETURN_SPEED = 1 / 12;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

interface MarkerRuntime {
  phase: 'parked' | 'exiting' | 'racing' | 'approaching' | 'entering';
  transition: {
    points: CircuitPoint[]; lengths: number[]; startedAt: number;
  } | null;
  progress: number | null;
  lastFrameAt: number;
  speed: number;
  x: number;
  y: number;
}

interface SmokeParticle { x: number; y: number; vx: number; vy: number; bornAt: number; life: number }

export function createTrackRenderer(
  canvas: HTMLCanvasElement,
  onFocus: (terminalID: string) => void,
) {
  const ctx = canvas.getContext('2d')!;
  let sync: SyncMessage | null = null;
  let receivedAt = 0;

  let dpr = 1;
  let cssWidth = 0;
  let cssHeight = 0;
  let sceneScale = 1;
  let offsetX = 0;
  let offsetY = 0;

  const designScale = Math.min((SCENE_W - 88) / DESIGN_W, (SCENE_H - 80) / DESIGN_H);
  const ds = designScale;
  const fittedW = DESIGN_W * ds;
  const fittedH = DESIGN_H * ds;
  const circuitRect = {
    x: (SCENE_W - fittedW) / 2, y: (SCENE_H - fittedH) / 2, width: fittedW, height: fittedH,
  };
  const line = centerline(circuitRect);
  const lengths = cumulativeLengths(line);

  // Pit anchors: sampled centerline points on the bottom straight. The
  // Swift original works y-up; here css-down, so "bottom" is the largest y
  // and the circuit interior is upward (-y).
  const bottomLimit = circuitRect.y + circuitRect.height * 0.84;
  const bottomIndices = line
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.y >= bottomLimit)
    .map(({ index }) => index);
  const fallback = bottomIndices[0] ?? 0;
  const entryIndex = bottomIndices.reduce((a, b) => (line[a].x <= line[b].x ? a : b), fallback);
  const exitIndex = bottomIndices.reduce((a, b) => (line[a].x >= line[b].x ? a : b), fallback);
  const pitEntry = line[entryIndex];
  const pitExit = line[exitIndex];
  const pitEntryProgress = lengths[entryIndex] / lengths[line.length];
  const pitExitProgress = lengths[exitIndex] / lengths[line.length];
  const entryTangent = tangentAt(entryIndex, line);
  const exitTangent = tangentAt(exitIndex, line);
  const trackY = (pitEntry.y + pitExit.y) / 2;
  const laneY = trackY - 27 * ds;
  const laneMinX = pitEntry.x + 64 * ds;
  const laneMaxX = pitExit.x - 64 * ds;
  const pitLaneRect = { x: laneMinX, y: laneY - 45 * ds, width: laneMaxX - laneMinX, height: 38 * ds };

  let staticCanvas: HTMLCanvasElement | null = null;
  let staticSignature = '';
  let pitBoxes = new Map<string, CircuitPoint>();
  const markers = new Map<string, MarkerRuntime>();
  const smoke = new Map<string, { particles: SmokeParticle[]; lastSpawn: number }>();
  let hits: Array<{ id: string; x: number; y: number }> = [];

  resize();
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offsetX) / sceneScale;
    const y = (event.clientY - rect.top - offsetY) / sceneScale;
    let best: { id: string; d: number } | null = null;
    for (const hit of hits) {
      const d = Math.hypot(hit.x - x, hit.y - y);
      if (d <= RADIUS + 3.5 && (best === null || d < best.d)) best = { id: hit.id, d };
    }
    if (best) onFocus(best.id);
  });

  function setSync(nextSync: SyncMessage, receivedAtMs: number): void {
    sync = nextSync;
    receivedAt = receivedAtMs;
  }

  function resize(): void {
    const parent = canvas.parentElement!;
    cssWidth = Math.max(1, parent.clientWidth);
    cssHeight = Math.max(1, parent.clientHeight);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    sceneScale = Math.min(cssWidth / SCENE_W, cssHeight / SCENE_H);
    offsetX = (cssWidth - SCENE_W * sceneScale) / 2;
    offsetY = (cssHeight - SCENE_H * sceneScale) / 2;
    staticSignature = '';
  }

  function frame(nowMs: number): void {
    const currentSync = sync;
    if (!currentSync) return;
    rebuildStaticIfNeeded(currentSync);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0);

    ctx.setTransform(
      dpr * sceneScale, 0, 0, dpr * sceneScale,
      dpr * offsetX, dpr * offsetY,
    );

    const elapsed = (nowMs - receivedAt) / 1000;
    const entries = currentSync.teams.flatMap(team => team.entries);
    const progressByID = new Map<string, number>();
    for (const entry of entries) {
      const progress = extrapolateProgress(entry.placement, entry.displaySpeed, elapsed);
      if (progress !== null) progressByID.set(entry.id, progress);
    }

    // Bounded separation: entries sharing nearly identical circuit progress
    // fan out perpendicular to the track. Standings are never reordered to
    // solve a visual overlap.
    const buckets = new Map<number, EntryPresentation[]>();
    for (const entry of entries) {
      const progress = progressByID.get(entry.id);
      if (progress === undefined) continue;
      const bucket = Math.floor(progress * 140);
      const list = buckets.get(bucket) ?? [];
      list.push(entry);
      buckets.set(bucket, list);
    }
    const separation = new Map<string, number>();
    for (const bucket of buckets.values()) {
      const ordered = bucket.slice().sort((a, b) => a.carNumber - b.carNumber);
      ordered.forEach((entry, index) => {
        const spread = index - (ordered.length - 1) / 2;
        separation.set(entry.id, Math.max(-16, Math.min(16, spread * 9)));
      });
    }

    // Pit stacking: parked cars cascade with small offsets per team.
    const pitSlots = new Map<string, number>();
    const pitCounts = new Map<string, number>();
    for (const entry of entries) {
      if (!isPitPlacement(entry)) continue;
      const count = pitCounts.get(entry.teamID) ?? 0;
      pitSlots.set(entry.id, count);
      pitCounts.set(entry.teamID, count + 1);
    }

    hits = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      // Retired cars leave the board entirely; the standings column is the
      // record of who dropped out.
      if (entry.placement.kind === 'retired') continue;
      seen.add(entry.id);
      const target = placementTarget(
        entry, progressByID.get(entry.id) ?? 0,
        separation.get(entry.id) ?? 0, pitSlots.get(entry.id) ?? 0,
      );
      let marker = markers.get(entry.id);
      if (!marker) {
        // A newly discovered circulating car always joins from its team pit.
        // This gives first appearance the same stable departure as idle → working.
        const spawn = target.kind === 'circuit'
          ? pitTarget(entry.teamID, pitSlots.get(entry.id) ?? 0)
          : target;
        marker = {
          phase: 'parked', transition: null, progress: null,
          lastFrameAt: nowMs, speed: entry.displaySpeed, x: spawn.x, y: spawn.y,
        };
        markers.set(entry.id, marker);
      }
      updateMarker(
        marker, target, progressByID.get(entry.id) ?? null,
        entry.displaySpeed, nowMs,
      );
      drawMarker(ctx, entry, marker.x, marker.y, nowMs);
      hits.push({ id: entry.id, x: marker.x, y: marker.y });
    }
    for (const id of [...markers.keys()]) {
      if (!seen.has(id)) {
        markers.delete(id);
        smoke.delete(id);
      }
    }
  }

  // MARK: - Placement

  function placementTarget(
    entry: EntryPresentation, progress: number, separation: number, pitSlot: number,
  ): { x: number; y: number; angle: number; kind: 'circuit' | 'pit' } {
    const placement = entry.placement;
    if (placement.kind === 'track' || placement.kind === 'cooldown' || placement.kind === 'incidentTrack') {
      const point = pointAt(progress, line, lengths);
      // A stable per-car lane offset keeps close markers readable even before
      // the bounded bucket separation kicks in.
      const lane = ((entry.carNumber % 3) - 1) * 4 + separation;
      return {
        x: point.x + Math.cos(point.angle + Math.PI / 2) * lane,
        y: point.y + Math.sin(point.angle + Math.PI / 2) * lane,
        angle: point.angle,
        kind: 'circuit',
      };
    }
    return pitTarget(entry.teamID, pitSlot);
  }

  function pitTarget(teamID: string, pitSlot: number): { x: number; y: number; angle: number; kind: 'pit' } {
    const box = pitBoxes.get(teamID) ??
      { x: pitLaneRect.x + pitLaneRect.width / 2, y: pitLaneRect.y + pitLaneRect.height / 2 };
    // Cascade downward in css space (the Swift original cascades -y in y-up).
    return { x: box.x + pitSlot * 12, y: box.y + pitSlot * 10, angle: 0, kind: 'pit' };
  }

  function updateMarker(
    marker: MarkerRuntime,
    target: { x: number; y: number; kind: 'circuit' | 'pit' },
    serverProgress: number | null, displaySpeed: number, nowMs: number,
  ): void {
    const dt = Math.min(0.1, Math.max(0, (nowMs - marker.lastFrameAt) / 1000));
    marker.lastFrameAt = nowMs;
    if (displaySpeed > 0) marker.speed = displaySpeed;
    const wantsCircuit = target.kind === 'circuit';

    if (marker.phase === 'parked') {
      if (wantsCircuit) {
        startPitRoute(marker, exitRoute({ x: marker.x, y: marker.y }), 'exiting', nowMs);
      } else {
        marker.x = target.x;
        marker.y = target.y;
      }
    } else if (marker.phase === 'exiting' || marker.phase === 'entering') {
      if (advancePitRoute(marker, nowMs)) {
        if (marker.phase === 'exiting') {
          marker.phase = wantsCircuit ? 'racing' : 'approaching';
          marker.progress = pitExitProgress;
        } else {
          marker.phase = 'parked';
          marker.progress = null;
        }
      }
    } else {
      if (marker.progress === null) marker.progress = serverProgress ?? pitExitProgress;
      if (marker.phase === 'racing' && !wantsCircuit) marker.phase = 'approaching';
      if (marker.phase === 'approaching' && wantsCircuit) marker.phase = 'racing';

      if (marker.phase === 'approaching') {
        const remaining = forwardDistance(marker.progress, pitEntryProgress);
        const step = Math.max(marker.speed, PIT_RETURN_SPEED) * dt;
        if (step >= remaining) {
          marker.progress = pitEntryProgress;
          startPitRoute(marker, entryRoute(target), 'entering', nowMs);
        } else {
          marker.progress = normalizeProgress(marker.progress + step);
        }
      } else {
        marker.progress = normalizeProgress(marker.progress + displaySpeed * dt);
      }
    }

    if (marker.phase === 'racing' || marker.phase === 'approaching') {
      const point = pointAt(marker.progress ?? 0, line, lengths);
      marker.x = point.x;
      marker.y = point.y;
    }
  }

  function startPitRoute(
    marker: MarkerRuntime, points: CircuitPoint[],
    phase: 'exiting' | 'entering', nowMs: number,
  ): void {
    marker.phase = phase;
    marker.transition = { points, lengths: openLengths(points), startedAt: nowMs };
  }

  function advancePitRoute(marker: MarkerRuntime, nowMs: number): boolean {
    const transition = marker.transition;
    if (!transition) return true;
    const raw = (nowMs - transition.startedAt) / (PIT_ROUTE_SECONDS * 1000);
    const t = Math.max(0, Math.min(1, raw));
    const eased = t * t * (3 - 2 * t);
    const point = pointAlongOpenPath(eased, transition.points, transition.lengths);
    marker.x = point.x;
    marker.y = point.y;
    if (raw < 1) return false;
    marker.transition = null;
    return true;
  }

  function exitRoute(from: CircuitPoint): CircuitPoint[] {
    return [from, ...sampleQuadratic(
      from, { x: pitExit.x - 44, y: from.y }, pitExit,
    )];
  }

  function entryRoute(target: CircuitPoint): CircuitPoint[] {
    return [pitEntry, ...sampleQuadratic(
      pitEntry, { x: pitEntry.x + 44, y: target.y }, target,
    )];
  }

  // MARK: - Marker drawing

  function drawMarker(
    ctx: CanvasRenderingContext2D, entry: EntryPresentation,
    x: number, y: number, nowMs: number,
  ): void {
    const color = teamColor(entry.colorToken);
    ctx.save();
    ctx.translate(x, y);

    // Focus brackets: four broadcast-style corners outside every other ring.
    if (entry.isFocused) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      const r = RADIUS + 7;
      const arm = 5;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
        ctx.moveTo(sx * r - sx * arm, sy * r);
        ctx.lineTo(sx * r, sy * r);
        ctx.lineTo(sx * r, sy * r - sy * arm);
      }
      ctx.stroke();
    }

    // Status ring + treatments; the team fill never changes with status.
    ctx.globalAlpha = 1;
    if (entry.isQueuedNextGrid) {
      ring(ctx, RADIUS + 3.5, palette.textMuted, 1);
    } else {
      switch (entry.status) {
        case 'working':
          ring(ctx, RADIUS + 3.5, 'rgba(255,255,255,0.85)', 1.5);
          break;
        case 'idle':
          ring(ctx, RADIUS + 3.5, palette.statusPit, 1.5);
          break;
        case 'done':
          ring(ctx, RADIUS + 3.5, 'rgba(51,51,51,1)', 3);
          ctx.setLineDash([4, 4]);
          ring(ctx, RADIUS + 3.5, '#FFFFFF', 3);
          ctx.setLineDash([]);
          break;
        case 'blocked': {
          // Flash: 0.4 s fade out / 0.4 s fade in, like the SKAction loop.
          const alpha = 0.25 + 0.75 * Math.abs(Math.sin((Math.PI * nowMs) / 800));
          ctx.globalAlpha = alpha;
          ring(ctx, RADIUS + 3.5, palette.liveRed, 2);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }

    // Team disc with fixed contrast number.
    ctx.beginPath();
    ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.canvas;
    ctx.stroke();

    // Pattern outline for post-palette teams.
    if (entry.colorToken.kind === 'pattern') {
      const dashes = [[3, 3], [7, 3], []][entry.colorToken.slot % 3];
      ctx.setLineDash(dashes);
      ring(ctx, RADIUS + 1, '#FFFFFF', 1.2);
      ctx.setLineDash([]);
    }

    ctx.fillStyle = contrastText(color);
    ctx.font = `800 ${entry.carNumber > 99 ? 8 : 10}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(entry.carNumber), 0, 0.5);

    // Tags below/above the disc.
    ctx.font = `800 7px ${FONT}`;
    ctx.textBaseline = 'top';
    if (entry.isQueuedNextGrid) {
      ctx.fillStyle = palette.textMuted;
      ctx.fillText('NEXT GRID', 0, RADIUS + 6);
    } else if (entry.status === 'idle') {
      ctx.fillStyle = palette.statusPit;
      ctx.fillText('PIT', 0, RADIUS + 6);
    }
    if (entry.showsNewStint) {
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'bottom';
      ctx.fillText('NEW STINT', 0, -RADIUS - 9);
    }

    // Incident: warning triangle up-right + restrained smoke.
    if (!entry.isQueuedNextGrid && entry.status === 'blocked') {
      ctx.save();
      ctx.translate(RADIUS + 2, -RADIUS - 2);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5.5, 4);
      ctx.lineTo(-5.5, 4);
      ctx.closePath();
      ctx.fillStyle = palette.statusBlocked;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.canvas;
      ctx.stroke();
      ctx.restore();
      drawSmoke(ctx, entry.id, nowMs);
    } else {
      smoke.delete(entry.id);
    }

    ctx.restore();
  }

  /** Minimal particle system: ~5 puffs/s, 1.1 s life, rising and fading —
   *  matches the restrained SKEmitter settings. Drawn in marker-local space. */
  function drawSmoke(ctx: CanvasRenderingContext2D, id: string, nowMs: number): void {
    const state = smoke.get(id) ?? { particles: [], lastSpawn: 0 };
    smoke.set(id, state);
    if (nowMs - state.lastSpawn > 200 && state.particles.length < 12) {
      state.lastSpawn = nowMs;
      state.particles.push({
        x: (id.length * 7 + state.particles.length * 13) % 7 - 3, // deterministic jitter
        y: -RADIUS,
        vx: ((state.particles.length % 3) - 1) * 4,
        vy: -16,
        bornAt: nowMs,
        life: 1100,
      });
    }
    state.particles = state.particles.filter(p => nowMs - p.bornAt < p.life);
    for (const particle of state.particles) {
      const age = (nowMs - particle.bornAt) / 1000;
      const fade = Math.max(0, 0.35 - age * 0.35);
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(179,179,179,1)';
      ctx.beginPath();
      ctx.arc(particle.x + particle.vx * age, particle.y + particle.vy * age, 2.4 + age * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // MARK: - Static chrome

  function rebuildStaticIfNeeded(sync: SyncMessage): void {
    // Pit boxes are keyed by stable team ID, so box positions do not shuffle
    // when the standings rank changes.
    const teamIDs = sync.teams.map(team => team.id).sort();
    const signature = `${canvas.width}x${canvas.height}|${teamIDs.join(',')}`;
    if (signature === staticSignature) return;
    staticSignature = signature;

    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d')!;
    ctx.setTransform(
      dpr * sceneScale, 0, 0, dpr * sceneScale,
      dpr * offsetX, dpr * offsetY,
    );
    const ds = designScale;
    const trackWidth = 22 * ds;
    const pitWidth = 11 * ds;

    // Fixed technical grid behind the circuit.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= SCENE_W; x += 24) { ctx.moveTo(x, -offsetY / sceneScale); ctx.lineTo(x, SCENE_H + offsetY / sceneScale); }
    for (let y = 0; y <= SCENE_H; y += 24) { ctx.moveTo(-offsetX / sceneScale, y); ctx.lineTo(SCENE_W + offsetX / sceneScale, y); }
    ctx.stroke();

    const circuit = new Path2D();
    line.forEach((point, index) => (index === 0 ? circuit.moveTo(point.x, point.y) : circuit.lineTo(point.x, point.y)));
    circuit.closePath();
    const pitGuide = pitGuidePath();

    // Faint infield tint.
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fill(circuit);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Layering: both edge outlines first, then both asphalt fills, so the two
    // tarmac surfaces merge seamlessly at the pit junctions.
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = pitWidth + 4;
    ctx.stroke(pitGuide);
    ctx.lineWidth = trackWidth + 4;
    ctx.stroke(circuit);
    ctx.strokeStyle = palette.asphalt;
    ctx.lineWidth = pitWidth;
    ctx.stroke(pitGuide);
    ctx.lineWidth = trackWidth;
    ctx.stroke(circuit);
    // Faint dashed center lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 9]);
    ctx.stroke(circuit);
    ctx.stroke(pitGuide);
    ctx.setLineDash([]);

    drawStartFinish(ctx, trackWidth);
    drawPitLane(ctx, sync, ds);

    staticCanvas = off;
  }

  function pitGuidePath(): Path2D {
    const ds = designScale;
    const reach = 46 * ds;
    const laneMinX = pitLaneRect.x;
    const laneMaxX = pitLaneRect.x + pitLaneRect.width;
    const path = new Path2D();
    path.moveTo(pitEntry.x, pitEntry.y);
    path.bezierCurveTo(
      pitEntry.x + entryTangent.dx * reach, pitEntry.y + entryTangent.dy * reach,
      laneMinX - 40 * ds, laneY,
      laneMinX, laneY,
    );
    path.lineTo(laneMaxX, laneY);
    path.bezierCurveTo(
      laneMaxX + 40 * ds, laneY,
      pitExit.x - exitTangent.dx * reach, pitExit.y - exitTangent.dy * reach,
      pitExit.x, pitExit.y,
    );
    return path;
  }

  function drawStartFinish(ctx: CanvasRenderingContext2D, trackWidth: number): void {
    const start = pointAt(0, line, lengths);
    const width = trackWidth * 0.42;
    const height = trackWidth + 2;
    const columns = 2;
    const rows = 6;
    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(start.angle);
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        ctx.fillStyle = (column + row) % 2 === 0 ? '#FFFFFF' : palette.canvas;
        ctx.fillRect(
          -width / 2 + (column * width) / columns,
          -height / 2 + (row * height) / rows,
          width / columns, height / rows,
        );
      }
    }
    ctx.restore();
  }

  function drawPitLane(ctx: CanvasRenderingContext2D, sync: SyncMessage, ds: number): void {
    const rect = pitLaneRect;

    ctx.fillStyle = hexAlpha(palette.card, 0.72);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 2 * ds);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 8px ${FONT}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText('PIT LANE', rect.x + rect.width / 2, rect.y - 6 * ds);

    ctx.font = `600 7px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('PIT ENTRY  ›››', pitEntry.x + 10 * ds, trackY + 16 * ds);
    ctx.textAlign = 'right';
    ctx.fillText('‹‹‹  PIT EXIT', pitExit.x - 10 * ds, trackY + 16 * ds);

    // One bay per team, sorted by stable team ID.
    pitBoxes = new Map();
    const teams = sync.teams.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const inset = 6 * ds;
    const usable = rect.width - inset * 2;
    teams.forEach((team, index) => {
      const fraction = (index + 0.5) / Math.max(teams.length, 1);
      const x = rect.x + inset + fraction * usable;
      const midY = rect.y + rect.height / 2;
      const center = { x, y: midY - 2 * ds };
      const slotWidth = usable / Math.max(teams.length, 1);
      const bayWidth = Math.max(14 * ds, slotWidth - 4 * ds);

      ctx.fillStyle = hexAlpha(palette.canvas, 0.78);
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 1;
      roundedRect(ctx, center.x - bayWidth / 2, center.y - 15 * ds, bayWidth, 30 * ds, 3 * ds);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = teamColor(team.colorToken);
      roundedRect(ctx, center.x - (bayWidth - 4 * ds) / 2, center.y - 12 * ds - 1.5 * ds, bayWidth - 4 * ds, 3 * ds, 1);
      ctx.fill();

      ctx.fillStyle = palette.textMuted;
      ctx.font = `700 5px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(index + 1).padStart(2, '0'), center.x, center.y + 13 * ds);

      pitBoxes.set(team.id, center);
    });
  }

  return { setSync, resize, frame };
}

// MARK: - Drawing helpers

/** Placements that park beside the pit lane and cascade per team (mirrors the
 *  Swift RaceTrackScene.isPitPlacement). */
function isPitPlacement(entry: EntryPresentation): boolean {
  const kind = entry.placement.kind;
  return kind === 'pit' || kind === 'incidentPit' || kind === 'nextGrid';
}

function ring(ctx: CanvasRenderingContext2D, radius: number, color: string, width: number): void {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function roundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function quadratic(p0: CircuitPoint, control: CircuitPoint, p1: CircuitPoint, t: number): CircuitPoint {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * p0.x + 2 * inverse * t * control.x + t * t * p1.x,
    y: inverse * inverse * p0.y + 2 * inverse * t * control.y + t * t * p1.y,
  };
}

function sampleQuadratic(p0: CircuitPoint, control: CircuitPoint, p1: CircuitPoint): CircuitPoint[] {
  return Array.from({ length: 12 }, (_, index) => quadratic(p0, control, p1, (index + 1) / 12));
}

function openLengths(points: CircuitPoint[]): number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(
      points[index].x - points[index - 1].x, points[index].y - points[index - 1].y,
    ));
  }
  return lengths;
}

function pointAlongOpenPath(fraction: number, points: CircuitPoint[], lengths: number[]): CircuitPoint {
  const target = Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
  let index = 0;
  while (index < points.length - 2 && lengths[index + 1] < target) index += 1;
  const segment = Math.max(0.0001, lengths[index + 1] - lengths[index]);
  const t = (target - lengths[index]) / segment;
  return {
    x: points[index].x + (points[index + 1].x - points[index].x) * t,
    y: points[index].y + (points[index + 1].y - points[index].y) * t,
  };
}

function normalizeProgress(progress: number): number {
  const normalized = progress % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

function forwardDistance(from: number, to: number): number {
  return normalizeProgress(to - from);
}
