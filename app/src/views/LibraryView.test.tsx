import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LibraryView } from './LibraryView';

// Verovio's WASM toolkit takes seconds to spin up — too slow for unit tests, and
// jsdom can't host it anyway. Replace <Score> with a sentinel so we can still
// assert the row-rendering behavior.
vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>
      score
    </span>
  ),
}));

describe('LibraryView', () => {
  it('renders one row per piece grouped by instrument', () => {
    const { container } = render(
      <LibraryView onOpenPiece={() => {}} onStartSession={() => {}} />,
    );

    // Group headers show real instrument labels — query within the groups so the
    // sidebar nav's "Piano" / "Voice" copies don't make these ambiguous.
    const groupNames = Array.from(
      container.querySelectorAll('.lib-group-head .name'),
    ).map((el) => el.textContent);
    expect(groupNames).toEqual(['Piano', 'Classical Guitar', 'Voice']);

    // One Score stub per piece (every row has a thumbnail).
    expect(screen.getAllByTestId('score-stub').length).toBeGreaterThanOrEqual(7);
  });

  it('filter chips narrow the list to one instrument', () => {
    const { container } = render(
      <LibraryView onOpenPiece={() => {}} onStartSession={() => {}} />,
    );

    const allCount = screen.getAllByTestId('score-stub').length;

    const voiceChip = container.querySelector('.filter-chip:nth-of-type(4)');
    expect(voiceChip?.textContent).toBe('Voice');
    fireEvent.click(voiceChip!);

    const voiceCount = screen.getAllByTestId('score-stub').length;
    expect(voiceCount).toBeLessThan(allCount);
    expect(voiceCount).toBe(1); // Only one voice piece in the mock data.

    // Only the Voice group is on screen now.
    const remainingGroups = Array.from(
      container.querySelectorAll('.lib-group-head .name'),
    ).map((el) => el.textContent);
    expect(remainingGroups).toEqual(['Voice']);
  });

  it('clicking a row calls onOpenPiece with the piece id', () => {
    const onOpenPiece = vi.fn();
    render(<LibraryView onOpenPiece={onOpenPiece} onStartSession={() => {}} />);

    // First piece in the data is the Chopin nocturne.
    const titleEl = screen.getByText(/Nocturne in E♭ major/);
    const row = titleEl.closest('.piece-row');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(onOpenPiece).toHaveBeenCalledWith('chopin-9-2');
  });

  it('clicking the row play button starts a session without opening the piece', () => {
    const onOpenPiece = vi.fn();
    const onStartSession = vi.fn();
    render(<LibraryView onOpenPiece={onOpenPiece} onStartSession={onStartSession} />);

    const titleEl = screen.getByText(/Nocturne in E♭ major/);
    const row = titleEl.closest('.piece-row') as HTMLElement;
    const playBtn = within(row).getByRole('button', { name: /Begin session/i });
    fireEvent.click(playBtn);

    expect(onStartSession).toHaveBeenCalledWith('chopin-9-2');
    expect(onOpenPiece).not.toHaveBeenCalled();
  });
});
