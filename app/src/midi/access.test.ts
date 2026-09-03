import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMidiInputs } from './access';

// jsdom implements no Web MIDI API at all — the exact "unsupported browser"
// case `status` exists to report distinctly from a permission denial (see
// access.ts's module docstring). These fakes stand in for
// `navigator.requestMIDIAccess`/`MIDIAccess`/`MIDIInput` wherever a test
// opts in, mirroring recorder.test.ts's (media/recorder.test.ts) fakes for
// the sibling getUserMedia/MediaRecorder surface.

class FakeMidiInput {
  onmidimessage: ((event: unknown) => void) | null = null;
  constructor(
    public id: string,
    public name: string | null,
  ) {}
}

class FakeMidiAccess {
  inputs = new Map<string, FakeMidiInput>();
  outputs = new Map<string, never>();
  sysexEnabled = false;
  onstatechange: ((event: unknown) => void) | null = null;
}

function installRequestMidiAccess(requestMIDIAccess: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'requestMIDIAccess', { value: requestMIDIAccess, configurable: true });
}

afterEach(() => {
  // jsdom has no `requestMIDIAccess` of its own — remove ours so the next
  // test (including a default-environment one) sees the true "missing"
  // baseline, same reasoning as media/recorder.test.ts's afterEach.
  delete (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess;
});

describe('useMidiInputs — feature detection', () => {
  it("is 'unsupported' in the default jsdom test environment", () => {
    const { result } = renderHook(() => useMidiInputs());
    expect(result.current.status).toBe('unsupported');
    expect(result.current.inputs).toEqual([]);
  });

  it('requestAccess() is a no-op when unsupported — never throws, status stays unsupported', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.status).toBe('unsupported');
    expect(result.current.error).toBeNull();
  });

  it("is 'idle' (not yet requested) when the API is present", () => {
    installRequestMidiAccess(vi.fn());
    const { result } = renderHook(() => useMidiInputs());
    expect(result.current.status).toBe('idle');
  });
});

describe('useMidiInputs — requestAccess', () => {
  let access: FakeMidiAccess;
  let requestMIDIAccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    access = new FakeMidiAccess();
    access.inputs.set('dev-1', new FakeMidiInput('dev-1', 'Test Keyboard'));
    requestMIDIAccess = vi.fn().mockResolvedValue(access);
    installRequestMidiAccess(requestMIDIAccess);
  });

  it('grants access and lists the device already connected at request time', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });

    expect(result.current.status).toBe('granted');
    expect(result.current.inputs).toEqual([{ id: 'dev-1', name: 'Test Keyboard' }]);
  });

  it('falls back to a non-null placeholder name for a device that reports none', async () => {
    access.inputs.set('dev-2', new FakeMidiInput('dev-2', null));
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });

    const nameless = result.current.inputs.find((d) => d.id === 'dev-2');
    expect(nameless?.name).toBe('MIDI input');
  });

  it('a device that connects after access was granted appears via statechange', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.inputs).toHaveLength(1);

    act(() => {
      access.inputs.set('dev-2', new FakeMidiInput('dev-2', 'Second Keyboard'));
      access.onstatechange?.({});
    });

    expect(result.current.inputs).toHaveLength(2);
    expect(result.current.inputs.map((d) => d.id).sort()).toEqual(['dev-1', 'dev-2']);
  });

  it('a permission denial lands in status/error distinctly from "unsupported"', async () => {
    requestMIDIAccess.mockRejectedValue(new DOMException('User declined', 'NotAllowedError'));
    const { result } = renderHook(() => useMidiInputs());

    await act(async () => {
      await result.current.requestAccess();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.status).not.toBe('unsupported'); // a different failure, a different UI state
    expect(result.current.error).toBeTruthy();
  });

  it('requestAccess() after granted is a no-op — does not re-request', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    await act(async () => {
      await result.current.requestAccess();
    });

    expect(requestMIDIAccess).toHaveBeenCalledTimes(1);
  });
});

describe('useMidiInputs — onMessage subscription and cleanup', () => {
  let access: FakeMidiAccess;
  let input: FakeMidiInput;

  beforeEach(() => {
    access = new FakeMidiAccess();
    input = new FakeMidiInput('dev-1', 'Test Keyboard');
    access.inputs.set('dev-1', input);
    installRequestMidiAccess(vi.fn().mockResolvedValue(access));
  });

  it('wires the registered handler to every currently-known input', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });

    const handler = vi.fn();
    act(() => {
      result.current.onMessage(handler);
    });

    const event = { data: new Uint8Array([0x90, 60, 100]) };
    input.onmidimessage?.(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('a device connecting after onMessage() is subscribed is wired to the same handler', async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    const handler = vi.fn();
    act(() => {
      result.current.onMessage(handler);
    });

    const second = new FakeMidiInput('dev-2', 'Second Keyboard');
    act(() => {
      access.inputs.set('dev-2', second);
      access.onstatechange?.({});
    });

    const event = { data: new Uint8Array([0x90, 61, 100]) };
    second.onmidimessage?.(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("the unsubscribe function returned by onMessage() detaches the handler", async () => {
    const { result } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    const handler = vi.fn();
    let unsubscribe: () => void = () => {};
    act(() => {
      unsubscribe = result.current.onMessage(handler);
    });
    act(() => unsubscribe());

    input.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]) });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unmounting clears every onmidimessage/onstatechange handler it installed', async () => {
    const { result, unmount } = renderHook(() => useMidiInputs());
    await act(async () => {
      await result.current.requestAccess();
    });
    act(() => {
      result.current.onMessage(vi.fn());
    });
    expect(input.onmidimessage).not.toBeNull();
    expect(access.onstatechange).not.toBeNull();

    unmount();

    expect(input.onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();
  });
});
