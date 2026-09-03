/**
 * Recording cadence — the periodic half of the recordings workstream
 * ("record this weekly"). RC1/RC2 gave a subject a take history; RC3 lets a
 * subject *want* fresh takes on a schedule. There is deliberately no
 * scheduler anywhere in this app: nothing runs on a timer, nothing polls.
 * `dueState` is the whole mechanism — a pure function computed on read,
 * pairing a subject's `RecordingCadence.intervalDays` (backend, RC3) with
 * the `capturedAt` of its most recent recording (already fetched by
 * `useRecordings`).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DueState = 'none' | 'due' | 'overdue';

/**
 * `lastCapturedAt` — the `capturedAt` of the subject's most recent
 * recording (ISO 8601), or `null` if it has never been recorded.
 * `intervalDays` — the subject's cadence, or `null`/`0` for "off"
 * (`RecordingCadence.intervalDays` is `null` for "off" on the wire — see
 * its docstring in `backend/app/models/recording.py` — but `0` is treated
 * the same way here so this stays total even if a caller passes a stray
 * falsy interval).
 * `now` — injected, never `new Date()` internally, so this stays pure and
 * the tests below are deterministic (mirrors `lib/time.ts`'s `relTime`).
 *
 * Semantics, decided and pinned by the tests below:
 *
 *  - No cadence set (`intervalDays` null/0) → `'none'`. A subject with no
 *    cadence has nothing to be due *for*.
 *  - Cadence set, **never recorded** (`lastCapturedAt` null) → `'due'`, not
 *    `'overdue'`. A subject you've asked to track on a schedule but never
 *    captured a single take of is behind from the moment the cadence was
 *    set — there's no "elapsed time" to measure, so there's no basis for
 *    the *escalated* `'overdue'` state either (that's reserved for a
 *    take that's not just late but stale — see the 2× rule below). `'due'`
 *    says "go record something" without implying it's been neglected for a
 *    specific, known-long stretch.
 *  - Elapsed time since the last take < interval → `'none'`.
 *  - Elapsed time == interval, exactly on the boundary → `'due'` (the
 *    comparison is `>=`, not `>`) — the interval names the day the take is
 *    due, not the first day after it.
 *  - Elapsed time >= interval, < 2× interval → `'due'`.
 *  - Elapsed time >= 2× interval (also a `>=` boundary, same reasoning as
 *    above) → `'overdue'`.
 *
 * Whole-day arithmetic is done from the raw UTC millisecond difference
 * between the two instants (`Date#getTime()`, already timezone-agnostic),
 * never by taking local calendar-date parts and subtracting those — the
 * latter is exactly what lets a DST transition add or remove an hour and
 * flip a same-day boundary. Elapsed days is left fractional (not floored)
 * so a boundary like "exactly `intervalDays` later" compares cleanly
 * against the integer threshold without a rounding step that could push it
 * either direction.
 */
export function dueState(
  lastCapturedAt: string | null,
  intervalDays: number | null,
  now: Date,
): DueState {
  if (!intervalDays) return 'none'; // null or 0 — cadence is off

  if (lastCapturedAt === null) return 'due'; // never recorded — see doc comment above

  const last = new Date(lastCapturedAt);
  if (Number.isNaN(last.getTime())) return 'due'; // unparseable timestamp — treat like "never recorded"

  const elapsedDays = (now.getTime() - last.getTime()) / MS_PER_DAY;
  if (elapsedDays >= intervalDays * 2) return 'overdue';
  if (elapsedDays >= intervalDays) return 'due';
  return 'none';
}
