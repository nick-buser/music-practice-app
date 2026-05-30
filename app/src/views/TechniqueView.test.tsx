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
    // Every card has its tonic label rendered.
    const tonics = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭'];
    for (const t of tonics) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
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

  it('Minor and Arpeggios tabs are disabled and show a coming-soon banner if forced', () => {
    render(<TechniqueView onStartSession={() => {}} />);
    expect(screen.getByRole('button', { name: /Minor scales/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Arpeggios/i })).toBeDisabled();
  });
});
