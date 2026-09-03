import { describe, expect, it } from 'vitest';
import { resolveSubject, subjectFromIdea, type IdeaSubjectSource } from './subject';

function makeIdeaSource(overrides: Partial<IdeaSubjectSource> & Pick<IdeaSubjectSource, 'id' | 'handle'>): IdeaSubjectSource {
  return {
    title: null,
    kinds: [],
    meter: null,
    bpm: null,
    ...overrides,
  };
}

describe('resolveSubject', () => {
  it('returns a piece subject for a piece id', () => {
    const s = resolveSubject('chopin-9-2');
    expect(s.kind).toBe('piece');
    expect(s.title).toMatch(/Nocturne/);
    expect(s.byline).toContain('Chopin');
    expect(s.hasPieceDetail).toBe(true);
    expect(s.sections.length).toBeGreaterThan(0);
  });

  it('returns a scale subject for a scale id', () => {
    const s = resolveSubject('c-major');
    expect(s.kind).toBe('scale');
    expect(s.title).toBe('C major');
    expect(s.byline).toBe('major scale');
    expect(s.subtitle).toContain('C');
    expect(s.hasPieceDetail).toBe(false);
    expect(s.sections).toHaveLength(0);
    expect(s.meter).toBe('4/4');
  });

  it('uses the right byline for each scale family', () => {
    expect(resolveSubject('a-natural-minor').byline).toBe('natural minor scale');
    expect(resolveSubject('a-harmonic-minor').byline).toBe('harmonic minor scale');
    expect(resolveSubject('a-melodic-minor').byline).toContain('melodic');
    expect(resolveSubject('c-major-arp').byline).toBe('major arpeggio');
    expect(resolveSubject('a-minor-arp').byline).toBe('minor arpeggio');
  });

  it('resolves a Japanese pentatonic scale', () => {
    const s = resolveSubject('c-hirajoshi');
    expect(s.kind).toBe('scale');
    expect(s.title).toBe('C Hirajōshi');
    expect(s.byline).toBe('Hirajōshi · pentatonic');
    expect(s.abc).toContain('K:C');
  });

  it('resolves a voiced chord id to a voiced subject', () => {
    const s = resolveSubject('c-maj7-chord~inv1');
    expect(s.kind).toBe('scale');
    expect(s.title).toBe('Cmaj7/E');
    expect(s.byline).toContain('1st inversion');
    expect(s.id).toBe('c-maj7-chord~inv1');
    expect(s.abc).toContain('K:C');
  });

  it('resolves a bare chord id to its root voicing', () => {
    const s = resolveSubject('c-maj7-chord');
    expect(s.title).toBe('Cmaj7');
    expect(s.byline).not.toContain('inversion');
  });

  it('falls back to the first piece for an unknown id', () => {
    const s = resolveSubject('not-a-real-id');
    expect(s.kind).toBe('piece');
    expect(s.title).toBeTruthy();
  });

  it('carries an ABC engraving and a positive target bpm', () => {
    for (const id of ['chopin-9-2', 'c-major', 'a-natural-minor', 'c-major-arp']) {
      const s = resolveSubject(id);
      expect(s.abc).toBeDefined();
      expect(s.abc!.length).toBeGreaterThan(0);
      expect(s.bpmTarget).toBeGreaterThan(0);
    }
  });
});

describe('subjectFromIdea', () => {
  it('a titled idea uses the title verbatim and joins kinds into the byline', () => {
    const s = subjectFromIdea(makeIdeaSource({
      id: 'aaaa-bbbb', handle: 7, title: 'A chorus in D', kinds: ['melody', 'lyric'],
    }));
    expect(s.id).toBe('idea:aaaa-bbbb');
    expect(s.kind).toBe('idea');
    expect(s.title).toBe('A chorus in D');
    expect(s.byline).toBe('melody, lyric');
    expect(s.hasPieceDetail).toBe(false);
    expect(s.abc).toBeUndefined();
    expect(s.sections).toHaveLength(0);
  });

  it('an untitled idea falls back to its handle, not the ideaHeadline body-line fallback', () => {
    const s = subjectFromIdea(makeIdeaSource({ id: 'cccc-dddd', handle: 42, title: null }));
    expect(s.title).toBe('#42');
  });

  it('an untitled idea with an empty-string title also falls back to its handle', () => {
    const s = subjectFromIdea(makeIdeaSource({ id: 'eeee-ffff', handle: 3, title: '' }));
    expect(s.title).toBe('#3');
  });

  it('defaults meter to 4/4 and bpm to 80 when the idea has neither', () => {
    const s = subjectFromIdea(makeIdeaSource({ id: 'g', handle: 1, meter: null, bpm: null }));
    expect(s.meter).toBe('4/4');
    expect(s.bpmTarget).toBe(80);
    expect(s.bpmCurrent).toBe(80);
  });

  it('uses the idea\'s own meter and bpm when both are set', () => {
    const s = subjectFromIdea(makeIdeaSource({ id: 'h', handle: 2, meter: '3/4', bpm: 96 }));
    expect(s.meter).toBe('3/4');
    expect(s.bpmTarget).toBe(96);
    expect(s.bpmCurrent).toBe(96);
  });

  it('an idea with no kinds gets an empty byline rather than throwing', () => {
    const s = subjectFromIdea(makeIdeaSource({ id: 'i', handle: 9, kinds: [] }));
    expect(s.byline).toBe('');
  });
});
