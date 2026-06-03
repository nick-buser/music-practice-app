import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorldNotationView } from './WorldNotationView';

describe('WorldNotationView', () => {
  it('opens on Hindustani with the Yaman raga and its sargam exercise', () => {
    render(<WorldNotationView />);
    expect(screen.getByRole('heading', { name: 'Yaman' })).toBeTruthy();
    expect(screen.getByText('Yaman — Sargam Practice')).toBeTruthy();
    // Aroha line is engraved as native sargam, not staff.
    expect(screen.getByRole('img', { name: 'Yaman aroha' })).toBeTruthy();
  });

  it('switches tradition to Carnatic and shows the sarali varisai', () => {
    render(<WorldNotationView />);
    fireEvent.click(screen.getByRole('button', { name: 'Carnatic' }));
    expect(screen.getByRole('heading', { name: /Māyāmāḷavagowḷa/ })).toBeTruthy();
    expect(screen.getByText('Sarali Varisai — 1st')).toBeTruthy();
    // The Hindustani piece is gone once we leave that tradition.
    expect(screen.queryByText('Yaman — Sargam Practice')).toBeNull();
  });

  it('always shows the how-to-read legend', () => {
    render(<WorldNotationView />);
    const legend = screen.getByRole('heading', { name: 'Reading the notation' }).closest('.card');
    expect(legend).toBeTruthy();
    expect(within(legend as HTMLElement).getByText(/komal/)).toBeTruthy();
  });
});
