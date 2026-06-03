import { get as getScaleType } from '@tonaljs/scale-type';
import { describe, expect, it } from 'vitest';

import { CHORD_TYPES } from '../data/drills';
import { guitarChordShape } from './chord-shape';
import { noteToPitchClass, toAsciiNote } from './notes';
import { guitarScaleSpec } from './scale-spec';
import { guitarSupportsChord } from './support';

describe('notes', () => {
  it('parses pitch classes from display tonics', () => {
    expect(noteToPitchClass('C')).toBe(0);
    expect(noteToPitchClass('F♯')).toBe(6);
    expect(noteToPitchClass('C♯')).toBe(1);
    expect(noteToPitchClass('B♭')).toBe(10);
    expect(noteToPitchClass('D♭')).toBe(1); // enharmonic with C♯
  });

  it('asciifies accidentals', () => {
    expect(toAsciiNote('F♯')).toBe('F#');
    expect(toAsciiNote('B♭')).toBe('Bb');
  });
});

describe('chord-shape (chords-db → svguitar)', () => {
  it('maps C major to the open x32010 grip', () => {
    const shape = guitarChordShape('major', noteToPitchClass('C'));
    expect(shape).not.toBeNull();
    // strings 1=high e … 6=low E; frets x 3 2 0 1 0 from low E.
    expect(shape!.position).toBe(1);
    expect(shape!.barres).toEqual([]);
    expect(shape!.fingers).toEqual(
      expect.arrayContaining([
        [6, 'x'], // low E muted
        [5, 3, '3'], // A, 3rd fret, finger 3
        [4, 2, '2'], // D, 2nd fret, finger 2
        [3, 0], // G open
        [2, 1, '1'], // B, 1st fret, finger 1
        [1, 0], // high e open
      ]),
    );
  });

  it('produces a barre (with no double-dotted strings) for F major', () => {
    const shape = guitarChordShape('major', noteToPitchClass('F'));
    expect(shape!.barres.length).toBeGreaterThan(0);
    const barreFrets = new Set(shape!.barres.map((b) => b.fret));
    // No individual finger sits on a barre fret (it's covered by the barre).
    for (const finger of shape!.fingers) {
      if (typeof finger[1] === 'number' && finger[1] > 0) {
        expect(barreFrets.has(finger[1])).toBe(false);
      }
    }
  });

  it('returns null for the chord types chords-db lacks', () => {
    for (const type of ['min13', '7s11', '13b9', 'maj7s11'] as const) {
      expect(guitarSupportsChord(type)).toBe(false);
      expect(guitarChordShape(type, 0)).toBeNull();
    }
  });

  it('supports 21 of the 25 chord types, with a grip for every key', () => {
    const supported = CHORD_TYPES.filter(guitarSupportsChord);
    expect(supported).toHaveLength(21);
    for (const type of supported) {
      for (let pc = 0; pc < 12; pc++) {
        expect(guitarChordShape(type, pc), `${type}@${pc}`).not.toBeNull();
      }
    }
  });
});

describe('scale-spec', () => {
  it('maps scale families to Tonal scale names', () => {
    expect(guitarScaleSpec('major')).toEqual({ kind: 'scale', scaleType: 'major' });
    expect(guitarScaleSpec('harmonic-minor')).toEqual({ kind: 'scale', scaleType: 'harmonic minor' });
    expect(guitarScaleSpec('melodic-minor')).toEqual({ kind: 'scale', scaleType: 'melodic minor' });
  });

  it('maps arpeggios to a scale filtered to triad intervals', () => {
    expect(guitarScaleSpec('major-arpeggio')).toEqual({
      kind: 'arpeggio',
      scaleType: 'major',
      intervals: ['1P', '3M', '5P'],
    });
    expect(guitarScaleSpec('minor-arpeggio')).toEqual({
      kind: 'arpeggio',
      scaleType: 'minor',
      intervals: ['1P', '3m', '5P'],
    });
  });

  it('returns null for chord families', () => {
    expect(guitarScaleSpec('maj7-chord')).toBeNull();
  });

  it('maps Japanese families to their Tonal scale type', () => {
    expect(guitarScaleSpec('hirajoshi')).toEqual({ kind: 'scale', scaleType: 'hirajoshi' });
    expect(guitarScaleSpec('in-sen')).toEqual({ kind: 'scale', scaleType: 'in sen' });
    expect(guitarScaleSpec('yo')).toEqual({ kind: 'scale', scaleType: 'yo' });
  });

  it('maps Chinese families to their (already-in-Tonal) scale type', () => {
    expect(guitarScaleSpec('gong')).toEqual({ kind: 'scale', scaleType: 'major pentatonic' });
    expect(guitarScaleSpec('jue')).toEqual({ kind: 'scale', scaleType: 'malkos raga' });
    expect(guitarScaleSpec('yu')).toEqual({ kind: 'scale', scaleType: 'minor pentatonic' });
  });

  it('registers In/Yo with Tonal so the fretboard can resolve them', () => {
    // Importing scale-spec runs the registration side-effect.
    expect(getScaleType('in sen').empty).toBe(false);
    expect(getScaleType('yo').empty).toBe(false);
  });
});
