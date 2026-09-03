import { useMemo } from 'react';
import { useRecordingCadences } from '../hooks/useRecordingCadences';
import { dueState } from '../data/cadence';

interface Props {
  subjectKind: string;
  subjectId: string;
  /** The subject's most recent recording's `capturedAt`, or `null` if it
   *  has never been recorded — `dueState`'s "never recorded" input. */
  lastCapturedAt: string | null;
  active: boolean;
}

/** off / 3 / 7 / 14 / 30 days — the ticket's exact picker options. `null` is
 *  "off" (see `RecordingCadence`'s docstring in
 *  `backend/app/models/recording.py` for why NULL, not `0`). */
const CADENCE_OPTIONS: Array<{ label: string; intervalDays: number | null }> = [
  { label: 'off', intervalDays: null },
  { label: 'every 3 days', intervalDays: 3 },
  { label: 'weekly', intervalDays: 7 },
  { label: 'every 2 weeks', intervalDays: 14 },
  { label: 'monthly', intervalDays: 30 },
];

/** Encode `intervalDays` as an HTML `<select>` value — `<select>` values are
 *  always strings, and `null` needs its own sentinel distinct from any
 *  digit string. */
function toOptionValue(intervalDays: number | null): string {
  return intervalDays === null ? 'off' : String(intervalDays);
}

/**
 * The cadence picker + due chip — SessionView and PieceView both drop this
 * in alongside `TakesList` (RC3). Self-contained: owns its own fetch/upsert
 * via `useRecordingCadences`, so call sites only need to know the subject.
 */
export function CadenceControl({ subjectKind, subjectId, lastCapturedAt, active }: Props) {
  const { cadence, setCadence } = useRecordingCadences(subjectKind, subjectId, active);
  const intervalDays = cadence?.intervalDays ?? null;

  // `new Date()` here (not injected) is deliberate — this is the one place
  // "now" enters the picture; `dueState` itself stays pure and total
  // (`data/cadence.ts`, `data/cadence.test.ts`).
  const state = useMemo(
    () => dueState(lastCapturedAt, intervalDays, new Date()),
    [lastCapturedAt, intervalDays],
  );

  return (
    <div className="cadence-control">
      <select
        className="cadence-select"
        aria-label="Recording cadence"
        value={toOptionValue(intervalDays)}
        onChange={(e) => {
          const raw = e.target.value;
          void setCadence(raw === 'off' ? null : Number(raw));
        }}
      >
        {CADENCE_OPTIONS.map((o) => (
          <option key={o.label} value={toOptionValue(o.intervalDays)}>
            {o.label}
          </option>
        ))}
      </select>
      {state !== 'none' && <span className={`chip cadence-chip ${state}`}>{state}</span>}
    </div>
  );
}
