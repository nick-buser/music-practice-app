import { describe, expect, it } from 'vitest';

import { scaleAbcMeasure } from './engraving';
import { JAPANESE_SCALES, WORLD_SCALE_BY_FAMILY } from './world';

const byId = (id: string) => WORLD_SCALE_BY_FAMILY.get(id)!;

describe('Japanese scale data', () => {
  it('defines five pentatonic scales', () => {
    expect(JAPANESE_SCALES).toHaveLength(5);
    for (const s of JAPANESE_SCALES) expect(s.degrees).toHaveLength(5); // pentatonic
  });
});

describe('scaleAbcMeasure', () => {
  it('spells each scale ascending in K:C (root C)', () => {
    expect(scaleAbcMeasure(byId('hirajoshi'), 'C', 'natural')).toBe('CD_EG_Ac |');
    expect(scaleAbcMeasure(byId('in-sen'), 'C', 'natural')).toBe('C_DFG_Bc |');
    expect(scaleAbcMeasure(byId('yo'), 'C', 'natural')).toBe('CDFGAc |');
    expect(scaleAbcMeasure(byId('iwato'), 'C', 'natural')).toBe('C_DF_G_Bc |');
    expect(scaleAbcMeasure(byId('kumoi'), 'C', 'natural')).toBe('CD_EGAc |');
  });

  it('spells correctly across an octave crossing (F♯ hirajōshi)', () => {
    // F♯ G♯ A C♯ D f♯ — the 5th/♭6 wrap into the next octave.
    expect(scaleAbcMeasure(byId('hirajoshi'), 'F', 'sharp')).toBe('^F^GA^cd^f |');
  });
});
