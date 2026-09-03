import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioRecorder } from './recorder';

// jsdom implements neither MediaRecorder nor navigator.mediaDevices — the
// exact "browser API missing" case `supported` exists to guard against
// (design notes: "MediaRecorder and getUserMedia may both be absent —
// older browsers, insecure contexts, and — importantly — jsdom under
// vitest"). These fakes stand in for both wherever a test opts in.

class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}

class FakeMediaStream {
  tracks: FakeTrack[];
  constructor(trackCount = 2) {
    this.tracks = Array.from({ length: trackCount }, () => new FakeTrack());
  }
  getTracks() {
    return this.tracks;
  }
}

class FakeMediaRecorder {
  static isTypeSupported(type: string): boolean {
    return type === 'audio/webm;codecs=opus';
  }

  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: FakeMediaStream,
    options?: { mimeType?: string },
  ) {
    // A browser that doesn't support the requested mime still reports
    // *something* via `.mimeType` — simulate that browser-default here.
    this.mimeType = options?.mimeType ?? 'audio/ogg';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['fake-audio-bytes'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function installMediaDevices(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  // jsdom has no `mediaDevices` of its own — remove ours so the next test
  // (including a default-environment one) sees the true "missing" baseline.
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
});

describe('useAudioRecorder — feature detection', () => {
  it('is unsupported in the default jsdom test environment (neither API present)', () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(false);
  });

  it('is unsupported when MediaRecorder exists but getUserMedia does not', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(false);
  });

  it('is unsupported when getUserMedia exists but MediaRecorder does not', () => {
    installMediaDevices(vi.fn());
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(false);
  });

  it('is supported when both APIs are present', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    installMediaDevices(vi.fn());
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(true);
  });
});

describe('useAudioRecorder — start/stop', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let stream: FakeMediaStream;

  beforeEach(() => {
    stream = new FakeMediaStream();
    getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    installMediaDevices(getUserMedia);
  });

  it('start() requests the mic and prefers audio/webm;codecs=opus; stop() resolves a Blob and releases every track', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.state).toBe('recording');
    expect(stream.tracks.every((t) => t.stopped)).toBe(false); // still live while recording

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(blob).toBeInstanceOf(Blob);
    expect((blob as unknown as Blob).type).toBe('audio/webm;codecs=opus');
    expect(result.current.state).toBe('idle');
    // Every track from the captured stream is released — a live mic
    // indicator that never goes away is the classic bug this guards.
    expect(stream.tracks.every((t) => t.stopped)).toBe(true);
  });

  it('falls back to the browser default mime when opus/webm is not reported as supported', async () => {
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeMediaRecorder {
        static isTypeSupported(): boolean {
          return false;
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    // Never hardcode a mime the recorder didn't actually produce.
    expect((blob as unknown as Blob).type).toBe('audio/ogg');
  });

  it('lands a getUserMedia permission denial in `error` and leaves the UI usable', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.state).toBe('idle'); // not an exception to leak — UI stays usable
  });

  it('releases every stream track on unmount mid-recording', async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(stream.tracks.every((t) => t.stopped)).toBe(false);

    unmount();

    expect(stream.tracks.every((t) => t.stopped)).toBe(true);
  });
});
