import type { SyncMessage } from '../shared/protocol.js';
import type { EntryPresentation } from '../shared/presentation.js';
import { circuitByID, DEFAULT_CIRCUIT_ID, type CircuitDefinition } from './circuits.js';
import {
  centerline, centerlineIndexOf, cumulativeLengths, pointAt, tangentAt, type CircuitPoint,
} from './geometry.js';
import { contrastText, hexAlpha, palette, teamColor } from './palette.js';
import { extrapolateProgress } from './state.js';

// Fixed logical scene, aspect-fitted into the canvas (mirrors the SKScene).
const SCENE_W = 620;
const SCENE_H = 540;
const DESIGN_W = 600;
const DESIGN_H = 540;
/** Default car-marker radius. Circuits that run stretches of track close
 *  together override it via CircuitDefinition.markerRadius. */
const RADIUS = 12.5;
const PIT_ROUTE_SECONDS = 1.4;
const PIT_RETURN_SPEED = 1 / 12;
const SAFETY_CAR_DISPLAY_SPEED = (1 / 18) * 0.4;
/** Yellow-flag flash period, matching the blocked marker ring's 0.8 s loop so
 *  the track edge and the cars that caused it pulse together. */
const FLAG_FLASH_PERIOD = 800;

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

/** Everything derived from a circuit definition: the smoothed centerline and
 *  the pit-lane frame built around its authored pit straight. Swapping
 *  circuits replaces this wholesale. */
interface CircuitLayout {
  circuit: CircuitDefinition;
  line: CircuitPoint[];
  lengths: number[];
  pitEntry: CircuitPoint;
  pitExit: CircuitPoint;
  pitEntryProgress: number;
  pitExitProgress: number;
  entryTangent: { dx: number; dy: number };
  exitTangent: { dx: number; dy: number };
  trackY: number;
  laneY: number;
  pitLaneRect: { x: number; y: number; width: number; height: number };
  /** Lane-local frame: the pit lane is drawn rotated onto its own straight, so
   *  a diagonal pit straight still gets a lane running alongside it rather than
   *  an axis-aligned box lying across the circuit. */
  laneFrame: { originX: number; originY: number; angle: number };
  /** Lap fraction the chequered line is drawn at — just past pit exit, on the
   *  pit straight, rather than at whatever point the circuit's list starts on. */
  startFinishProgress: number;
}

