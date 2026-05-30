import { describe, expect, it } from 'vitest';
import { heatColor, parseRange } from './heatmap';

describe('parseRange', () => {
  it('parses "mm. 1–8" with an en dash', () => {
    expect(parseRange('mm. 1–8')).toEqual([1, 8]);
  });

  it('parses "mm. 1-8" with an ASCII hyphen', () => {
    expect(parseRange('mm. 1-8')).toEqual([1, 8]);
  });

  it('parses a bare numeric range', () => {
    expect(parseRange('17–24')).toEqual([17, 24]);
  });

  it('returns a single-measure range when only one number is present', () => {
    expect(parseRange('mm. 5')).toEqual([5, 5]);
  });

  it('handles multi-digit measure numbers', () => {
    expect(parseRange('mm. 100–127')).toEqual([100, 127]);
  });

  it('returns null for strings without any number', () => {
    expect(parseRange('the cadenza')).toBeNull();
    expect(parseRange('')).toBeNull();
  });
});

describe('heatColor', () => {
  it('returns lumen (mint) when comfortable', () => {
    expect(heatColor(1)).toBe('var(--lumen)');
    expect(heatColor(0.8)).toBe('var(--lumen)');
  });

  it('returns krill (amber) in the middle band', () => {
    expect(heatColor(0.5)).toBe('var(--krill)');
    expect(heatColor(0.4)).toBe('var(--krill)');
  });

  it('returns coral (red) when struggling', () => {
    expect(heatColor(0.1)).toBe('var(--coral)');
    expect(heatColor(0)).toBe('var(--coral)');
  });

  it('keeps the boundaries on the cooler side', () => {
    // 0.65 → still krill, only > 0.65 lights to lumen
    expect(heatColor(0.65)).toBe('var(--krill)');
    expect(heatColor(0.66)).toBe('var(--lumen)');
    // 0.32 → still coral
    expect(heatColor(0.32)).toBe('var(--coral)');
    expect(heatColor(0.33)).toBe('var(--krill)');
  });
});
