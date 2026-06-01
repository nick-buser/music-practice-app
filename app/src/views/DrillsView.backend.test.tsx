import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Stub Verovio (too slow / unavailable in jsdom).
vi.mock('../verovio/Score', () => ({
  Score: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span data-testid="score-stub" aria-label={ariaLabel}>score</span>
  ),
}));

// Simulate the LOCAL build: a backend is configured.
vi.mock('../config', () => ({ backendEnabled: true, API_BASE_URL: 'http://test' }));

// Mock the chords API so the feature exercises the hook/UI without a server.
const listSavedChords = vi.fn();
const saveChord = vi.fn();
const deleteSavedChord = vi.fn();
vi.mock('../api/chords', () => ({
  listSavedChords: () => listSavedChords(),
  saveChord: (identity: unknown, label: string) => saveChord(identity, label),
  deleteSavedChord: (id: string) => deleteSavedChord(id),
}));

import { DrillsView } from './DrillsView';

describe('DrillsView with a backend (local build)', () => {
  beforeEach(() => {
    listSavedChords.mockReset().mockResolvedValue([]);
    saveChord.mockReset().mockResolvedValue({ id: 'x', label: 'C major chord', identity: {} });
    deleteSavedChord.mockReset().mockResolvedValue(undefined);
  });

  it('shows the Saved-chords panel and a Save button per chord card', async () => {
    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));

    expect(await screen.findByTestId('saved-chords')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /save/i })).toHaveLength(12);
  });

  it('saving a chord calls the API with its identity + label, then refreshes', async () => {
    listSavedChords
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValue([{ id: 'x', label: 'C major chord', identity: {} }]); // after save

    render(<DrillsView onStartSession={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Chords$/i }));

    const saveButtons = await screen.findAllByRole('button', { name: /save/i });
    fireEvent.click(saveButtons[0]); // first card = C major

    await waitFor(() => expect(saveChord).toHaveBeenCalledTimes(1));
    const [identity, label] = saveChord.mock.calls[0];
    expect(label).toBe('C major chord');
    expect((identity as { root: { letter: string } }).root.letter).toBe('C');

    // List refreshed → the saved chord shows up in the panel (not just the card).
    const panel = await screen.findByTestId('saved-chords');
    expect(await within(panel).findByText('C major chord')).toBeInTheDocument();
  });

  it('does not fetch saved chords until the Chords tab is opened', () => {
    render(<DrillsView onStartSession={() => {}} />);
    expect(listSavedChords).not.toHaveBeenCalled(); // lands on Scales
  });
});
