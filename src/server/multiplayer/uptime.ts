/**
 * Rolling uptime over a sliding window (design decision M4) — the momentum
 * behind a car's speed. Power is piecewise constant between reports (no herdr
 * event means no change), so the tracker stores the change points and
 * integrates exactly; no sampling, no decay approximation.
 */
export function createUptimeTracker(windowSeconds: number) {
  /** Change points, oldest first. Power before the first entry is 0. */
  let segments: Array<{ at: number; power: number }> = [];

  /** Records the instantaneous power (0..1) from `now` on. */
  function setPower(now: number, power: number): void {
    const last = segments[segments.length - 1];
    if (last && last.power === power) return;
    if (last && last.at >= now) {
      // Same-instant correction: the latest value wins.
      last.power = power;
      return;
    }
    segments.push({ at: now, power });
  }

  /** Mean power over [now - window, now], in 0..1. */
  function uptime(now: number): number {
    const start = now - windowSeconds;
    prune(start);
    let integral = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const from = Math.max(segments[index].at, start);
      const to = Math.min(index + 1 < segments.length ? segments[index + 1].at : now, now);
      if (to > from) integral += segments[index].power * (to - from);
    }
    return Math.min(1, Math.max(0, integral / windowSeconds));
  }

  /** Drops change points that no longer affect the window, keeping the last
   *  one at or before `start` as the window's boundary value. */
  function prune(start: number): void {
    let firstRelevant = 0;
    while (
      firstRelevant + 1 < segments.length &&
      segments[firstRelevant + 1].at <= start
    ) {
      firstRelevant += 1;
    }
    if (firstRelevant > 0) segments = segments.slice(firstRelevant);
  }

  return { setPower, uptime };
}

export type UptimeTracker = ReturnType<typeof createUptimeTracker>;
