import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { IdeaProperty } from '../api/client';
import { PropertiesPanel } from './PropertiesPanel';

function makeProperty(
  overrides: Partial<IdeaProperty> & Pick<IdeaProperty, 'id' | 'kind' | 'payload'>,
): IdeaProperty {
  return {
    confidence: null,
    timeRange: null,
    run: {
      id: 'run-1',
      subjectKind: 'idea',
      subjectId: 'idea:idea-1',
      inputSha256s: ['deadbeef'],
      extractor: 'midi-features',
      extractorVersion: '1.0.0',
      modelRef: null,
      executor: 'worker',
      params: {},
      paramsHash: 'hash',
      status: 'succeeded',
      startedAt: '2026-09-02T12:00:00Z',
      finishedAt: '2026-09-02T12:00:00Z',
      error: null,
      createdAt: '2026-09-02T11:59:00Z',
      updatedAt: '2026-09-02T12:00:00Z',
    },
    ...overrides,
  };
}

describe('PropertiesPanel', () => {
  it('renders "no extracted properties yet" when there are none', () => {
    render(<PropertiesPanel properties={[]} />);
    expect(screen.getByText('no extracted properties yet')).toBeInTheDocument();
  });

  it('renders a lineage badge per property, naming the extractor, version, and finish date', () => {
    const properties: IdeaProperty[] = [
      makeProperty({ id: 'p-key', kind: 'key_guess', payload: { key: 'F♯ minor' }, confidence: 0.82 }),
      makeProperty({ id: 'p-tempo', kind: 'tempo', payload: { bpm: 120 } }),
    ];

    render(<PropertiesPanel properties={properties} />);

    expect(screen.getByText(/key guess: F♯ minor/)).toBeInTheDocument();
    expect(screen.getByText(/tempo: 120 bpm/)).toBeInTheDocument();
    // One lineage badge per row, each naming the producer, its version, and
    // the run's finish date (PV3's own example: "midi-features 1.0.0 · 2 Sep").
    expect(screen.getAllByText(/midi-features 1\.0\.0 · 2 Sep/)).toHaveLength(2);
  });

  it('falls back to a generic reading for a kind this panel does not special-case', () => {
    const properties: IdeaProperty[] = [
      makeProperty({ id: 'p-unknown', kind: 'a-future-kind', payload: { anything: 'goes' } }),
    ];

    render(<PropertiesPanel properties={properties} />);

    expect(screen.getByText(/a-future-kind/)).toBeInTheDocument();
    expect(screen.getByText(/midi-features 1\.0\.0 · 2 Sep/)).toBeInTheDocument();
  });
});
