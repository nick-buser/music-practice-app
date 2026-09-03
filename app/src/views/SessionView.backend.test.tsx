import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate the LOCAL build: a backend is configured — same convention as
// DrillsView.backend.test.tsx.
vi.mock('../config', () => ({ backendEnabled: true, API_BASE_URL: 'http://test' }));

// Stub Verovio (too slow / unavailable in jsdom) — same idiom as DrillsView.
vi.mock('../verovio/SessionScore', () => ({
  SessionScore: () => <span data-testid="session-score-stub" />,
}));

// Mock the recordings API so the capture flow exercises the hook/UI without
// a server, same shape as SketchbookLive.test.tsx's `../api/ideas` mock.
const listRecordings = vi.fn();
const getRecording = vi.fn();
const createRecording = vi.fn();
const uploadRecordingTrack = vi.fn();
vi.mock('../api/recordings', () => ({
  listRecordings: (...args: unknown[]) => listRecordings(...args),
  getRecording: (...args: unknown[]) => getRecording(...args),
  createRecording: (...args: unknown[]) => createRecording(...args),
  uploadRecordingTrack: (...args: unknown[]) => uploadRecordingTrack(...args),
  recordingTrackContentUrl: (recordingId: string, trackId: string) =>
    `http://test/v1/recordings/${recordingId}/tracks/${trackId}/content`,
}));

import { SessionView } from './SessionView';

// jsdom has no Web Audio; a minimal fake lets useMetronome's scheduler run
// silently (SessionView starts with `playing: true`) — same idiom as
// CompositionPlayer.test.tsx.
class FakeNode {
  connect(node: unknown) {
    return node;
  }
}
class FakeOsc extends FakeNode {
  frequency = { value: 0 };
  start() {}
  stop() {}
}
class FakeGain extends FakeNode {
  gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
}
class FakeAudioContext {
  currentTime = 0;
  destination = new FakeNode();
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return new FakeOsc();
  }
  createGain() {
    return new FakeGain();
  }
}

// A fake mic + recorder — jsdom implements neither MediaRecorder nor
// getUserMedia, which is exactly RC2's "browser API missing" case.
class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}
class FakeMediaStream {
  tracks = [new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
}
class FakeMediaRecorder {
  static isTypeSupported(type: string) {
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
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['take-bytes'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function makeRecording(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    capturedAt: '2026-09-02T12:00:00Z',
    createdAt: '2026-09-02T12:00:00Z',
    updatedAt: '2026-09-02T12:00:00Z',
    durationMs: null,
    notes: null,
    sessionId: null,
    subjectId: 'chopin-9-2',
    subjectKind: 'piece',
    tracks: [],
    ...overrides,
  };
}

describe('SessionView with a backend (local build)', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    listRecordings.mockReset().mockResolvedValue([]);
    getRecording.mockReset();
    createRecording.mockReset().mockResolvedValue(makeRecording());
    uploadRecordingTrack.mockReset().mockResolvedValue({
      id: 'track-1',
      recordingId: 'rec-1',
      kind: 'audio',
      mime: 'audio/webm;codecs=opus',
      bytes: 9,
      offsetMs: 0,
      sha256: 'deadbeef',
      storageKey: 'key',
      createdAt: '2026-09-02T12:00:00Z',
      updatedAt: '2026-09-02T12:00:00Z',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
  });

  it('has no record control when MediaRecorder/getUserMedia are unavailable (jsdom default), even with a backend', () => {
    render(<SessionView subjectId="chopin-9-2" onEnd={() => {}} onOpenPiece={() => {}} />);
    expect(screen.queryByRole('button', { name: /record a take/i })).not.toBeInTheDocument();
  });

  it('start → stop uploads the captured Blob as an audio track on a new recording for the current subject', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(new FakeMediaStream());
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    render(<SessionView subjectId="chopin-9-2" onEnd={() => {}} onOpenPiece={() => {}} />);

    const recordBtn = screen.getByRole('button', { name: /record a take/i });
    fireEvent.click(recordBtn);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    const stopBtn = await screen.findByRole('button', { name: /stop recording/i });
    fireEvent.click(stopBtn);

    await waitFor(() => expect(createRecording).toHaveBeenCalledTimes(1));
    expect(createRecording).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'chopin-9-2', subjectKind: 'piece' }),
    );

    await waitFor(() => expect(uploadRecordingTrack).toHaveBeenCalledTimes(1));
    const [recordingId, blob, kind] = uploadRecordingTrack.mock.calls[0] as [string, Blob, string];
    expect(recordingId).toBe('rec-1'); // the recording createRecording resolved
    expect(blob).toBeInstanceOf(Blob);
    expect(kind).toBe('audio');
  });
});
