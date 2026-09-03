/**
 * Extracted properties (key/tempo/other facts PV3's `midi-features`
 * extractor derives from an idea's MIDI audio, with lineage badges back to
 * the run that produced them) — this is the panel `SB3b` reserved a slot
 * for. Purely prop-driven, same pattern as `AttachmentsPanel`/`MetadataRail`:
 * `IdeaPage` (via `useIdea`) owns the fetch, this component owns none of it.
 */
import type { IdeaProperty } from '../api/client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2 Sep" — the compact lineage-badge date (PV3's grooming-doc example:
 * "key guess: F♯ minor — midi-features 1.0.0 · 2 Sep"). Formatted by hand
 * rather than `toLocaleDateString` so the shape doesn't drift with the
 * runtime's locale.
 */
function formatRunDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Sharps only, matching the backend's own spelling convention
// (`midi_features.py`'s `_NOTE_NAMES`) — C4 = MIDI note 60.
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function midiNoteName(n: number): string {
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${octave}`;
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

/**
 * Kind-specific one-line readings. `midi-features`' six kinds each get a
 * tailored description; an unrecognised kind still renders (its kind name
 * plus raw payload) rather than disappearing, so a future extractor's new
 * kind is visible immediately, not silently dropped while this panel
 * catches up to it.
 */
function describeProperty(prop: IdeaProperty): string {
  const p = asRecord(prop.payload);
  switch (prop.kind) {
    case 'key_guess':
      return `key guess: ${typeof p.key === 'string' ? p.key : '?'}`;
    case 'tempo':
      return `tempo: ${asNumber(p.bpm) ?? '?'} bpm`;
    case 'note_count':
      return `note count: ${asNumber(p.count) ?? '?'}`;
    case 'duration_ms': {
      const ms = asNumber(p.durationMs);
      return `duration: ${ms === null ? '?' : (ms / 1000).toFixed(1)}s`;
    }
    case 'piano_roll_summary': {
      const lo = asNumber(p.lowestPitch);
      const hi = asNumber(p.highestPitch);
      const poly = asNumber(p.meanPolyphony);
      const range = lo === null || hi === null ? '?' : `${midiNoteName(lo)}–${midiNoteName(hi)}`;
      return `range: ${range} · avg polyphony ${poly === null ? '?' : poly.toFixed(2)}`;
    }
    case 'pitch_class_histogram': {
      const hist = Array.isArray(p.histogram) ? p.histogram : [];
      return `pitch class histogram: ${hist.map((v) => (typeof v === 'number' ? v.toFixed(2) : '?')).join(', ')}`;
    }
    default:
      return `${prop.kind}: ${JSON.stringify(prop.payload)}`;
  }
}

interface Props {
  properties: IdeaProperty[];
}

export function PropertiesPanel({ properties }: Props) {
  return (
    <div className="idea-rail">
      <div className="idea-head">
        <span className="l">— properties</span>
      </div>
      {properties.length === 0 ? (
        <div className="props-empty">no extracted properties yet</div>
      ) : (
        <div className="properties-list">
          {properties.map((prop) => (
            <div key={prop.id} className="prop-row">
              <span className="prop-desc">{describeProperty(prop)}</span>
              <span className="prop-lineage">
                — {prop.run.extractor} {prop.run.extractorVersion} · {formatRunDate(prop.run.finishedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
