/**
 * Generate src/api/schema.d.ts from backend/openapi.json.
 *
 * `generate()` is the single code path used by both `npm run gen:api` (writes
 * the file) and the drift test (compares against the committed file), so they
 * can never disagree on formatting.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
export const OPENAPI_PATH = resolve(here, '../../backend/openapi.json');
export const OUTPUT_PATH = resolve(here, '../src/api/schema.d.ts');

const BANNER = `/**
 * AUTO-GENERATED from backend/openapi.json by \`npm run gen:api\` — do not edit.
 * Regenerate when the backend contract changes; src/api/schema.drift.test.ts
 * fails if this file drifts from the committed openapi.json.
 */
`;

export async function generate() {
  const schema = JSON.parse(readFileSync(OPENAPI_PATH, 'utf8'));
  // defaultNonNullable:false → fields with server-side defaults stay OPTIONAL
  // in the generated types, matching what clients actually send (the backend
  // fills defaults). Keeps the frontend ChordIdentity contract-compatible.
  const ast = await openapiTS(schema, { defaultNonNullable: false });
  return BANNER + astToString(ast);
}

// Run directly: `--check` verifies the committed file is in sync (exit 1 on
// drift); otherwise (re)write it.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const expected = await generate();
  if (process.argv.includes('--check')) {
    const actual = readFileSync(OUTPUT_PATH, 'utf8');
    if (actual !== expected) {
      console.error('src/api/schema.d.ts is stale — run `npm run gen:api` and commit it.');
      process.exit(1);
    }
    console.log('API types are in sync with backend/openapi.json.');
  } else {
    writeFileSync(OUTPUT_PATH, expected);
    console.log(`wrote ${OUTPUT_PATH}`);
  }
}
