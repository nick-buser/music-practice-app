import { describe, expect, it } from 'vitest';
import { resolveSubject } from './subject';

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
