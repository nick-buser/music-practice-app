/**
 * A raga — the melodic framework a composition lives in. For teaching we
 * capture the ascent (aroha) and descent (avaroha) as swara phrases, the
 * characteristic phrase (pakad / chalan), and tradition-specific placement:
 * Hindustani ragas have a parent thaat, a vadi/samvadi (sonant/consonant
 * notes) and a time of day; Carnatic ragas have a parent melakarta number.
 *
 * Note on Carnatic labelling: our swara model marks komal/tivra, not the finer
 * R1/R2/R3 swarasthana indices. Mayamalavagowla maps cleanly onto komal/shuddha
 * positions, so it renders correctly today; full Rn/Gn subscript labelling is a
 * later refinement (tracked in the folder README).
 */

import { parsePhrase, parseSwara, type MusicSystem, type Swara } from './swara';

export interface Raga {
  id: string;
  name: string;
  system: MusicSystem;
  /** Parent scale: a Hindustani thaat or a Carnatic melakarta name. */
  parentScale: string;
  /** Carnatic melakarta number (1–72), when applicable. */
  melakarta?: number;
  /** Ascending line. */
  aroha: Swara[];
  /** Descending line. */
  avaroha: Swara[];
  /** Sonant note (Hindustani). */
  vadi?: Swara;
  /** Consonant note (Hindustani). */
  samvadi?: Swara;
  /** Characteristic phrase that fixes the raga's identity. */
  pakad?: Swara[];
  /** Hindustani performance time, free text. */
  timeOfDay?: string;
  /** One- or two-line teaching note. */
  description: string;
}

export const RAGAS: Raga[] = [
  {
    id: 'yaman',
    name: 'Yaman',
    system: 'hindustani',
    parentScale: 'Kalyan thaat',
    // Pa is skipped on the way up; the tivra Ma is the raga's signature colour.
    aroha: parsePhrase(".N R G M D N S'"),
    avaroha: parsePhrase("S' N D P M G R S"),
    vadi: parseSwara('G'),
    samvadi: parseSwara('N'),
    pakad: parsePhrase('.N R G M G R S'),
    timeOfDay: 'Evening (first prahar of night)',
    description:
      'A foundational evening raga of the Kalyan thaat, defined by its tivra Ma. ' +
      'Serene and expansive — often the first raga a Hindustani student learns.',
  },
  {
    id: 'mayamalavagowla',
    name: 'Māyāmāḷavagowḷa',
    system: 'carnatic',
    parentScale: '15th melakarta (Māyāmāḷavagowḷa)',
    melakarta: 15,
    // Symmetric sampurna raga: S R1 G3 M1 P D1 N3 — komal Re/Dha, shuddha rest.
    aroha: parsePhrase("S r G m P d N S'"),
    avaroha: parsePhrase("S' N d P m G r S"),
    pakad: parsePhrase('S r G m P'),
    description:
      'The 15th melakarta and the traditional first raga of Carnatic training — ' +
      'its evenly spaced komal Re and Dha make the swarasthanas easy to pitch.',
  },
];

export const RAGA_BY_ID: Map<string, Raga> = new Map(RAGAS.map((r) => [r.id, r]));
