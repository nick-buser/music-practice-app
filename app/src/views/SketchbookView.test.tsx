import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Stub Verovio (too slow / unavailable in jsdom) — same approach as
// DrillsView.backend.test.tsx.
vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>score</span>
  ),
}));

// Simulate the PUBLIC/static build: no backend configured. This is the
// pinned mock path — app/e2e/stats-and-sketchbook.spec.ts asserts against
// this exact markup and cannot run on this machine, so this test is the only
// guard that the mock still renders unchanged.
vi.mock('../config', () => ({ backendEnabled: false, API_BASE_URL: null }));

import { SketchbookView } from './SketchbookView';

describe('SketchbookView on the public build (no backend)', () => {
  it('renders the mock: lyric markers, and the harmony tab chords + score', () => {
    render(<SketchbookView />);

    // Lyric tab is the default; it parses [section] markers — mirrors the
    // e2e spec's `.lyric-block .marker` count > 2 assertion.
    expect(document.querySelectorAll('.lyric-block .marker').length).toBeGreaterThan(2);

    // Harmony tab → 5 chord symbols + the (stubbed) engraved score.
    fireEvent.click(screen.getByRole('button', { name: 'Harmony' }));
    expect(document.querySelectorAll('.chord-row .chord')).toHaveLength(5);
    expect(screen.getByTestId('score-stub')).toBeInTheDocument();
  });

  it('renders the sketch grid used by the e2e spec\'s selectors', () => {
    render(<SketchbookView />);
    expect(document.querySelector('.sketch-grid')).toBeInTheDocument();
    expect(document.querySelector('.sketch-detail .tabs')).toBeInTheDocument();
  });
});
