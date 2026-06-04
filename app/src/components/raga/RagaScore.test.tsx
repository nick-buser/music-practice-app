import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { COMPOSITION_BY_ID } from '../../data/raga/composition';
import { parsePhrase } from '../../data/raga/swara';
import { TALA_BY_ID } from '../../data/raga/tala';
import { CompositionScore, PhraseLine } from './RagaScore';

const texts = (root: ParentNode, sel: string) =>
  Array.from(root.querySelectorAll(sel)).map((n) => n.textContent);

describe('PhraseLine', () => {
  it('draws one letter per swara with the base (upper-case) name', () => {
    const { container } = render(<PhraseLine phrase={parsePhrase(".N R G M D N S'")} />);
    expect(texts(container, '.raga-letter')).toEqual(['N', 'R', 'G', 'M', 'D', 'N', 'S']);
  });

  it('marks komal with an underline and tivra with an overline', () => {
    const { container } = render(<PhraseLine phrase={parsePhrase('r g M')} />);
    expect(container.querySelectorAll('.komal-line')).toHaveLength(2); // r, g
    expect(container.querySelectorAll('.tivra-line')).toHaveLength(1); // M
  });

  it('marks octave registers with a dot (mandra + taar, not madhya)', () => {
    const { container } = render(<PhraseLine phrase={parsePhrase(".P S S'")} />);
    expect(container.querySelectorAll('.octave-dot')).toHaveLength(2);
  });

  it('labels Carnatic swaras with a swarasthana subscript instead of komal marks', () => {
    const { container } = render(
      <PhraseLine phrase={parsePhrase("S r G m P d N S'")} system="carnatic" />,
    );
    // R1 G3 M1 D1 N3 — Sa/Pa/Sa' carry no index
    expect(texts(container, '.swarasthana-num')).toEqual(['1', '3', '1', '1', '3']);
    // Carnatic uses the index, never the komal/tivra lines
    expect(container.querySelectorAll('.komal-line, .tivra-line')).toHaveLength(0);
  });
});

describe('CompositionScore', () => {
  const tala = TALA_BY_ID.get('teental')!;
  const section = COMPOSITION_BY_ID.get('yaman-sargam')!.sections[0];

  it('lays the Tintal markers out as × 2 ○ 3', () => {
    const { container } = render(<CompositionScore section={section} tala={tala} />);
    expect(texts(container, '.tala-marker')).toEqual(['×', '2', '○', '3']);
  });

  it('renders one SVG row per tala cycle', () => {
    const { container } = render(<CompositionScore section={section} tala={tala} />);
    // 16 matras / 16-beat cycle = one row.
    expect(container.querySelectorAll('svg.grid')).toHaveLength(1);
  });

  it('highlights the active matra with a single cursor rect', () => {
    const { container } = render(<CompositionScore section={section} tala={tala} activeMatra={2} />);
    expect(container.querySelectorAll('.matra-cursor')).toHaveLength(1);
  });

  it('uses Carnatic anga markers for Adi tala', () => {
    const adi = TALA_BY_ID.get('adi')!;
    const sarali = COMPOSITION_BY_ID.get('sarali-varisai-1')!.sections[0];
    const { container } = render(<CompositionScore section={sarali} tala={adi} />);
    expect(texts(container, '.tala-marker')).toEqual(['×', 'O', 'O']);
  });

  it('renders Devanagari numerals for tali in devanagari script', () => {
    const { container } = render(<CompositionScore section={section} tala={tala} script="devanagari" />);
    expect(texts(container, '.tala-marker')).toEqual(['×', '२', '○', '३']);
  });
});

describe('script', () => {
  it('spells swaras in Devanagari when asked', () => {
    const { container } = render(<PhraseLine phrase={parsePhrase('S R G')} script="devanagari" />);
    expect(texts(container, '.raga-letter')).toEqual(['सा', 'रे', 'ग']);
  });

  it('defaults to Roman letters', () => {
    const { container } = render(<PhraseLine phrase={parsePhrase('S R G')} />);
    expect(texts(container, '.raga-letter')).toEqual(['S', 'R', 'G']);
  });
});
