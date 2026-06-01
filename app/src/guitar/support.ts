/**
 * Which chord types have a guitar grip, and the chords-db suffix for each.
 *
 * Light module (no chords-db import) so the Drills view can cheaply decide
 * whether to show a guitar diagram or fall back to the staff. The 4 types
 * chords-db lacks (min13 / 7♯11 / 13♭9 / maj7♯11) are simply absent here.
 */
import type { ChordType } from '../data/drills';

export const GUITAR_CHORD_SUFFIX: Partial<Record<ChordType, string>> = {
  major: 'major',
  minor: 'minor',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  maj9: 'maj9',
  dom9: '9',
  min9: 'm9',
  maj11: 'maj11',
  dom11: '11',
  min11: 'm11',
  maj13: 'maj13',
  dom13: '13',
  '7b5': '7b5',
  '7s5': 'aug7',
  '7b9': '7b9',
  '7s9': '7#9',
  m7b5: 'm7b5',
  dim7: 'dim7',
  '7alt': 'alt',
  maj7s5: 'maj7#5',
};

export function guitarSupportsChord(type: ChordType): boolean {
  return type in GUITAR_CHORD_SUFFIX;
}
