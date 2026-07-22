import { createHash } from 'node:crypto';
import type { FixtureName } from './fixtures.js';

export type InstanceTarget =
  | { kind: 'herdr'; socketPath: string }
  | { kind: 'fixture'; name: FixtureName };

export function instanceKey(target: InstanceTarget): string {
  const identity = target.kind === 'herdr'
    ? `herdr:${target.socketPath}`
    : `fixture:${target.name}`;
  return createHash('sha256').update(identity).digest('hex').slice(0, 16);
}

export function targetLabel(target: InstanceTarget): string {
  return target.kind === 'herdr' ? target.socketPath : `fixture:${target.name}`;
}
