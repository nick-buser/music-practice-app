import { describe, expect, it } from 'vitest';

import { parseCells } from '../../data/raga/composition';
import { buildTimeline } from './playback';

describe('buildTimeline', () => {
  it('places one tone per matra at the swara frequency', () => {
    const tl = buildTimeline(parseCells('S R'), 60, 100);
    expect(tl.totalDur).toBe(2);
    expect(tl.events).toHaveLength(2);
    expect(tl.events[0]).toMatchObject({ index: 0, offset: 0 });
    expect(tl.events[0].tones[0].hz).toBeCloseTo(100, 5);
    expect(tl.events[0].tones[0].dur).toBe(1);
    // shuddha Re is 2 semitones above Sa.
    expect(tl.events[1].tones[0].hz).toBeCloseTo(100 * 2 ** (2 / 12), 5);
  });

  it('rings a swara on through following sustains', () => {
    const tl = buildTimeline(parseCells('S - R'), 60, 100);
    expect(tl.events[0].tones[0].dur).toBe(2); // held over the sustain
    expect(tl.events[1].tones).toEqual([]); // the sustain itself is silent
    expect(tl.events[2].tones[0].dur).toBe(1);
  });

  it('emits no tone for a rest', () => {
    const tl = buildTimeline(parseCells('S ~'), 60, 100);
    expect(tl.events[1].tones).toEqual([]);
  });

  it('splits a subdivided matra evenly', () => {
    const tl = buildTimeline(parseCells('S,R'), 60, 100);
    expect(tl.events[0].tones).toHaveLength(2);
    expect(tl.events[0].tones[0]).toMatchObject({ offset: 0, dur: 0.5 });
    expect(tl.events[0].tones[1]).toMatchObject({ offset: 0.5, dur: 0.5 });
  });

  it('scales durations with tempo', () => {
    const tl = buildTimeline(parseCells('S'), 120, 220);
    expect(tl.events[0].tones[0].dur).toBe(0.5);
  });
});
