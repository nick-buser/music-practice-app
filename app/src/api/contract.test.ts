import { expect, test } from 'vitest';

import type { ChordIdentity } from '../data/chord-identity';
import type { components } from './schema';

/**
 * Compile-time contract guard (enforced by `tsc -b`): the hand-authored
 * frontend `ChordIdentity` must stay assignable to the generated contract
 * shape. If the two drift, `Assignable` resolves to `false` and the `= true`
 * assignment below stops type-checking — surfacing the mismatch at build time.
 */
type Assignable<A, B> = A extends B ? true : false;

const identityMatchesContract: Assignable<
  ChordIdentity,
  components['schemas']['ChordIdentity']
> = true;

test('frontend ChordIdentity conforms to the generated OpenAPI contract', () => {
  expect(identityMatchesContract).toBe(true);
});
