// @vitest-environment node
// Node, not jsdom: `scoreDocHash` goes through `crypto.subtle`, which jsdom
// does not provide. The module itself runs unchanged in the browser.
import { describe, expect, it } from 'vitest';

import { canonicalJson, scoreDocHash } from './canonical-json';
import { grandStaffExercise } from '../score/__fixtures__';

describe('canonicalJson — RFC 8785', () => {
  it('reproduces the worked example from §3.2.3', () => {
    // The input string is built from code points so the test does not depend on
    // this file's own escaping: € $ U+000F LF A ' B " \ \ " /
    const cp = (n: number): string => String.fromCharCode(n);
    const string = ['€', '$', cp(0x0f), cp(0x0a), 'A', "'", 'B', '"', '\\', '\\', '"', '/'].join('');
    const input = {
      numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
      string,
      literals: [null, true, false],
    };
    expect(canonicalJson(input)).toBe(
      '{"literals":[null,true,false],' +
        '"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        '"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('serializes numbers by ECMAScript Number-to-String', () => {
    expect(canonicalJson(0)).toBe('0');
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(1e30)).toBe('1e+30');
    expect(canonicalJson(4.5)).toBe('4.5');
    expect(canonicalJson(2e-3)).toBe('0.002');
    expect(canonicalJson(1e-27)).toBe('1e-27');
    expect(canonicalJson(5e-324)).toBe('5e-324');
    expect(canonicalJson(9007199254740992)).toBe('9007199254740992');
    expect(canonicalJson(Number.MAX_VALUE)).toBe('1.7976931348623157e+308');
    expect(canonicalJson(-1.5)).toBe('-1.5');
  });

  it('rejects values JSON cannot represent', () => {
    expect(() => canonicalJson(NaN)).toThrow();
    expect(() => canonicalJson(Infinity)).toThrow();
    expect(() => canonicalJson(1n)).toThrow();
    expect(() => canonicalJson(undefined)).toThrow();
  });

  it('sorts object keys by UTF-16 code unit, not by locale or insertion order', () => {
    // "\n" (10) < "\r" (13) < "1" (49) < "a" (97) < "" (128)
    // < "ö" (246) < "€" (0x20AC) < "☃" (0x2603) < "😀" (first unit 0xD83D).
    const input: Record<string, number> = {};
    for (const k of ['😀', '☃', '€', 'ö', String.fromCharCode(0x80), 'a', '1', '\r', '\n']) input[k] = 1;
    const keys = [...canonicalJson(input).matchAll(/"((?:[^"\\]|\\.)*)":/g)].map((m) => m[1]);
    expect(keys).toEqual(['\\n', '\\r', '1', 'a', String.fromCharCode(0x80), 'ö', '€', '☃', '😀']);
  });

  it('sorts nested objects too, and is stable under key reordering', () => {
    const a = { b: { z: 1, a: 2 }, a: [{ y: 1, x: 2 }] };
    const b = { a: [{ x: 2, y: 1 }], b: { a: 2, z: 1 } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":[{"x":2,"y":1}],"b":{"a":2,"z":1}}');
  });

  it('omits undefined members and writes no whitespace', () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
    expect(canonicalJson({ a: [1, undefined, 2] })).toBe('{"a":[1,null,2]}');
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson([])).toBe('[]');
  });

  it('escapes exactly the seven short escapes plus C0', () => {
    expect(canonicalJson('\b\f\n\r\t"\\')).toBe('"\\b\\f\\n\\r\\t\\"\\\\"');
    expect(canonicalJson(String.fromCharCode(0x00, 0x1f))).toBe('"\\u0000\\u001f"');
    // DEL and everything above it stay literal.
    expect(canonicalJson(String.fromCharCode(0x7f))).toBe(`"${String.fromCharCode(0x7f)}"`);
  });
});

describe('scoreDocHash', () => {
  it('is a 64-character lowercase hex SHA-256', async () => {
    const hash = await scoreDocHash(grandStaffExercise());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the SHA-256 of the canonical JSON without `revision`', async () => {
    const doc = grandStaffExercise();
    const { revision: _revision, ...rest } = doc;
    const bytes = new TextEncoder().encode(canonicalJson(rest));
    const expected = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(await scoreDocHash(doc)).toBe(expected);
  });

  it('ignores `revision`', async () => {
    const a = grandStaffExercise();
    const b = { ...grandStaffExercise(), revision: 47 };
    expect(await scoreDocHash(a)).toBe(await scoreDocHash(b));
  });

  it('changes when the music changes', async () => {
    const a = grandStaffExercise();
    const b = grandStaffExercise();
    b.tempo = { ...b.tempo, bpm: 97 };
    expect(await scoreDocHash(a)).not.toBe(await scoreDocHash(b));
  });
});
