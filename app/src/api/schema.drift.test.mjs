import { execFileSync } from 'node:child_process';

import { test } from 'vitest';

/**
 * openapi ↔ frontend-types drift guard: regenerate the client types from
 * backend/openapi.json in a subprocess and diff against the committed
 * schema.d.ts. Fails (with "run npm run gen:api") if they've drifted.
 *
 * Plain .mjs so it isn't type-checked by tsc (no Node-types dependency); vitest
 * still collects and runs it.
 */
test('generated API types are in sync with backend/openapi.json', () => {
  execFileSync('node', ['scripts/gen-api-types.mjs', '--check'], { stdio: 'pipe' });
});
