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
import { WORLD_SCALE_BY_FAMILY } from './scales/world';
import type { Drill, Section } from './schemas';
import type { IdeaSummary } from '../api/client';

export type SubjectKind = 'piece' | 'scale' | 'idea';

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
 * The idea fields `subjectFromIdea` actually needs — a structural subset
 * shared by `IdeaSummary` (the stream list) and `Idea` (the single-idea
 * page; see `api/client.ts`), so whichever caller already has an idea in
 * hand can pass it straight through without an extra fetch.
 */
export type IdeaSubjectSource = Pick<IdeaSummary, 'id' | 'handle' | 'title' | 'kinds' | 'meter' | 'bpm'>;

/**
 * Build a Subject from a live idea (SB4). Deliberately *not* folded into
 * `resolveSubject`: that stays synchronous over the bundled piece/scale
 * catalog, but an idea lives behind the API and can't be resolved from an
 * id alone. So this is a small, pure mapping — the caller (SessionView,
 * matching the id against `useIdeas`' already-loaded list) does the async
 * part and hands over the idea it found.
 */
export function subjectFromIdea(idea: IdeaSubjectSource): Subject {
  return {
    id: `idea:${idea.id}`,
    kind: 'idea',
    // `ideaHeadline` (SketchbookLive.tsx / IdeaPage.tsx) falls back to the
    // idea's first non-empty body line, then "(untitled capture)" — right
    // for a stream card or a page heading. A session heading should be
    // short and available without reading the body, so this deliberately
    // diverges: an untitled idea's Subject title is just its handle.
    title: idea.title || `#${idea.handle}`,
    byline: idea.kinds.join(', '),
    subtitle: '',
    abc: undefined,
    meter: idea.meter || '4/4',
    bpmTarget: idea.bpm ?? 80,
    bpmCurrent: idea.bpm ?? 80,
    // No session-tracking wiring exists yet for ideas (deferred — see the
    // grooming doc's "Practice-tracking UI wiring" note); a fresh idea
    // subject always starts at zero logged sessions.
    sessionsLogged: 0,
    sections: [],
    hasPieceDetail: false,
  };
}

/**
 * The italic byline for a drill subject. Chords derive it from their identity
 * (`subtitleLine`); scales and arpeggios keep their hand-written descriptors.
 */
function bylineForDrill(drill: Drill): string {
  const identity = CHORD_IDENTITY_BY_ID.get(drill.id);
  if (identity) return subtitleLine(identity);
  const world = WORLD_SCALE_BY_FAMILY.get(drill.family);
  if (world) return `${world.name} · pentatonic`;
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
