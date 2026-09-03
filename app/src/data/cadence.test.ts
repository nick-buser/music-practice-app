import { describe, expect, it } from 'vitest';
import { dueState } from './cadence';

const NOW = new Date('2026-09-03T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('dueState', () => {
  it('is "none" when no cadence is set (null)', () => {
    expect(dueState(null, null, NOW)).toBe('none');
    expect(dueState('2026-09-01T12:00:00Z', null, NOW)).toBe('none');
  });

  it('is "none" when the cadence is off (0)', () => {
    expect(dueState('2026-08-01T12:00:00Z', 0, NOW)).toBe('none');
  });

  it('is "due" — not "overdue" — for a cadence set on a subject never recorded', () => {
    // See cadence.ts's doc comment: no elapsed time to measure means no
    // basis for the escalated "overdue" state, but a cadence was actively
    // asked for, so it isn't "none" either.
    expect(dueState(null, 7, NOW)).toBe('due');
  });

  it('is "none" comfortably within the interval', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 3 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('none');
  });

  it('is "due" exactly at the interval boundary (>=, not >)', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 7 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('due');
  });

  it('is "none" one millisecond short of the interval boundary', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 7 * DAY + 1).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('none');
  });

  it('is "due" comfortably past the interval but short of 2x', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 10 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('due');
  });

  it('is "overdue" exactly at the 2x-interval boundary (>=, not >)', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 14 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('overdue');
  });

  it('is "due" one millisecond short of the 2x-interval boundary', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 14 * DAY + 1).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('due');
  });

  it('is "overdue" well past 2x the interval', () => {
    const lastCapturedAt = new Date(NOW.getTime() - 30 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, NOW)).toBe('overdue');
  });

  it('does not let a DST-adjacent local-time difference flip the boundary', () => {
    // US DST spring-forward: 2026-03-08. A naive local-calendar-date
    // subtraction (rather than raw UTC millisecond difference) could count
    // this as 7 whole local days when it's actually 7 days minus an hour,
    // or vice versa. Anchor both instants in UTC and assert the exact-day
    // boundary is respected regardless.
    const dstNow = new Date('2026-03-15T12:00:00Z');
    const lastCapturedAt = new Date(dstNow.getTime() - 7 * DAY).toISOString();
    expect(dueState(lastCapturedAt, 7, dstNow)).toBe('due');
    // One millisecond short — still "none" — even though a US clock
    // skipped an hour crossing this exact window.
    const almost = new Date(dstNow.getTime() - 7 * DAY + 1).toISOString();
    expect(dueState(almost, 7, dstNow)).toBe('none');
  });

  it('treats an unparseable lastCapturedAt like "never recorded"', () => {
    expect(dueState('not-a-date', 7, NOW)).toBe('due');
  });
});
