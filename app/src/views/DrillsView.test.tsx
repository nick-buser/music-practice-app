import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrillsView } from './DrillsView';

// Verovio's WASM toolkit is too slow / not available in jsdom. Stub the Score
// component so we can test the rest of the view.
vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>
      score
    </span>
  ),
}));

describe('DrillsView', () => {
  it('lands on Scales → Major and renders 12 cards', () => {
    render(<DrillsView onStartSession={() => {}} />);

    expect(screen.getByRole('button', { name: /^Scales$/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /^Major$/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
  });

  it('switching to Scales → Harmonic minor swaps the 12 visible cards', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Harmonic minor/i }));
    expect(screen.getByRole('button', { name: /Harmonic minor/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
  });

  it('Arpeggios tab shows 12 cards with a Major/Minor sub-toggle', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Arpeggios$/i }));
    expect(screen.getByRole('button', { name: /Major arpeggios/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: /Minor arpeggios/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
  });

  it('Chords tab shows 12 major triad cards by default', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    // The Major pill inside the Triads row is pressed.
    expect(screen.getByRole('button', { name: /^Major$/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/major triad/i).length).toBe(12);
  });

  it('Chords → Minor swaps to 12 minor-triad cards', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Minor$/i }));
    expect(screen.getByRole('button', { name: /^Minor$/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/minor triad/i).length).toBe(12);
  });

  it('Chords → Maj7 swaps to 12 major-7 chord cards', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Maj7$/i }));
    expect(screen.getByRole('button', { name: /^Maj7$/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/major 7/i).length).toBeGreaterThanOrEqual(12);
  });

  it('Chords → Dom7 swaps to 12 dominant-7 chord cards', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Dom7$/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/dominant 7/i).length).toBeGreaterThanOrEqual(12);
  });

  it('Chord type picker shows a category label per row (Triads / 7ths / 9ths)', () => {
    const { container } = render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));
    const labels = Array.from(container.querySelectorAll('.chord-type-row .cat-label')).map(
      (e) => e.textContent,
    );
    expect(labels).toEqual(['Triads', '7ths', '9ths']);
  });

  it('Chords → Maj9 / Dom9 / Min9 each swap to 12 cards with the right subtitle', () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^Maj9$/i }));
    expect(screen.getByRole('button', { name: /^Maj9$/i, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/major 9/i).length).toBeGreaterThanOrEqual(12);

    fireEvent.click(screen.getByRole('button', { name: /^Dom9$/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/dominant 9/i).length).toBeGreaterThanOrEqual(12);

    fireEvent.click(screen.getByRole('button', { name: /^Min9$/i }));
    expect(screen.getAllByTestId('score-stub')).toHaveLength(12);
    expect(screen.getAllByText(/minor 9/i).length).toBeGreaterThanOrEqual(12);
  });

  it('shows the daily-routine list on the rail', () => {
    const { container } = render(<DrillsView onStartSession={() => {}} />);
    const items = container.querySelectorAll('.routine-item');
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('"Begin warmup" fires onStartSession with the first routine entry', () => {
    const onStartSession = vi.fn();
    render(<DrillsView onStartSession={onStartSession} />);
    fireEvent.click(screen.getByRole('button', { name: /Begin warmup/i }));
    expect(onStartSession).toHaveBeenCalledTimes(1);
    expect(onStartSession).toHaveBeenCalledWith('c-major');
  });

  it('"Run it →" on a chord card fires onStartSession with the chord id', () => {
    const onStartSession = vi.fn();
    render(<DrillsView onStartSession={onStartSession} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));

    // First chord card is C major chord; its "Run it →" button.
    const runButtons = screen.getAllByRole('button', { name: /Run it/i });
    fireEvent.click(runButtons[0]);
    expect(onStartSession).toHaveBeenCalledWith('c-major-chord');
  });
});
