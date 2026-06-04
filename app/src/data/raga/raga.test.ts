import { describe, expect, it } from 'vitest';

import {
  assertCycleAligned,
  COMPOSITIONS,
  parseCells,
  RAGA_BY_ID,
  sectionSwaras,
  TALA_BY_ID,
} from './index';
import {
  isValidSwara,
  parsePhrase,
  parseSwara,
  swaraGlyph,
  swaraSemitones,
  swarasthana,
} from './swara';
import { sectionStarts, talaMatras } from './tala';

describe('swara — parsing & pitch', () => {
  it('reads variant from letter case', () => {
    expect(parseSwara('S')).toEqual({ name: 'S', variant: 'shuddha', register: 'madhya' });
    expect(parseSwara('r')).toEqual({ name: 'R', variant: 'komal', register: 'madhya' });
    expect(parseSwara('R')).toEqual({ name: 'R', variant: 'shuddha', register: 'madhya' });
    expect(parseSwara('m')).toEqual({ name: 'M', variant: 'shuddha', register: 'madhya' });
    expect(parseSwara('M')).toEqual({ name: 'M', variant: 'tivra', register: 'madhya' });
  });

  it('reads register from . prefix and ’ suffix', () => {
    expect(parseSwara('.P').register).toBe('mandra');
    expect(parseSwara("S'").register).toBe('taar');
    expect(parseSwara('P').register).toBe('madhya');
  });

  it('maps swaras to semitones above middle Sa', () => {
    expect(swaraSemitones(parseSwara('S'))).toBe(0);
    expect(swaraSemitones(parseSwara('r'))).toBe(1);
    expect(swaraSemitones(parseSwara('R'))).toBe(2);
    expect(swaraSemitones(parseSwara('g'))).toBe(3);
    expect(swaraSemitones(parseSwara('m'))).toBe(5);
    expect(swaraSemitones(parseSwara('M'))).toBe(6);
    expect(swaraSemitones(parseSwara('P'))).toBe(7);
    expect(swaraSemitones(parseSwara('N'))).toBe(11);
    expect(swaraSemitones(parseSwara("S'"))).toBe(12);
    expect(swaraSemitones(parseSwara('.P'))).toBe(-5);
    expect(swaraSemitones(parseSwara('.N'))).toBe(-1);
  });

  it('rejects illegal swaras and tokens', () => {
    expect(isValidSwara('S', 'komal')).toBe(false);
    expect(isValidSwara('M', 'tivra')).toBe(true);
    expect(isValidSwara('R', 'tivra')).toBe(false);
    expect(() => parseSwara('X')).toThrow();
    expect(() => parseSwara('SS')).toThrow();
  });

  it('exposes glyph marks for the renderer', () => {
    expect(swaraGlyph(parseSwara('r'))).toEqual({
      letter: 'R',
      komal: true,
      tivra: false,
      register: 'madhya',
    });
    expect(swaraGlyph(parseSwara('M'))).toMatchObject({ letter: 'M', tivra: true, komal: false });
  });

  it('parses a whole phrase', () => {
    expect(parsePhrase(".N R G M D N S'")).toHaveLength(7);
  });

  it('derives Carnatic swarasthana indices that agree with the pitch', () => {
    // achala swaras have no index
    expect(swarasthana(parseSwara('S'))).toBeUndefined();
    expect(swarasthana(parseSwara('P'))).toBeUndefined();
    // komal / shuddha / tivra map to the standard positions
    expect(swarasthana(parseSwara('r'))).toBe(1); // komal Re  → R1
    expect(swarasthana(parseSwara('R'))).toBe(2); // shuddha Re → R2
    expect(swarasthana(parseSwara('g'))).toBe(2); // komal Ga  → G2
    expect(swarasthana(parseSwara('G'))).toBe(3); // shuddha Ga → G3
    expect(swarasthana(parseSwara('m'))).toBe(1); // shuddha Ma → M1
    expect(swarasthana(parseSwara('M'))).toBe(2); // tivra Ma   → M2
    expect(swarasthana(parseSwara('d'))).toBe(1); // komal Dha  → D1
    expect(swarasthana(parseSwara('N'))).toBe(3); // shuddha Ni → N3
    // Mayamalavagowla's swarasthanas, in order
    const maya = RAGA_BY_ID.get('mayamalavagowla')!;
    expect(maya.aroha.map(swarasthana)).toEqual([undefined, 1, 3, 1, undefined, 1, 3, undefined]);
  });
});

describe('tala', () => {
  it('sums beats and locates section starts', () => {
    const teental = TALA_BY_ID.get('teental')!;
    expect(talaMatras(teental)).toBe(16);
    expect(sectionStarts(teental)).toEqual([0, 4, 8, 12]);

    const adi = TALA_BY_ID.get('adi')!;
    expect(talaMatras(adi)).toBe(8);
    expect(sectionStarts(adi)).toEqual([0, 4, 6]);
  });
});

describe('composition — cells', () => {
  it('parses swaras, sustains, rests and skips barlines', () => {
    const cells = parseCells("S r | - ~ S,R");
    expect(cells.map((c) => c.kind)).toEqual(['swara', 'swara', 'sustain', 'rest', 'swara']);
    const sub = cells[4];
    expect(sub.kind === 'swara' && sub.swaras).toHaveLength(2);
  });

  it('rejects a section that is not a whole number of cycles', () => {
    const adi = TALA_BY_ID.get('adi')!;
    expect(() =>
      assertCycleAligned({ id: 'x', label: 'x', cells: parseCells('S r G') }, adi),
    ).toThrow();
  });
});

describe('seed data integrity', () => {
  it('every composition references a known raga + tala and is cycle-aligned', () => {
    for (const comp of COMPOSITIONS) {
      expect(RAGA_BY_ID.has(comp.ragaId), comp.id).toBe(true);
      const tala = TALA_BY_ID.get(comp.talaId);
      expect(tala, comp.id).toBeDefined();
      for (const section of comp.sections) assertCycleAligned(section, tala!);
    }
  });

  it('Yaman uses tivra Ma and the upper octave resolves on Sa', () => {
    const yaman = RAGA_BY_ID.get('yaman')!;
    expect(yaman.aroha.some((s) => s.name === 'M' && s.variant === 'tivra')).toBe(true);
    expect(yaman.aroha.at(-1)).toMatchObject({ name: 'S', register: 'taar' });
  });

  it('the first sarali varisai sounds eight swaras up then eight down', () => {
    const aroha = COMPOSITIONS.find((c) => c.id === 'sarali-varisai-1')!.sections[0];
    expect(sectionSwaras(aroha)).toHaveLength(8);
  });
});
