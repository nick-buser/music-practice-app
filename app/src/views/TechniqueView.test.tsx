import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TechniqueView } from './TechniqueView';

// Same reason as LibraryView: Verovio's WASM toolkit is too slow / not available
// in jsdom. Stub the Score component so we can test the rest of the view.
vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>
      score
    </span>
  ),
}));

describe('TechniqueView', () => {
  it('lands on Major scales and renders one card per scale', () => {
    render(<TechniqueView onStartSession={() => {}} />);

    expect(screen.getByRole('button', { name: /Major scales/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
  });

  it('shows the daily-routine list on the rail', () => {
    const { container } = render(<TechniqueView onStartSession={() => {}} />);
    const items = container.querySelectorAll('.routine-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('"Begin warmup" fires onStartSession with the first routine entry', () => {
    const onStartSession = vi.fn();
    render(<TechniqueView onStartSession={onStartSession} />);

    fireEvent.click(screen.getByRole('button', { name: /Begin warmup/i }));
    expect(onStartSession).toHaveBeenCalledTimes(1);
    expect(onStartSession).toHaveBeenCalledWith('c-major');
  });

  it('switching to Minor scales shows 12 cards and a Natural/Harmonic/Melodic sub-toggle', () => {
    render(<TechniqueView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Minor scales/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getByRole('button', { name: /Natural minor/i, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harmonic minor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Melodic minor/i })).toBeInTheDocument();
  });

  it('picking Harmonic minor swaps the visible 12 cards', () => {
    render(<TechniqueView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Minor scales/i }));
    fireEvent.click(screen.getByRole('button', { name: /Harmonic minor/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getByRole('button', { name: /Harmonic minor/i, pressed: true })).toBeInTheDocument();
  });

  it('Arpeggios tab shows 12 cards with a Major/Minor sub-toggle', () => {
    render(<TechniqueView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Arpeggios$/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getByRole('button', { name: /Major arpeggios/i, pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Minor arpeggios/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
  });
});
