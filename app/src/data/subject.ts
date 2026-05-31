/**
 * A Session subject — anything the practice timer can sit in front of. Today
 * that's either a Piece or a Scale; tomorrow it'll be études, sight-reading
 * sets, etc. Normalising both into one shape keeps SessionView from caring.
 */

import { PIECES } from './sounddata';
import { ABC_BY_PIECE } from './scores';
import { DRILL_BY_ID } from './drills';
import { applyVoicing, CHORD_IDENTITY_BY_ID, decodeVoicedId } from './chord-catalog';
import { displayName, subtitleLine, toAbc } from './chord-identity';
import type { Drill, Section } from './schemas';

export type SubjectKind = 'piece' | 'scale';

export interface Subject {
  id: string;
  kind: SubjectKind;
  title: string;
  /** Italicised line under the title — composer for pieces, family for scales. */
  byline: string;
  /** Optional second descriptor (opus number, scale type). */
  subtitle: string;
  /** ABC fed to the playback cursor; may be undefined if there's no engraving. */
  abc: string | undefined;
  /** Meter string used by the metronome (e.g. "12/8", "4/4"). */
  meter: string;
  /** The student's "aim for" tempo on this subject. */
  bpmTarget: number;
  /** Where they're working today. */
  bpmCurrent: number;
  /** Sessions logged. Pieces track this; scales fall back to their reps count. */
  sessionsLogged: number;
  /** Optional section breakdown — only pieces have these. */
  sections: Section[];
  /** Whether this subject can be re-opened in the piece-detail view. */
  hasPieceDetail: boolean;
}

/**
 * Resolve a subject id to a normalised Subject. Pieces take precedence so we
 * don't accidentally shadow a piece with a same-named scale; falls back to the
 * first piece if the id can't be resolved (defensive — App always passes a
 * real id but a hot-reload mid-flight can sometimes get stale state).
 */
export function resolveSubject(id: string): Subject {
  const piece = PIECES.find((p) => p.id === id);
  if (piece) {
    return {
      id: piece.id,
      kind: 'piece',
      title: piece.title,
      byline: piece.composer,
      subtitle: piece.subtitle || piece.key,
      abc: ABC_BY_PIECE[piece.id],
      meter: piece.meter,
      bpmTarget: piece.tempo.bpm,
      bpmCurrent: piece.tempo.bpm,
      sessionsLogged: piece.sessions,
      sections: piece.sections,
      hasPieceDetail: true,
    };
  }

  // A drill id may carry a voicing suffix (e.g. "c-maj7-chord~drop2"); resolve
  // the base drill and, for chords, render the requested voicing on the fly.
  const { id: baseId, voicing } = decodeVoicedId(id);
  const drill = DRILL_BY_ID.get(baseId);
  if (drill) {
    const identity = CHORD_IDENTITY_BY_ID.get(drill.id);
    const voiced = identity && voicing !== 'root' ? applyVoicing(identity, voicing) : undefined;
    return {
      id,
      kind: 'scale',
      title: voiced ? displayName(voiced) : drill.name,
      byline: voiced ? subtitleLine(voiced) : bylineForDrill(drill),
      subtitle: `tonic ${drill.tonic}`,
      abc: voiced ? toAbc(voiced, displayName(voiced)) : drill.abc,
      meter: '4/4',
      bpmTarget: drill.bpmTarget,
      bpmCurrent: drill.bpmCurrent,
      sessionsLogged: drill.reps,
      sections: [],
      hasPieceDetail: false,
    };
  }

  // Unknown id — return the first piece so the session view doesn't blank out.
  const fallback = PIECES[0];
  return {
    id: fallback.id,
    kind: 'piece',
    title: fallback.title,
    byline: fallback.composer,
    subtitle: fallback.subtitle || fallback.key,
    abc: ABC_BY_PIECE[fallback.id],
    meter: fallback.meter,
    bpmTarget: fallback.tempo.bpm,
    bpmCurrent: fallback.tempo.bpm,
    sessionsLogged: fallback.sessions,
    sections: fallback.sections,
    hasPieceDetail: true,
  };
}

/**
 * The italic byline for a drill subject. Chords derive it from their identity
 * (`subtitleLine`); scales and arpeggios keep their hand-written descriptors.
 */
function bylineForDrill(drill: Drill): string {
  const identity = CHORD_IDENTITY_BY_ID.get(drill.id);
  if (identity) return subtitleLine(identity);
  switch (drill.family) {
    case 'major':
      return 'major scale';
    case 'natural-minor':
      return 'natural minor scale';
    case 'harmonic-minor':
      return 'harmonic minor scale';
    case 'melodic-minor':
      return 'melodic minor scale (ascending)';
    case 'major-arpeggio':
      return 'major arpeggio';
    case 'minor-arpeggio':
      return 'minor arpeggio';
    default:
      return 'drill';
  }
}
