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
 */
export function beatsPerBar(meter: string): number {
  const [num, den] = meter.split('/').map(Number);
  if (den === 8 && num !== undefined && num > 0 && num % 3 === 0) return num / 3;
  return num && num > 0 ? num : 4;
}
