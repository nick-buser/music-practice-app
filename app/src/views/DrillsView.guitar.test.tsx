import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>score</span>
  ),
}));
// The guitar renderers can't run in jsdom; stub them and assert the wiring.
vi.mock('../components/GuitarChord', () => ({
  GuitarChord: ({ name }: { name: string }) => <span data-testid="guitar-chord">{name}</span>,
}));
vi.mock('../components/GuitarScale', () => ({
  GuitarScale: ({ family }: { family: string }) => <span data-testid="guitar-scale">{family}</span>,
}));

import { DrillsView } from './DrillsView';

describe('DrillsView — guitar notation', () => {
  it('switches scale cards to fretboard diagrams', () => {
    render(<DrillsView onStartSession={() => {}} />);
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12); // Scales / Staff

    fireEvent.click(screen.getByRole('button', { name: /^Guitar$/i }));
    expect(screen.getAllByTestId('guitar-scale')).toHaveLength(12);
    expect(screen.queryAllByTestId('score-stub')).toHaveLength(0);
  });

  it('shows chord grips for supported types, staff fallback for unsupported', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Guitar$/i }));

    // Major triad has a guitar grip.
    expect(screen.getAllByTestId('guitar-chord')).toHaveLength(12);
    expect(screen.queryAllByTestId('score-stub')).toHaveLength(0);

    // maj7♯11 isn't in chords-db → falls back to the staff.
    fireEvent.click(screen.getByRole('button', { name: 'maj7♯11' }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.queryAllByTestId('guitar-chord')).toHaveLength(0);
  });

  it('staff notation keeps the engraving (no guitar)', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.queryAllByTestId('guitar-chord')).toHaveLength(0);
  });
});
