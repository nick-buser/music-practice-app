import { beatsPerBarExact } from '../score/attrs';
import { toNumber } from '../score/fraction';

/**
 * Human-readable relative time for a yyyy-mm-dd date string, anchored to the
 * journal's fixed "today" (so the mock data is deterministic in tests and
 * across reloads).
 */
const JOURNAL_TODAY = new Date('2026-05-19');

export function relTime(dateStr: string, today: Date = JOURNAL_TODAY): string {
  const d = new Date(dateStr);
  const diff = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} wk ago`;
  return `${Math.floor(diff / 30)} mo ago`;
}

/**
 * Pulses per bar for a meter string like "12/8" or "4/4".
 * Compound meters (x/8 divisible by 3) beat in dotted groupings, so 12/8 → 4,
 * 9/8 → 3, 6/8 → 2. Falls back to 4 if the meter doesn't parse.
 *
 * SC1 made this a wrapper: the compound-meter rule it encoded is the same one
 * `score/attrs.ts beatUnit` needs for `TimeSig`, and two copies of a music rule
 * is exactly how the engraving and the metronome end up disagreeing. The
 * arithmetic is now `count × 4/unit ÷ durationOf(beatUnit)` over exact
 * rationals, which reduces to `count` for every simple meter and `count/3` for
 * every compound one — i.e. this function's observable behaviour is unchanged.
 */
export function beatsPerBar(meter: string): number {
  const [count, unit] = meter.split('/').map(Number);
  if (!Number.isFinite(count) || count <= 0) return 4;
  if (!Number.isInteger(unit) || unit <= 0) return count;
  return toNumber(beatsPerBarExact({ count, unit }));
}

/**
 * Format a millisecond duration as "m:ss" — shared by the recording badge's
 * live elapsed clock and the takes list's per-take duration (RC2).
 */
export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
