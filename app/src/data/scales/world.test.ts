import { describe, expect, it } from 'vitest';

import { scaleAbcMeasure } from './engraving';
import { CHINESE_SCALES, JAPANESE_SCALES, WORLD_SCALES, WORLD_SCALE_BY_FAMILY } from './world';

const byId = (id: string) => WORLD_SCALE_BY_FAMILY.get(id)!;

describe('world scale data', () => {
  it('defines ten pentatonic scales (5 Japanese + 5 Chinese)', () => {
    expect(JAPANESE_SCALES).toHaveLength(5);
    expect(CHINESE_SCALES).toHaveLength(5);
    expect(WORLD_SCALES).toHaveLength(10);
    for (const s of WORLD_SCALES) expect(s.degrees).toHaveLength(5); // all pentatonic
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

  it('spells the Chinese five-tone modes (root C)', () => {
    expect(scaleAbcMeasure(byId('gong'), 'C', 'natural')).toBe('CDEGAc |');
    expect(scaleAbcMeasure(byId('shang'), 'C', 'natural')).toBe('CDFG_Bc |');
    expect(scaleAbcMeasure(byId('jue'), 'C', 'natural')).toBe('C_EF_A_Bc |');
    expect(scaleAbcMeasure(byId('zhi'), 'C', 'natural')).toBe('CDFGAc |');
    expect(scaleAbcMeasure(byId('yu'), 'C', 'natural')).toBe('C_EFG_Bc |');
  });
});
