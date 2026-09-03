/**
 * Exact rational arithmetic in quarter-note units.
 *
 * Why not floats: `docs/score-substrate.md` §Rules — "Durations are rational,
 * never floats, in quarter-note units throughout". A triplet eighth is 1/3 of
 * a quarter, and three of them must sum to *exactly* 1 for refinement 2
 * (`voice-overfull` / `voice-underfull`) to mean anything. In binary floating
 * point 3 × (1/3) is 1 but 3 × (2/3 / 2) is not always, and a 5:4 tuplet of
 * dotted sixteenths compounds the error until a full bar reads as 3.9999999996.
 * Verovio would render such a bar happily and shift every later onset (`exp19`),
 * so the schema is the only gate and it has to compare exactly.
 *
 * Every operation reduces, so a `Fraction` has exactly one representation and
 * `canonicalJson` hashes stably (§Rules, canonical JSON).
 */

import type { Duration, Fraction } from './types';

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/**
 * Build a reduced `Fraction`. The sign always lives on `num` so `den > 0`
 * holds for every fraction in the system and `cmp` can cross-multiply without
 * a sign correction.
 */
export function frac(num: number, den = 1): Fraction {
  if (!Number.isInteger(num) || !Number.isInteger(den)) {
    throw new Error(`Fraction needs integers, got ${num}/${den}`);
  }
  if (den === 0) throw new Error('Fraction denominator must be non-zero');
  const sign = den < 0 ? -1 : 1;
  const n = num * sign;
  const d = den * sign;
  const g = gcd(n, d) || 1;
  return { num: n / g, den: d / g };
}

export const ZERO: Fraction = { num: 0, den: 1 };

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.num, a.den * b.den);
}

export function div(a: Fraction, b: Fraction): Fraction {
  if (b.num === 0) throw new Error('Fraction division by zero');
  return frac(a.num * b.den, a.den * b.num);
}

/** −1, 0 or 1. Cross-multiplication is exact for the small integers this model produces. */
export function cmp(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function eq(a: Fraction, b: Fraction): boolean {
  return cmp(a, b) === 0;
}

export function isZero(a: Fraction): boolean {
  return a.num === 0;
}

export function sum(parts: Fraction[]): Fraction {
  return parts.reduce(add, ZERO);
}

/** Lossy on purpose — for comparisons against Verovio's float `qstamp` only. */
export function toNumber(a: Fraction): number {
  return a.num / a.den;
}

export function formatFraction(a: Fraction): string {
  return a.den === 1 ? String(a.num) : `${a.num}/${a.den}`;
}

/**
 * `durationOf(d, tuplet?) = (4/base) × (2 − 2^−dots) × (numbase/num)`, in
 * quarter notes (§Score-time). The dot factor is written as
 * `(2^(dots+1) − 1) / 2^dots` so it stays integral: dots 0 → 1/1, 1 → 3/2,
 * 2 → 7/4.
 */
export function durationOf(
  d: Duration | { base: number; dots: number },
  tuplet?: { num: number; numbase: number },
): Fraction {
  const dotFactor = frac(2 ** (d.dots + 1) - 1, 2 ** d.dots);
  const base = mul(frac(4, d.base), dotFactor);
  return tuplet ? mul(base, frac(tuplet.numbase, tuplet.num)) : base;
}

/** The notated length of one bar of `timeSig`, in quarter notes: `count × 4/unit`. */
export function meterLength(timeSig: { count: number; unit: number }): Fraction {
  return frac(timeSig.count * 4, timeSig.unit);
}
