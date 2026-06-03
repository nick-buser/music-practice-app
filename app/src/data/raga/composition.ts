/**
 * A composition — swaras laid out on a tala grid. The unit cell is one matra;
 * a matra can hold a single swara, a subdivision of several swaras, a sustain
 * (the previous note held on, written "−"), or a rest. Cells are grouped into
 * sections — sthayi / antara for a Hindustani bandish, or the avartanas of a
 * Carnatic exercise — each spanning a whole number of tala cycles.
 *
 * The seed pieces here are pedagogical: an original Yaman sargam exercise and
 * the canonical Carnatic sarali varisai (beginner scale patterns). Both are
 * teaching material, not transcriptions of specific copyrighted bandishes.
 */

import { parseSwara, type Swara } from './swara';
import { talaMatras, type Tala } from './tala';

export type Cell =
  | { kind: 'swara'; swaras: Swara[] } // one matra; >1 swara = a subdivision
  | { kind: 'sustain' } // hold the previous swara through this matra ("−")
  | { kind: 'rest' }; // silence ("~")

export interface CompositionSection {
  id: string;
  /** Display label, e.g. "Sthāyī", "Antarā", "Ārohana". */
  label: string;
  /** One whole number of tala cycles' worth of cells. */
  cells: Cell[];
  /** Optional lyric syllable per matra, aligned to `cells`. */
  lyrics?: string[];
}

export interface Composition {
  id: string;
  title: string;
  system: 'hindustani' | 'carnatic';
  ragaId: string;
  talaId: string;
  /** Default playback tempo, in matras per minute. */
  layaBpm: number;
  sections: CompositionSection[];
  /** Attribution / teaching note. */
  note?: string;
}

/**
 * Parse a compact cell string. Tokens are whitespace-separated, one per matra:
 *   • a swara token (see parseSwara), e.g. "S", "r", ".P", "S'"
 *   • "S,R"  a subdivided matra (comma-separated swaras)
 *   • "-"    a sustain of the previous swara
 *   • "~"    a rest
 *   • "|"    a barline — purely visual, ignored here
 */
export function parseCells(src: string): Cell[] {
  const cells: Cell[] = [];
  for (const token of src.trim().split(/\s+/)) {
    if (token.length === 0 || token === '|') continue;
    if (token === '-') {
      cells.push({ kind: 'sustain' });
    } else if (token === '~') {
      cells.push({ kind: 'rest' });
    } else {
      const swaras = token.split(',').map(parseSwara);
      cells.push({ kind: 'swara', swaras });
    }
  }
  return cells;
}

/** Throws if a section's cell count isn't a whole number of tala cycles. */
export function assertCycleAligned(section: CompositionSection, tala: Tala): void {
  const beats = talaMatras(tala);
  if (section.cells.length % beats !== 0) {
    throw new Error(
      `section "${section.id}": ${section.cells.length} matras is not a multiple of ${beats}`,
    );
  }
}

const sthayi = (label: string, src: string): CompositionSection => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  label,
  cells: parseCells(src),
});

export const COMPOSITIONS: Composition[] = [
  {
    id: 'yaman-sargam',
    title: 'Yaman — Sargam Practice',
    system: 'hindustani',
    ragaId: 'yaman',
    talaId: 'teental',
    layaBpm: 120,
    note: 'An original sargam exercise tracing Yaman in Tīntāl (one avartana per line).',
    sections: [
      // 16 matras, ascending through the raga and resting on Sa of the upper octave.
      sthayi('Sthāyī', ".N R G M | D N S' - | S' N D P | M G R S"),
      // 16 matras, a descending answer phrase landing back on the sam.
      sthayi('Antarā', "G M D N | S' - N D | P M G R | G R S -"),
    ],
  },
  {
    id: 'sarali-varisai-1',
    title: 'Sarali Varisai — 1st',
    system: 'carnatic',
    ragaId: 'mayamalavagowla',
    talaId: 'adi',
    layaBpm: 96,
    note: 'The first sarali varisai: the plain ascent and descent in Ādi tala.',
    sections: [
      // 8 aksharas up, 8 down — the foundational Carnatic exercise.
      sthayi('Ārohaṇa', "S r G m | P d N S'"),
      sthayi('Avarohaṇa', "S' N d P | m G r S"),
    ],
  },
  {
    id: 'sarali-varisai-2',
    title: 'Sarali Varisai — 2nd',
    system: 'carnatic',
    ragaId: 'mayamalavagowla',
    talaId: 'adi',
    layaBpm: 96,
    note: 'The second sarali varisai, pairing each swara with its neighbour.',
    sections: [
      sthayi('Ārohaṇa', "S r r G | G m m P"),
      sthayi('Avarohaṇa', "d d N N | S' - - -"),
    ],
  },
];

export const COMPOSITION_BY_ID: Map<string, Composition> = new Map(
  COMPOSITIONS.map((c) => [c.id, c]),
);

/** Flatten a section's cells back to the swaras they sound, in order. */
export function sectionSwaras(section: CompositionSection): Swara[] {
  const out: Swara[] = [];
  for (const cell of section.cells) {
    if (cell.kind === 'swara') out.push(...cell.swaras);
  }
  return out;
}
