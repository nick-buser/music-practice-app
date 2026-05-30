import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library no longer auto-cleans up with Vitest's globals.
afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver — the chart layout hook needs one.
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}
