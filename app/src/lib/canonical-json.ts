/**
 * RFC 8785 (JSON Canonicalization Scheme) plus the ScoreDoc content hash.
 *
 * Why a canonical form at all: `scoreDocHash` is what every provenance run
 * names in `input_sha256s`, and the generator mints a score's UUID from
 * `uuid5(SOUNDINGS_NS, 'soundings:score:' + canonicalJson(meta.recipe))`
 * (`docs/score-substrate.md` §Identity). Both are cross-machine identities, so
 * "the same document" has to serialize to the same bytes on any engine —
 * `JSON.stringify` does not promise that, because its property order is
 * insertion order.
 *
 * JCS in full is: object keys sorted by their UTF-16 code units, no
 * whitespace, `undefined`-valued members omitted, strings escaped by the
 * shortest legal form, and numbers printed by ECMAScript's own
 * Number-to-String — which `JSON.stringify(n)` already implements, including
 * the exponent forms for very large and very small magnitudes. So the number
 * rule here is a delegation, not a reimplementation; the sorting and escaping
 * are ours.
 */

/** Values JCS can canonicalize. `undefined` members are dropped, as in JSON. */
export type JsonInput = unknown;

const ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/**
 * JCS string escaping: the seven two-character escapes, `\u00xx` for the rest
 * of C0, and every other code unit literal — lone surrogates included, which
 * is why this walks code units rather than code points.
 */
function serializeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const esc = ESCAPES[ch];
    if (esc) {
      out += esc;
    } else if (ch < ' ') {
      out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`canonicalJson: ${n} is not representable in JSON`);
  // -0 serializes as 0 per JCS (ECMAScript Number-to-String of -0 is "0").
  return JSON.stringify(n) as string;
}

/** JCS sorts object keys by UTF-16 code unit, which is exactly `<` on strings. */
function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function serialize(value: unknown): string | undefined {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return serializeNumber(value as number);
  if (t === 'string') return serializeString(value as string);
  if (t === 'undefined' || t === 'function' || t === 'symbol') return undefined;
  if (t === 'bigint') throw new Error('canonicalJson: bigint is not representable in JSON');
  if (Array.isArray(value)) {
    // Array holes and undefined members become null, as in JSON.stringify.
    return `[${value.map((v) => serialize(v) ?? 'null').join(',')}]`;
  }
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return serialize((value as { toJSON: () => unknown }).toJSON());
  }
  const obj = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of sortKeys(Object.keys(obj))) {
    const v = serialize(obj[k]);
    if (v !== undefined) parts.push(`${serializeString(k)}:${v}`);
  }
  return `{${parts.join(',')}}`;
}

/** Synchronous, dependency-free JCS. Throws on values JSON cannot represent. */
export function canonicalJson(value: JsonInput): string {
  const out = serialize(value);
  if (out === undefined) throw new Error('canonicalJson: top-level value is not representable in JSON');
  return out;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 of the canonical JSON of the document **without `revision`**.
 *
 * `revision` is bumped by every persisted command batch, so including it would
 * make the hash a version counter rather than a content identity — and the
 * whole point is that two rows holding the same music hash the same, which is
 * what `meta.derivedFrom.hash` and `input_sha256s` mean. `crypto.subtle` is in
 * browsers and Node ≥ 20, so this stays dependency-free.
 */
export async function scoreDocHash(doc: { revision?: number }): Promise<string> {
  const { revision: _revision, ...rest } = doc as Record<string, unknown> & { revision?: number };
  const bytes = new TextEncoder().encode(canonicalJson(rest));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
}
