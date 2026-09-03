/**
 * Read-time blob migration.
 *
 * §Persistence: "Blobs are upgraded on read, in TS, never by Alembic." Alembic
 * adds columns and indexes; it never rewrites `doc`. The server stores
 * `schema_version` so old rows stay countable and a client-side backfill can
 * page through them, but the upgrade itself is here, because the zod schema is
 * the only thing that knows what a ScoreDoc means.
 *
 * v1 is the current and only version, so the chain is the identity step. It is
 * written as a step table anyway: the first real migration then adds one entry
 * and one fixture instead of inventing the mechanism under time pressure, and
 * `migrateScoreDoc` already refuses a document from the future rather than
 * mangling it.
 */

import { SCORE_SCHEMA_VERSION } from './types';
import type { ScoreDoc } from './types';

/** One `v(n) → v(n+1)` step. Steps take and return untyped blobs by design. */
type MigrationStep = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Indexed by the version being upgraded *from*. `STEPS[1]` would turn a v1 blob
 * into a v2 one; there is no v2 yet, so the table is empty and every v1
 * document passes through untouched.
 */
const STEPS: Record<number, MigrationStep> = {};

export class ScoreDocVersionError extends Error {}

/**
 * Bring a stored blob up to `SCORE_SCHEMA_VERSION`. The result is *not*
 * validated here — callers run `validateScoreDoc` themselves, because a
 * migration failing and a document being invalid are different problems with
 * different remedies.
 */
export function migrateScoreDoc(input: unknown): ScoreDoc {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ScoreDocVersionError('migrateScoreDoc: not an object');
  }
  let doc = { ...(input as Record<string, unknown>) };
  const version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ScoreDocVersionError(`migrateScoreDoc: missing or invalid schemaVersion ${String(version)}`);
  }
  if (version > SCORE_SCHEMA_VERSION) {
    throw new ScoreDocVersionError(
      `migrateScoreDoc: schemaVersion ${version} is newer than this client understands (${SCORE_SCHEMA_VERSION})`,
    );
  }
  for (let v = version; v < SCORE_SCHEMA_VERSION; v += 1) {
    const step = STEPS[v];
    if (!step) throw new ScoreDocVersionError(`migrateScoreDoc: no step from schemaVersion ${v}`);
    doc = step(doc);
    doc.schemaVersion = v + 1;
  }
  return doc as unknown as ScoreDoc;
}