export function createTrackRenderer(
  canvas: HTMLCanvasElement,
  onFocus: (terminalID: string) => void,
  initialCircuitID: string = DEFAULT_CIRCUIT_ID,
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
  // Usable area for the circuit, inset from the scene edges to leave room for
  // pit-lane chrome and marker labels.
  const frameW = DESIGN_W * ds;
  const frameH = DESIGN_H * ds;

  /** Rect a circuit is fitted into.
   *
   *  Circuit coordinates are normalized 0..1 on both axes, so the rect's shape
   *  decides the rendered proportions. A wide layout fitted to its exact source
   *  aspect leaves the frame's full height unused, which squeezes parallel
   *  stretches of track until markers on them overlap; letting it fill the
   *  frame instead stretches the drawing. `fill` chooses between those: 0 keeps
   *  the source proportions exactly, 1 uses the whole frame, and values between
   *  trade a little distortion for the vertical room the markers need. */
  function rectFor(circuit: CircuitDefinition): {
    x: number; y: number; width: number; height: number;
  } {
    const scale = Math.min(frameW / circuit.aspect, frameH);
    const trueWidth = scale * circuit.aspect;
    const trueHeight = scale;
    const fill = circuit.fill ?? 0;
    const width = trueWidth + (frameW - trueWidth) * fill;
    const height = trueHeight + (frameH - trueHeight) * fill;
    return {
      x: (SCENE_W - width) / 2,
      y: (SCENE_H - height) / 2,
      width,
      height,
    };
  }

  /** Resolves a circuit definition into drawable geometry.
   *
   *  Pit anchors come from the circuit's authored control-point indices. The
   *  circuit itself is authored y-up; the canvas is y-down, so the lane sits
   *  at smaller y (toward the circuit interior) than the pit straight. */
  function buildLayout(circuit: CircuitDefinition): CircuitLayout {
    const rect = rectFor(circuit);
    const line = centerline(rect, circuit);
    const lengths = cumulativeLengths(line);
    const count = circuit.points.length;
    const entryIndex = centerlineIndexOf(circuit.pit.entry, count);
    const exitIndex = centerlineIndexOf(circuit.pit.exit, count);
    const pitEntry = line[entryIndex];
    const pitExit = line[exitIndex];
    const trackY = (pitEntry.y + pitExit.y) / 2;
    // The lane box stays axis-aligned (the bays, labels and stacking all work
    // in x/y), so it is offset along whichever axis the pit straight runs
    // *across*. For a horizontal straight that is straight up; for a diagonal
    // one it is up and inward, following the straight's own normal so the lane
    // sits alongside the track instead of across it.
    const spanX = pitExit.x - pitEntry.x;
    const spanY = pitExit.y - pitEntry.y;
    const spanLength = Math.max(1e-6, Math.hypot(spanX, spanY));
    const midX = (pitEntry.x + pitExit.x) / 2;
    const midY = (pitEntry.y + pitExit.y) / 2;
    // Unit normal to the pit straight, pointed at whichever side has more room.
    // A pit lane belongs *outside* its straight, so the side to use is the one
    // with less track on it: sample the centreline either side of the straight
    // and keep the emptier direction. Aiming at the circuit's centre instead
    // would tuck the lane inside the loop, on top of the track, whenever the
    // pit straight runs along an outer edge.
    const offset = 46 * ds;
    const baseX = spanY / spanLength;
    const baseY = -spanX / spanLength;
    // Score a side by how much track sits in the band the lane would occupy.
    // Probes run the length of the straight, not just its midpoint: a single
    // probe ties easily on a diagonal straight and then picks a side at random,
    // which drops the lane on top of the circuit.
    const nearbyTrack = (dirX: number, dirY: number): number => {
      const probes = 7;
      let total = 0;
      for (let step = 0; step < probes; step += 1) {
        const t = (step + 0.5) / probes;
        const alongX = pitEntry.x + spanX * t + dirX * offset;
        const alongY = pitEntry.y + spanY * t + dirY * offset;
        for (const point of line) {
          const d = Math.hypot(point.x - alongX, point.y - alongY);
          // Weight by closeness, so track running right through the band counts
          // for much more than track merely in the neighbourhood.
          if (d < offset) total += 1 - d / offset;
        }
      }
      return total;
    };
    const flip = nearbyTrack(baseX, baseY) > nearbyTrack(-baseX, -baseY);
    const normalX = flip ? -baseX : baseX;
    const normalY = flip ? -baseY : baseY;
    // Clear the track by the lane box's own half-height plus the asphalt, so the
    // box sits fully beside the straight. Offsetting by a flat amount leaves a
    // steep straight — Las Vegas climbs at 113° — with the box straddling it.
    const laneOffset = 27 * ds + (38 * ds) / 2;
    const laneY = midY + normalY * laneOffset;
    const laneCenterX = midX + normalX * laneOffset;
    // Inset the lane from both anchors so the guide curves have room to bend
    // away from the circuit and back. A short pit straight would leave no lane
    // at all, so the width floor is generous enough to hold a full grid of bays
    // — Las Vegas's start/finish diagonal is barely longer than the lane needs.
    const halfWidth = Math.max(72 * ds, spanLength / 2 - 64 * ds);
    // The lane is built as an axis-aligned rect in its own rotated frame, whose
    // x axis runs along the pit straight. For a horizontal straight the frame is
    // the identity and the geometry is unchanged; for a diagonal one everything
    // — box, bays, labels, boxes — turns with it.
    const angle = Math.atan2(spanY, spanX);
    return {
      circuit, line, lengths, pitEntry, pitExit,
      pitEntryProgress: lengths[entryIndex] / lengths[line.length],
      pitExitProgress: lengths[exitIndex] / lengths[line.length],
      entryTangent: tangentAt(entryIndex, line),
      exitTangent: tangentAt(exitIndex, line),
      trackY,
      laneY,
      pitLaneRect: {
        x: laneCenterX - halfWidth, y: laneY - 45 * ds,
        width: halfWidth * 2, height: 38 * ds,
      },
      laneFrame: { originX: laneCenterX, originY: laneY, angle },
      // Midway along the pit straight, which is where published layouts draw
      // it — alongside the pit buildings rather than at either junction.
      // Measured as a forward walk from entry so it still lands inside the
      // straight when that straddles progress 0, as it does on most layouts.
      startFinishProgress: (
        lengths[entryIndex] / lengths[line.length]
        + forwardDistance(
          lengths[entryIndex] / lengths[line.length],
          lengths[exitIndex] / lengths[line.length],
        ) * 0.5
      ) % 1,
    };
  }

  let layout = buildLayout(circuitByID(initialCircuitID));

  /** Car-marker radius for the current circuit. Read through a function rather
   *  than captured, so a circuit swap takes effect on the next frame. */
  function radius(): number {
    return layout.circuit.markerRadius ?? RADIUS;
  }

  let staticCanvas: HTMLCanvasElement | null = null;
  let staticSignature = '';
  let pitBoxes = new Map<string, CircuitPoint>();
  /** Asphalt width in scene units for the current circuit. Read by the live
   *  layer too, so the flashing yellow edge lands exactly on the baked one. */
  let trackWidth = (layout.circuit.trackWidth ?? 22) * ds;
  const markers = new Map<string, MarkerRuntime>();
  // Entries present in the first sync are already in the race. New browser
  // sessions must render them at their authoritative position, while agents
  // that join later still get the pit-exit animation.
  let initialEntryIDs: Set<string> | null = null;
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
      if (d <= radius() + 3.5 && (best === null || d < best.d)) best = { id: hit.id, d };
    }
    if (best) onFocus(best.id);
  });

  function setSync(nextSync: SyncMessage, receivedAtMs: number): void {
    if (initialEntryIDs === null) {
      initialEntryIDs = new Set(nextSync.teams.flatMap(team => team.entries.map(entry => entry.id)));
    }
    sync = nextSync;
    receivedAt = receivedAtMs;
  }

  /** Swaps the circuit under a running race.
   *
   *  Circuit progress is a normalized fraction, so racing markers keep theirs
   *  and simply resolve against the new centerline — standings and scoring are
   *  untouched, since both live on the server. Cars mid-pit-route are snapped
   *  to the phase their route was heading for: the old route's control points
   *  no longer describe anything on the new layout. */
  function setCircuit(circuitID: string): void {
    const next = circuitByID(circuitID);
    if (next.id === layout.circuit.id) return;
    layout = buildLayout(next);
    // The live yellow-flag edge is drawn from this, and may be drawn before the
    // static canvas is next rebuilt.
    trackWidth = (layout.circuit.trackWidth ?? 22) * ds;
    staticSignature = '';
    pitBoxes = new Map();
    for (const marker of markers.values()) {
      if (marker.phase === 'exiting') {
        marker.phase = 'racing';
        marker.progress = layout.pitExitProgress;
      } else if (marker.phase === 'entering' || marker.phase === 'parked') {
        marker.phase = 'parked';
        marker.progress = null;
      }
      marker.transition = null;
      if (marker.progress !== null) {
        const point = pointAt(marker.progress, layout.line, layout.lengths);
        marker.x = point.x;
        marker.y = point.y;
      }
    }
    // Parked markers are repositioned on the next frame, once drawPitLane has
    // rebuilt pitBoxes for the new lane.
  }

  function currentCircuitID(): string {
    return layout.circuit.id;
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

    // Under the markers: a stopped car is what raised the flag, so it must stay
    // the most visible thing on the circuit.
    if (currentSync.flag.kind === 'yellow') drawYellowFlagEdge(ctx, nowMs);

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
        const isInitialEntry = initialEntryIDs?.delete(entry.id) ?? false;
        // A page reload receives an already-running race as its first sync:
        // place those cars at the authoritative circuit progress. Entries
        // discovered later are genuinely new and still join from the pit.
        const spawn = !isInitialEntry && target.kind === 'circuit'
          ? pitTarget(entry.teamID, pitSlots.get(entry.id) ?? 0)
          : target;
        marker = {
          phase: isInitialEntry && target.kind === 'circuit' ? 'racing' : 'parked',
          transition: null,
          progress: isInitialEntry && target.kind === 'circuit'
            ? progressByID.get(entry.id) ?? null
            : null,
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
    if (currentSync.raceControl.kind === 'safetyCar') {
      drawSafetyCar(currentSync.raceControl.safetyCarProgress, elapsed);
    }
  }

  // MARK: - Placement

  function placementTarget(
    entry: EntryPresentation, progress: number, separation: number, pitSlot: number,
  ): { x: number; y: number; kind: 'circuit' | 'pit' } {
    const placement = entry.placement;
    if (placement.kind === 'track' || placement.kind === 'cooldown' || placement.kind === 'incidentTrack') {
      const point = pointAt(progress, layout.line, layout.lengths);
      // A stable per-car lane offset keeps close markers readable even before
      // the bounded bucket separation kicks in.
      const lane = ((entry.carNumber % 3) - 1) * 4 + separation;
      return {
        x: point.x + Math.cos(point.angle + Math.PI / 2) * lane,
        y: point.y + Math.sin(point.angle + Math.PI / 2) * lane,
        kind: 'circuit',
      };
    }
    return pitTarget(entry.teamID, pitSlot);
  }

  function pitTarget(teamID: string, pitSlot: number): { x: number; y: number; kind: 'pit' } {
    const box = pitBoxes.get(teamID) ?? { x: layout.laneFrame.originX, y: layout.laneFrame.originY };
    // Stacked cars cascade along the lane and out of it, in the lane's own frame
    // so the queue follows a rotated pit straight instead of always going
    // down-right in scene space.
    const cos = Math.cos(layout.laneFrame.angle);
    const sin = Math.sin(layout.laneFrame.angle);
    const alongLane = pitSlot * 12;
    const acrossLane = pitSlot * 10;
    return {
      x: box.x + alongLane * cos - acrossLane * sin,
      y: box.y + alongLane * sin + acrossLane * cos,
      kind: 'pit',
    };
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
          marker.progress = layout.pitExitProgress;
        } else {
          marker.phase = 'parked';
          marker.progress = null;
        }
      }
    } else {
      if (marker.progress === null) marker.progress = serverProgress ?? layout.pitExitProgress;
      if (marker.phase === 'racing' && !wantsCircuit) marker.phase = 'approaching';
      if (marker.phase === 'approaching' && wantsCircuit) marker.phase = 'racing';

      if (marker.phase === 'approaching') {
        const remaining = forwardDistance(marker.progress, layout.pitEntryProgress);
        const step = Math.max(marker.speed, PIT_RETURN_SPEED) * dt;
        if (step >= remaining) {
          marker.progress = layout.pitEntryProgress;
          startPitRoute(marker, entryRoute(target), 'entering', nowMs);
        } else {
          marker.progress = normalizeProgress(marker.progress + step);
        }
      } else {
        marker.progress = normalizeProgress(marker.progress + displaySpeed * dt);
      }
    }

    if (marker.phase === 'racing' || marker.phase === 'approaching') {
      const point = pointAt(marker.progress ?? 0, layout.line, layout.lengths);
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

  /** Pit box → pit exit. The control point sits back along the lane's own
   *  direction, so the car sweeps out parallel to the pit straight before
   *  rejoining rather than cutting straight across it. */
  function exitRoute(from: CircuitPoint): CircuitPoint[] {
    const reach = 44 * ds;
    const control = {
      x: layout.pitExit.x - Math.cos(layout.laneFrame.angle) * reach,
      y: layout.pitExit.y - Math.sin(layout.laneFrame.angle) * reach,
    };
    return [from, ...sampleQuadratic(from, control, layout.pitExit)];
  }

  /** Pit entry → pit box, mirroring exitRoute. */
  function entryRoute(target: CircuitPoint): CircuitPoint[] {
    const reach = 44 * ds;
    const control = {
      x: layout.pitEntry.x + Math.cos(layout.laneFrame.angle) * reach,
      y: layout.pitEntry.y + Math.sin(layout.laneFrame.angle) * reach,
    };
    return [layout.pitEntry, ...sampleQuadratic(layout.pitEntry, control, target)];
  }

  // MARK: - Marker drawing

  function drawSafetyCar(progress: number | null, elapsed: number): void {
    const point = progress === null
      ? { x: layout.laneFrame.originX, y: layout.laneFrame.originY }
      : pointAt(
          (progress + elapsed * SAFETY_CAR_DISPLAY_SPEED) % 1,
          layout.line,
          layout.lengths,
        );
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.beginPath();
    ctx.roundRect(-16, -10, 32, 20, 5);
    ctx.fillStyle = palette.flagYellow;
    ctx.fill();
    ctx.strokeStyle = palette.canvas;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = palette.canvas;
    ctx.font = `900 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SC', 0, 0.5);
    ctx.restore();
  }

  function drawMarker(
    ctx: CanvasRenderingContext2D, entry: EntryPresentation,
    x: number, y: number, nowMs: number,
  ): void {
    const color = teamColor(entry.colorToken, sync?.circuitID !== undefined);
    ctx.save();
    ctx.translate(x, y);

    // Focus brackets: four broadcast-style corners outside every other ring.
    if (entry.isFocused) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      const r = radius() + 7;
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
    if (entry.placement.kind === 'nextGrid') {
      ring(ctx, radius() + 3.5, palette.textMuted, 1);
    } else {
      switch (entry.status) {
        case 'working':
          ring(ctx, radius() + 3.5, 'rgba(255,255,255,0.85)', 1.5);
          break;
        case 'idle':
          ring(ctx, radius() + 3.5, palette.statusPit, 1.5);
          break;
        case 'done':
          ring(ctx, radius() + 3.5, 'rgba(51,51,51,1)', 3);
          ctx.setLineDash([4, 4]);
          ring(ctx, radius() + 3.5, '#FFFFFF', 3);
          ctx.setLineDash([]);
          break;
        case 'blocked': {
          // Flash: 0.4 s fade out / 0.4 s fade in, like the SKAction loop.
          const alpha = prefersReducedMotion()
            ? 1
            : 0.25 + 0.75 * Math.abs(Math.sin((Math.PI * nowMs) / FLAG_FLASH_PERIOD));
          ctx.globalAlpha = alpha;
          // A car stopped out on the circuit is the one under the yellow flag,
          // and flashes in the marshals' colour to say so. One that stopped in
          // its pit box keeps the red incident ring: nothing is being neutralized
          // for it, so borrowing the flag colour would misreport the track.
          ring(
            ctx, radius() + 3.5,
            entry.causesYellowFlag ? palette.flagYellow : palette.liveRed, 2,
          );
          ctx.globalAlpha = 1;
          // A second, wider halo makes the car that caused the flag findable at a
          // glance on a full grid, where one flashing ring among twenty discs is
          // easy to miss.
          if (entry.causesYellowFlag) {
            ctx.globalAlpha = alpha * 0.5;
            ring(ctx, radius() + 7.5, palette.flagYellow, 1.5);
            ctx.globalAlpha = 1;
          }
          break;
        }
      }
    }

    // Team disc with fixed contrast number.
    ctx.beginPath();
    ctx.arc(0, 0, radius(), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.canvas;
    ctx.stroke();

    // Pattern outline for post-palette teams.
    if (entry.colorToken.kind === 'pattern') {
      const dashes = [[3, 3], [7, 3], []][entry.colorToken.slot % 3];
      ctx.setLineDash(dashes);
      ring(ctx, radius() + 1, '#FFFFFF', 1.2);
      ctx.setLineDash([]);
    }

    ctx.fillStyle = contrastText(color);
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(entry.carNumber), 0, 0.5);

    // Tags below/above the disc.
    ctx.font = `800 7px ${FONT}`;
    ctx.textBaseline = 'top';
    if (entry.placement.kind === 'nextGrid') {
      ctx.fillStyle = palette.textMuted;
      ctx.fillText('NEXT GRID', 0, radius() + 6);
    } else if (
      (entry.status === 'idle' && entry.placement.kind === 'pit') ||
      (entry.pitState !== 'none' && entry.pitState !== 'racing')
    ) {
      ctx.fillStyle = palette.statusPit;
      ctx.fillText(entry.pitState === 'pitting' ? 'PITTING' : 'PIT', 0, radius() + 6);
    }
    if (entry.showsNewStint) {
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'bottom';
      ctx.fillText('NEW STINT', 0, -radius() - 9);
    }

    // Incident: warning triangle up-right + restrained smoke.
    if (entry.placement.kind !== 'nextGrid' && entry.status === 'blocked') {
      ctx.save();
      ctx.translate(radius() + 2, -radius() - 2);
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
        y: -radius(),
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
    const signature = `${layout.circuit.id}|${canvas.width}x${canvas.height}|${teamIDs.join(',')}`;
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
    // Asphalt width. The default suits the stylized circuit, whose legs never
    // run close together; a layout traced to real proportions needs a narrower
    // ribbon, or stretches that are genuinely adjacent merge into one road.
    trackWidth = (layout.circuit.trackWidth ?? 22) * ds;
    const pitWidth = trackWidth / 2;

    // Fixed technical grid behind the circuit.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= SCENE_W; x += 24) { ctx.moveTo(x, -offsetY / sceneScale); ctx.lineTo(x, SCENE_H + offsetY / sceneScale); }
    for (let y = 0; y <= SCENE_H; y += 24) { ctx.moveTo(-offsetX / sceneScale, y); ctx.lineTo(SCENE_W + offsetX / sceneScale, y); }
    ctx.stroke();

    const circuit = circuitPath();
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

  /** The circuit centerline as a closed path. Shared by the baked asphalt and
   *  the live yellow-flag edge, so the two always trace the same ribbon. */
  function circuitPath(): Path2D {
    const path = new Path2D();
    layout.line.forEach((point, index) => (
      index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)
    ));
    path.closePath();
    return path;
  }

  /** Flashing yellow track limits, drawn over the baked asphalt while the
   *  marshals have the yellow flag out.
   *
   *  Only the edge is repainted, not the asphalt: the surface stays dark, so the
   *  car markers keep the contrast they were designed against and the track
   *  still reads as a track. It has to be a live-layer draw rather than part of
   *  the cached static canvas, because that canvas is rebuilt only when the
   *  circuit or the team list changes — never per frame. */
  function drawYellowFlagEdge(ctx: CanvasRenderingContext2D, nowMs: number): void {
    // Same 0.8 s loop as the blocked marker ring, so the whole yellow-flag
    // treatment pulses as one thing. A viewer who asked for reduced motion gets
    // the edge held at full strength: the flag is safety information, so it is
    // the flashing that is dropped, not the signal.
    const alpha = prefersReducedMotion()
      ? 1
      : 0.3 + 0.7 * Math.abs(Math.sin((Math.PI * nowMs) / FLAG_FLASH_PERIOD));
    const path = circuitPath();
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // A soft outer bloom under a hard edge: the glow carries at a glance across
    // the whole circuit, the crisp line keeps the track limits legible.
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = palette.flagYellow;
    ctx.lineWidth = trackWidth + 10;
    ctx.stroke(path);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.restore();
  }

  /** Asphalt of the pit lane itself: a curve off the circuit at pit entry, a
   *  straight run past the bays, and a curve back on at pit exit. The straight
   *  section is expressed in the lane's own rotated frame so it stays parallel
   *  to the pit straight whatever angle that runs at. */
  function pitGuidePath(): Path2D {
    const ds = designScale;
    const reach = 46 * ds;
    const { pitEntry, pitExit, entryTangent, exitTangent, pitLaneRect, laneFrame } = layout;
    const half = pitLaneRect.width / 2;
    const cos = Math.cos(laneFrame.angle);
    const sin = Math.sin(laneFrame.angle);
    const local = (lx: number, ly: number): [number, number] => [
      laneFrame.originX + lx * cos - ly * sin,
      laneFrame.originY + lx * sin + ly * cos,
    ];
    const [startX, startY] = local(-half, 0);
    const [endX, endY] = local(half, 0);
    const [leadX, leadY] = local(-half - 40 * ds, 0);
    const [trailX, trailY] = local(half + 40 * ds, 0);
    const path = new Path2D();
    path.moveTo(pitEntry.x, pitEntry.y);
    path.bezierCurveTo(
      pitEntry.x + entryTangent.dx * reach, pitEntry.y + entryTangent.dy * reach,
      leadX, leadY,
      startX, startY,
    );
    path.lineTo(endX, endY);
    path.bezierCurveTo(
      trailX, trailY,
      pitExit.x - exitTangent.dx * reach, pitExit.y - exitTangent.dy * reach,
      pitExit.x, pitExit.y,
    );
    return path;
  }

  /** Chequered start/finish line, drawn just past pit exit.
   *
   *  Not at progress 0: that is wherever the circuit's point list happens to
   *  begin, which for a traced layout can be halfway round the lap and nowhere
   *  near the pits. A real start line sits on the pit straight, so it is placed
   *  a short way after pit exit — which also matches where cars rejoin. */
  function drawStartFinish(ctx: CanvasRenderingContext2D, trackWidth: number): void {
    const start = pointAt(layout.startFinishProgress, layout.line, layout.lengths);
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
    const rect = layout.pitLaneRect;
    const frame = layout.laneFrame;
    // Draw the lane in its own frame, rotated onto the pit straight. Lane-local
    // coordinates are centred on the box, so a horizontal straight (angle 0)
    // reproduces the original axis-aligned layout exactly.
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    const localY = -halfHeight;
    // Maps a lane-local point back to scene space, for the pit-box positions the
    // marker code needs.
    const toScene = (lx: number, ly: number): CircuitPoint => ({
      x: frame.originX + lx * Math.cos(frame.angle) - ly * Math.sin(frame.angle),
      y: frame.originY + lx * Math.sin(frame.angle) + ly * Math.cos(frame.angle),
    });

    ctx.save();
    ctx.translate(frame.originX, frame.originY);
    ctx.rotate(frame.angle);

    ctx.fillStyle = hexAlpha(palette.card, 0.72);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    roundedRect(ctx, -halfWidth, localY, rect.width, rect.height, 2 * ds);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // The lane sits on one side of the pit straight; "PIT LANE" goes on its far
    // side, in open space. Drawn upright in scene space rather than rotated with
    // the box: a rotated caption crosses the bays on an angled lane, which is
    // exactly where the parked cars are. Clearing the box means clearing its
    // furthest corner, not its centre — on a rotated box the two differ by the
    // half-length of the lane projected onto y.
    const laneSideY = Math.sign(frame.originY - layout.trackY) || -1;
    // Whether travel runs left-to-right on screen. Lane text is rotated onto the
    // straight, so a leftward straight gets a half-turn to stay right side up.
    const runsRight = layout.pitExit.x >= layout.pitEntry.x;
    const boxReachY = Math.abs(halfWidth * Math.sin(frame.angle))
      + Math.abs(halfHeight * Math.cos(frame.angle));
    ctx.textAlign = 'center';
    ctx.textBaseline = laneSideY < 0 ? 'bottom' : 'top';
    ctx.font = `700 8px ${FONT}`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(
      'PIT LANE',
      frame.originX,
      frame.originY + laneSideY * (boxReachY + 6 * ds),
    );

    // Entry/exit captions label the points where the lane meets the circuit,
    // not the ends of the lane box: the box is narrower than the two captions
    // laid side by side, so anchoring them to it makes them collide. Both arrows
    // point along the direction of travel — cars always run entry to exit —
    // rather than facing each other across the lane. They go on the opposite
    // side from the lane, so they clear the bays.
    //
    // Circuits whose pit straight is short and steep can opt out: there the
    // junctions sit close together against a corner, and no placement reads
    // cleanly. The lane itself, its bays, and PIT LANE still identify it.
    if (!layout.circuit.hidePitCaptions) {
      const captionShift = -laneSideY * 15 * ds;
      // Captions are rotated onto the straight so they lie along it, flipped a
      // half turn when it runs leftward so the text stays right side up. The
      // chevron then has to be mirrored too: after that flip, a "›››" glyph
      // points back against the direction of travel.
      const captionAngle = frame.angle + (runsRight ? 0 : Math.PI);
      const arrow = runsRight ? '›››' : '‹‹‹';
      const drawCaption = (text: string, at: CircuitPoint, alignOut: 'left' | 'right'): void => {
        ctx.save();
        ctx.translate(at.x, at.y + captionShift);
        ctx.rotate(captionAngle);
        ctx.textAlign = alignOut;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, alignOut === 'right' ? -6 * ds : 6 * ds, 0);
        ctx.restore();
      };
      ctx.font = `600 7px ${FONT}`;
      ctx.fillStyle = palette.textMuted;
      // Each caption sits outboard of its own junction, pointing along the lap.
      drawCaption(`PIT ENTRY  ${arrow}`, layout.pitEntry, 'right');
      drawCaption(`${arrow}  PIT EXIT`, layout.pitExit, 'left');
    }

    ctx.save();
    ctx.translate(frame.originX, frame.originY);
    ctx.rotate(frame.angle);

    // One bay per team, sorted by stable team ID.
    pitBoxes = new Map();
    const teams = sync.teams.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const inset = 6 * ds;
    const usable = rect.width - inset * 2;
    teams.forEach((team, index) => {
      const fraction = (index + 0.5) / Math.max(teams.length, 1);
      const localX = -halfWidth + inset + fraction * usable;
      const centerY = -2 * ds;
      const slotWidth = usable / Math.max(teams.length, 1);
      const bayWidth = Math.max(14 * ds, slotWidth - 4 * ds);

      ctx.fillStyle = hexAlpha(palette.canvas, 0.78);
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 1;
      roundedRect(ctx, localX - bayWidth / 2, centerY - 15 * ds, bayWidth, 30 * ds, 3 * ds);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = teamColor(team.colorToken, sync.circuitID !== undefined);
      roundedRect(
        ctx, localX - (bayWidth - 4 * ds) / 2, centerY - 12 * ds - 1.5 * ds,
        bayWidth - 4 * ds, 3 * ds, 1,
      );
      ctx.fill();

      // Bay number turns with the lane, but flipped a half turn when the lane
      // runs leftward so the digits never read upside-down.
      ctx.save();
      ctx.translate(localX, centerY + 13 * ds);
      if (!runsRight) ctx.rotate(Math.PI);
      ctx.fillStyle = palette.textMuted;
      ctx.font = `700 5px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(index + 1).padStart(2, '0'), 0, 0);
      ctx.restore();

      pitBoxes.set(team.id, toScene(localX, centerY));
    });
    ctx.restore();
  }

  return { setSync, resize, frame, setCircuit, currentCircuitID };
}

// MARK: - Drawing helpers

/** Placements that park beside the pit lane and cascade per team (mirrors the
 *  Swift RaceTrackScene.isPitPlacement). */
function isPitPlacement(entry: EntryPresentation): boolean {
  const kind = entry.placement.kind;
  return kind === 'pit' || kind === 'incidentPit' || kind === 'nextGrid';
}

/** Whether the viewer has asked for reduced motion. Queried per frame rather
 *  than cached, so toggling the OS setting takes effect without a reload. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
