import { describe, expect, it } from 'vitest';
import { Instrument, Piece, QueueItem, Quote } from './schemas';
import {
  HEATMAP,
  INSTRUMENTS,
  PIECES,
  QUOTES,
  RECENT,
  TIME_BY_PIECE,
  TODAY_QUEUE,
  WEEK,
} from './sounddata';

describe('mock data conforms to schemas', () => {
  it('every instrument parses as Instrument', () => {
    for (const i of INSTRUMENTS) expect(() => Instrument.parse(i)).not.toThrow();
  });

  it('every piece parses as Piece', () => {
    for (const p of PIECES) expect(() => Piece.parse(p)).not.toThrow();
  });

  it('every queue item parses as QueueItem', () => {
    for (const q of TODAY_QUEUE) expect(() => QueueItem.parse(q)).not.toThrow();
  });

  it('every quote parses as Quote', () => {
    for (const q of QUOTES) expect(() => Quote.parse(q)).not.toThrow();
  });

  it('every TODAY_QUEUE.pieceId references a real piece', () => {
    const pieceIds = new Set(PIECES.map((p) => p.id));
    for (const q of TODAY_QUEUE) expect(pieceIds.has(q.pieceId)).toBe(true);
  });
});

describe('HEATMAP', () => {
  it('contains a full 53-week grid (371 days)', () => {
    expect(HEATMAP).toHaveLength(53 * 7);
  });

  it('starts on a Sunday and is in chronological order', () => {
    const first = new Date(HEATMAP[0].date);
    expect(first.getUTCDay()).toBe(0); // 0 = Sunday
    for (let i = 1; i < HEATMAP.length; i++) {
      const prev = new Date(HEATMAP[i - 1].date).getTime();
      const cur = new Date(HEATMAP[i].date).getTime();
      expect(cur).toBeGreaterThan(prev);
    }
  });

  it('has minutes for past days and null for the future tail', () => {
    const past = HEATMAP.filter((d) => d.minutes !== null);
    const future = HEATMAP.filter((d) => d.minutes === null);
    expect(past.length).toBeGreaterThan(300);
    expect(future.length).toBeGreaterThan(0);
    // Once we hit null, the rest should also be null (the future is at the tail).
    const firstNull = HEATMAP.findIndex((d) => d.minutes === null);
    if (firstNull !== -1) {
      expect(HEATMAP.slice(firstNull).every((d) => d.minutes === null)).toBe(true);
    }
  });

  it('keeps minutes within a plausible range', () => {
    for (const d of HEATMAP) {
      if (d.minutes !== null) {
        expect(d.minutes).toBeGreaterThanOrEqual(0);
        expect(d.minutes).toBeLessThan(180);
      }
    }
  });
});

describe('stats data shape', () => {
  it('WEEK has 7 days with non-negative minutes', () => {
    expect(WEEK).toHaveLength(7);
    for (const d of WEEK) {
      expect(d.piano + d.guitar + d.compose).toBeGreaterThanOrEqual(0);
    }
  });

  it('exactly one day is marked as today', () => {
    expect(WEEK.filter((d) => d.today).length).toBe(1);
  });

  it('TIME_BY_PIECE rows reference a valid instrument id', () => {
    const ids = new Set(INSTRUMENTS.map((i) => i.id));
    for (const r of TIME_BY_PIECE) expect(ids.has(r.who)).toBe(true);
  });

  it('RECENT mood pips are within the 1-5 scale', () => {
    for (const r of RECENT) {
      expect(r.mood).toBeGreaterThanOrEqual(1);
      expect(r.mood).toBeLessThanOrEqual(5);
    }
  });
});
