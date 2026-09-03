import type { Recording } from '../api/client';
import { recordingTrackContentUrl } from '../api/recordings';
import { formatMs } from '../lib/time';

interface Props {
  recordings: Recording[];
  error?: string | null;
}

/**
 * The takes list under a score — SessionView's freshly-recorded takes and
 * PieceView's read-only history share this component (RC2; SessionView.tsx
 * grows past ~60 lines otherwise). Purely presentational: no record/delete
 * controls here, so it's read-only wherever it's dropped in.
 *
 * Each row plays its first `audio` track. MIDI-in-parallel tracks are
 * deferred to a follow-up after SB7, so a take with only a `midi` track
 * currently shows as "no audio track" rather than a player.
 */
export function TakesList({ recordings, error }: Props) {
  return (
    <div className="takes-list" data-testid="takes-list">
      <div className="eyebrow">— takes</div>
      {error && <div className="takes-error">{error}</div>}
      {!error && recordings.length === 0 && (
        <div className="takes-empty">no takes yet</div>
      )}
      {recordings.map((r) => {
        const audioTrack = r.tracks.find((t) => t.kind === 'audio');
        return (
          <div key={r.id} className="take-row" data-testid="take-row">
            <div className="take-meta">
              <span className="take-date">{formatCapturedAt(r.capturedAt)}</span>
              {r.durationMs !== null && <span>{formatMs(r.durationMs)}</span>}
            </div>
            {audioTrack ? (
              <audio controls src={recordingTrackContentUrl(r.id, audioTrack.id)} />
            ) : (
              <span className="take-no-audio">no audio track</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatCapturedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
