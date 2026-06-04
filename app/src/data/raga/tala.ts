/**
 * Tala — the cyclic rhythmic framework. A tala is a fixed number of beats
 * (matra in Hindustani, akshara in Carnatic) grouped into sections, repeating
 * as avartanas (cycles). Beat one of every cycle is the sam (×), the point of
 * resolution.
 *
 * Hindustani groups beats into vibhags marked tali (clap) or khali (wave);
 * Carnatic builds cycles from angas — laghu (a clap plus finger counts),
 * drutam (a clap and a wave) and anudrutam (a clap). We model both as an
 * ordered list of sections carrying a marker, so a single layout pass renders
 * either tradition. The sam is implicit (the very first beat) rather than a
 * marker, since both traditions share it.
 */

import type { MusicSystem } from './swara';

/**
 * What a section means rhythmically. Hindustani uses tali / khali; Carnatic
 * uses laghu / drutam / anudrutam. (Their beat counts already live in `matras`.)
 */
export type SectionMarker = 'tali' | 'khali' | 'laghu' | 'drutam' | 'anudrutam';

export interface TalaSection {
  /** Beats (matra / akshara) in this section. */
  matras: number;
  marker: SectionMarker;
}

export interface Tala {
  id: string;
  name: string;
  system: MusicSystem;
  sections: TalaSection[];
}

/** Total beats in one cycle (avartana). */
export function talaMatras(tala: Tala): number {
  return tala.sections.reduce((sum, s) => sum + s.matras, 0);
}

/** The matra index (0-based) at which each section begins. */
export function sectionStarts(tala: Tala): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const s of tala.sections) {
    starts.push(acc);
    acc += s.matras;
  }
  return starts;
}

const section = (matras: number, marker: SectionMarker): TalaSection => ({ matras, marker });

export const TALAS: Tala[] = [
  // Hindustani — 16 matras, four vibhags of four. Clap pattern × 2 0 3:
  // sam, tali, khali (wave), tali.
  {
    id: 'teental',
    name: 'Tīntāl',
    system: 'hindustani',
    sections: [section(4, 'tali'), section(4, 'tali'), section(4, 'khali'), section(4, 'tali')],
  },
  // Hindustani — 10 matras, 2 + 3 + 2 + 3, clap pattern × 2 0 3.
  {
    id: 'jhaptaal',
    name: 'Jhaptāl',
    system: 'hindustani',
    sections: [section(2, 'tali'), section(3, 'tali'), section(2, 'khali'), section(3, 'tali')],
  },
  // Hindustani — 8 matras, 4 + 4, light folk/film tala. Clap pattern × 0.
  {
    id: 'keherwa',
    name: 'Keharwā',
    system: 'hindustani',
    sections: [section(4, 'tali'), section(4, 'khali')],
  },
  // Carnatic — Adi tala (chaturasra-jati triputa), 8 aksharas:
  // laghu (4) + drutam (2) + drutam (2). The foundational beginner's tala.
  {
    id: 'adi',
    name: 'Ādi',
    system: 'carnatic',
    sections: [section(4, 'laghu'), section(2, 'drutam'), section(2, 'drutam')],
  },
];

export const TALA_BY_ID: Map<string, Tala> = new Map(TALAS.map((t) => [t.id, t]));
