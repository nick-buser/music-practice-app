import type { Scale } from './schemas';

/**
 * Twelve major scales, one octave ascending — the floor of any technique
 * routine. Sequenced in circle-of-fifths order from C, sharps first, then flats.
 *
 * Engravings are deliberately minimal (`X:1 / T: / M:4/4 / L:1/4 / K:<key> /
 * <notes>`) so Verovio renders them as one clean two-bar system per card.
 * ABC notes follow the key signature for accidentals — `K:G` makes the F
 * automatically sharp, so we just write the natural-letter scale degrees.
 *
 * Tracking state (comfort / lastTouched / bpmCurrent / reps) is plausible mock
 * data; the structure is here so we can layer real per-session updates onto it
 * in a later pass. Minor scales and arpeggios are deliberately left to a
 * follow-up — the view ships their tabs as "coming soon" stubs.
 */

interface Spec {
  id: string;
  name: string;
  tonic: string;
  key: string;       // ABC key signature, e.g. "C", "G", "Bb", "F#"
  notes: string;     // ABC note string for one ascending octave
  comfort: number;
  lastTouched: string | null;
  bpmTarget: number;
  bpmCurrent: number;
  reps: number;
}

const SPECS: Spec[] = [
  { id: 'c-major',  name: 'C major',  tonic: 'C',  key: 'C',  notes: 'CDEF | GABc |', comfort: 0.95, lastTouched: '2026-05-29', bpmTarget: 140, bpmCurrent: 140, reps: 312 },
  { id: 'g-major',  name: 'G major',  tonic: 'G',  key: 'G',  notes: 'GABc | defg |', comfort: 0.88, lastTouched: '2026-05-29', bpmTarget: 140, bpmCurrent: 132, reps: 264 },
  { id: 'd-major',  name: 'D major',  tonic: 'D',  key: 'D',  notes: 'DEFG | ABcd |', comfort: 0.82, lastTouched: '2026-05-28', bpmTarget: 140, bpmCurrent: 128, reps: 218 },
  { id: 'a-major',  name: 'A major',  tonic: 'A',  key: 'A',  notes: 'ABcd | efga |', comfort: 0.74, lastTouched: '2026-05-27', bpmTarget: 140, bpmCurrent: 120, reps: 184 },
  { id: 'e-major',  name: 'E major',  tonic: 'E',  key: 'E',  notes: 'EFGA | Bcde |', comfort: 0.62, lastTouched: '2026-05-25', bpmTarget: 140, bpmCurrent: 108, reps: 146 },
  { id: 'b-major',  name: 'B major',  tonic: 'B',  key: 'B',  notes: 'Bcde | fgab |', comfort: 0.42, lastTouched: '2026-05-22', bpmTarget: 132, bpmCurrent: 88,  reps: 92  },
  { id: 'fs-major', name: 'F♯ major', tonic: 'F♯', key: 'F#', notes: 'FGAB | cdef |', comfort: 0.18, lastTouched: '2026-05-12', bpmTarget: 132, bpmCurrent: 60,  reps: 36  },
  { id: 'f-major',  name: 'F major',  tonic: 'F',  key: 'F',  notes: 'FGAB | cdef |', comfort: 0.86, lastTouched: '2026-05-28', bpmTarget: 140, bpmCurrent: 132, reps: 248 },
  { id: 'bb-major', name: 'B♭ major', tonic: 'B♭', key: 'Bb', notes: 'Bcde | fgab |', comfort: 0.71, lastTouched: '2026-05-26', bpmTarget: 140, bpmCurrent: 116, reps: 172 },
  { id: 'eb-major', name: 'E♭ major', tonic: 'E♭', key: 'Eb', notes: 'EFGA | Bcde |', comfort: 0.66, lastTouched: '2026-05-24', bpmTarget: 140, bpmCurrent: 112, reps: 158 },
  { id: 'ab-major', name: 'A♭ major', tonic: 'A♭', key: 'Ab', notes: 'ABcd | efga |', comfort: 0.48, lastTouched: '2026-05-19', bpmTarget: 132, bpmCurrent: 92,  reps: 104 },
  { id: 'db-major', name: 'D♭ major', tonic: 'D♭', key: 'Db', notes: 'DEFG | ABcd |', comfort: 0.28, lastTouched: '2026-05-15', bpmTarget: 132, bpmCurrent: 72,  reps: 64  },
];

function toScale(s: Spec): Scale {
  return {
    id: s.id,
    name: s.name,
    tonic: s.tonic,
    family: 'major',
    abc: `X:1\nT:${s.name} scale\nM:4/4\nL:1/4\nK:${s.key}\n${s.notes}`,
    comfort: s.comfort,
    lastTouched: s.lastTouched,
    bpmTarget: s.bpmTarget,
    bpmCurrent: s.bpmCurrent,
    reps: s.reps,
  };
}

export const SCALES: Scale[] = SPECS.map(toScale);

/** Daily routine — the user's "warmup order". A simple ordered slice for now. */
export const DAILY_ROUTINE_IDS: string[] = ['c-major', 'g-major', 'd-major', 'bb-major', 'eb-major'];
