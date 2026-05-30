import { describe, expect, it } from 'vitest';
import { beatsPerBar, relTime } from './time';

describe('relTime', () => {
  const today = new Date('2026-05-19');

  it('returns "today" for the anchor date', () => {
    expect(relTime('2026-05-19', today)).toBe('today');
  });

  it('returns "yesterday" for one day prior', () => {
    expect(relTime('2026-05-18', today)).toBe('yesterday');
  });

  it('returns N days for a span within a week', () => {
    expect(relTime('2026-05-15', today)).toBe('4 days ago');
  });

  it('returns weeks for a span up to a month', () => {
    expect(relTime('2026-05-01', today)).toBe('2 wk ago');
  });

  it('returns months for spans longer than a month', () => {
    expect(relTime('2026-02-01', today)).toBe('3 mo ago');
  });
});

describe('beatsPerBar', () => {
  it('groups compound meters into dotted pulses', () => {
    expect(beatsPerBar('12/8')).toBe(4);
    expect(beatsPerBar('9/8')).toBe(3);
    expect(beatsPerBar('6/8')).toBe(2);
  });

  it('returns the numerator for simple meters', () => {
    expect(beatsPerBar('4/4')).toBe(4);
    expect(beatsPerBar('3/4')).toBe(3);
    expect(beatsPerBar('2/2')).toBe(2);
  });

  it('treats x/8 that is not divisible by 3 as simple', () => {
    expect(beatsPerBar('5/8')).toBe(5);
    expect(beatsPerBar('7/8')).toBe(7);
  });

  it('falls back to 4 for unparseable meters', () => {
    expect(beatsPerBar('free')).toBe(4);
    expect(beatsPerBar('')).toBe(4);
  });
});
