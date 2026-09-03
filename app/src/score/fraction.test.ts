import { describe, expect, it } from 'vitest';

import {
  add,
  cmp,
  div,
  durationOf,
  eq,
  formatFraction,
  frac,
  isZero,
  meterLength,
  mul,
  sub,
  sum,
  toNumber,
  ZERO,
} from './fraction';

describe('frac', () => {
  it('reduces on construction', () => {
    expect(frac(6, 8)).toEqual({ num: 3, den: 4 });
    expect(frac(8, 4)).toEqual({ num: 2, den: 1 });
    expect(frac(0, 7)).toEqual({ num: 0, den: 1 });
  });

  it('keeps the sign on the numerator so den > 0 always holds', () => {
    expect(frac(1, -2)).toEqual({ num: -1, den: 2 });
    expect(frac(-1, -2)).toEqual({ num: 1, den: 2 });
  });

  it('rejects non-integers and a zero denominator', () => {
    expect(() => frac(1.5, 2)).toThrow();
    expect(() => frac(1, 0)).toThrow();
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(add(frac(1, 3), frac(1, 6))).toEqual({ num: 1, den: 2 });
    expect(sub(frac(1, 2), frac(1, 3))).toEqual({ num: 1, den: 6 });
  });

  it('sums three triplet eighths to exactly one quarter', () => {
    // 0.1 + 0.2 !== 0.3 in floats; three thirds of a quarter must be one quarter.
    const third = frac(1, 3);
    expect(sum([third, third, third])).toEqual({ num: 1, den: 1 });
  });

  it('sums a bar of 5:4 sixteenths back to the beat', () => {
    const fifth = mul(frac(1, 4), frac(4, 5));
    expect(sum([fifth, fifth, fifth, fifth, fifth])).toEqual({ num: 1, den: 1 });
  });

  it('multiplies and divides', () => {
    expect(mul(frac(2, 3), frac(3, 4))).toEqual({ num: 1, den: 2 });
    expect(div(frac(1, 2), frac(1, 4))).toEqual({ num: 2, den: 1 });
    expect(() => div(frac(1, 2), ZERO)).toThrow();
  });

  it('compares by cross-multiplication, including negatives', () => {
    expect(cmp(frac(1, 3), frac(1, 2))).toBe(-1);
    expect(cmp(frac(2, 4), frac(1, 2))).toBe(0);
    expect(cmp(frac(-1, 3), frac(-1, 2))).toBe(1);
    expect(eq(frac(6, 8), frac(3, 4))).toBe(true);
    expect(isZero(sub(frac(1, 3), frac(2, 6)))).toBe(true);
  });

  it('formats for messages', () => {
    expect(formatFraction(frac(4, 1))).toBe('4');
    expect(formatFraction(frac(7, 2))).toBe('7/2');
  });

  it('converts to float only when asked', () => {
    expect(toNumber(frac(1, 3))).toBeCloseTo(0.333333333, 9);
  });
});

describe('durationOf', () => {
  it('measures plain durations in quarter notes', () => {
    expect(durationOf({ base: 1, dots: 0 })).toEqual({ num: 4, den: 1 });
    expect(durationOf({ base: 2, dots: 0 })).toEqual({ num: 2, den: 1 });
    expect(durationOf({ base: 4, dots: 0 })).toEqual({ num: 1, den: 1 });
    expect(durationOf({ base: 8, dots: 0 })).toEqual({ num: 1, den: 2 });
    expect(durationOf({ base: 32, dots: 0 })).toEqual({ num: 1, den: 8 });
  });

  it('applies the dot factor (2 − 2^−dots)', () => {
    expect(durationOf({ base: 4, dots: 1 })).toEqual({ num: 3, den: 2 });
    expect(durationOf({ base: 4, dots: 2 })).toEqual({ num: 7, den: 4 });
    expect(durationOf({ base: 2, dots: 1 })).toEqual({ num: 3, den: 1 });
    expect(durationOf({ base: 16, dots: 2 })).toEqual({ num: 7, den: 16 });
  });

  it('scales by numbase/num inside a tuplet', () => {
    const t = { num: 3, numbase: 2 };
    expect(durationOf({ base: 8, dots: 0 }, t)).toEqual({ num: 1, den: 3 });
    const three = sum([
      durationOf({ base: 8, dots: 0 }, t),
      durationOf({ base: 8, dots: 0 }, t),
      durationOf({ base: 8, dots: 0 }, t),
    ]);
    expect(three).toEqual({ num: 1, den: 1 });
  });

  it('times the uneven ♪ ♬ ♪ triplet to exactly one quarter', () => {
    const t = { num: 3, numbase: 2 };
    expect(
      sum([
        durationOf({ base: 8, dots: 0 }, t),
        durationOf({ base: 16, dots: 0 }, t),
        durationOf({ base: 16, dots: 0 }, t),
        durationOf({ base: 8, dots: 0 }, t),
      ]),
    ).toEqual({ num: 1, den: 1 });
  });
});

describe('meterLength', () => {
  it('is count × 4/unit quarter notes', () => {
    expect(meterLength({ count: 4, unit: 4 })).toEqual({ num: 4, den: 1 });
    expect(meterLength({ count: 6, unit: 8 })).toEqual({ num: 3, den: 1 });
    expect(meterLength({ count: 2, unit: 2 })).toEqual({ num: 4, den: 1 });
    expect(meterLength({ count: 5, unit: 8 })).toEqual({ num: 5, den: 2 });
    expect(meterLength({ count: 7, unit: 8 })).toEqual({ num: 7, den: 2 });
  });
});
