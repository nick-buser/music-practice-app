import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MidiRecorder, type MidiMessageLike } from './recorder';

const EPOCH = 1_700_000_000_000;

function noteOn(pitch: number, velocity: number, channel = 0): MidiMessageLike {
  return { data: new Uint8Array([0x90 | channel, pitch, velocity]) };
}

function noteOff(pitch: number, velocity = 0, channel = 0): MidiMessageLike {
  return { data: new Uint8Array([0x80 | channel, pitch, velocity]) };
}

function controlChange(controller: number, value: number, channel = 0): MidiMessageLike {
  return { data: new Uint8Array([0xb0 | channel, controller, value]) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MidiRecorder — origin', () => {
  it("'first-note' anchors t=0 to the first note-on, not to construction time", () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    vi.advanceTimersByTime(2000); // recorder sits armed for 2s before anything is played
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(300);
    recorder.handleMessage(noteOff(60));

    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 300 }]);
  });

  it("'external' anchors t=0 to the caller's t0Ms and never re-anchors on the first note", () => {
    const t0Ms = EPOCH - 500; // e.g. SR6's count-in downbeat, half a second before the recorder was told about it
    const recorder = new MidiRecorder({ origin: 'external', t0Ms, silenceTimeoutMs: null });

    recorder.handleMessage(noteOn(60, 100)); // now === EPOCH -> 500ms after t0Ms
    vi.advanceTimersByTime(200);
    recorder.handleMessage(noteOff(60));

    vi.advanceTimersByTime(100);
    recorder.handleMessage(noteOn(64, 90)); // a second note must not reset t0Ms
    vi.advanceTimersByTime(150);
    recorder.handleMessage(noteOff(64));

    expect(recorder.stop()).toEqual([
      { pitch: 60, velocity: 100, startMs: 500, durationMs: 200 },
      { pitch: 64, velocity: 90, startMs: 800, durationMs: 150 },
    ]);
  });

  it("constructing with origin 'external' and no t0Ms throws", () => {
    expect(() => new MidiRecorder({ origin: 'external', silenceTimeoutMs: null })).toThrow(
      /requires t0Ms/,
    );
  });
});

describe('MidiRecorder — note on/off handling', () => {
  it('a note-on with velocity 0 is treated as a note-off', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(150);
    recorder.handleMessage({ data: new Uint8Array([0x90, 60, 0]) }); // note-on, velocity 0

    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 150 }]);
  });

  it('an unmatched note-off (no prior note-on) is dropped, not fabricated into a note', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOff(60)); // dropped: no pending note-on, and doesn't anchor t0 either
    recorder.handleMessage(noteOn(64, 100)); // the real first note-on — t0 anchors here, at startMs 0
    vi.advanceTimersByTime(100);
    recorder.handleMessage(noteOff(64));

    expect(recorder.stop()).toEqual([{ pitch: 64, velocity: 100, startMs: 0, durationMs: 100 }]);
  });

  it('a note still held when stop() is called is closed off at that instant, not dropped', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(400);

    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 400 }]);
  });

  it('stop() is idempotent — a second call returns the same finalized list', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(200);
    recorder.handleMessage(noteOff(60));

    const first = recorder.stop();
    const second = recorder.stop();
    expect(second).toEqual(first);
  });

  it('a retrigger (note-on with no intervening note-off) replaces the pending start/velocity', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(100);
    recorder.handleMessage(noteOn(60, 110)); // retrigger — no note-off in between
    vi.advanceTimersByTime(50);
    recorder.handleMessage(noteOff(60));

    // Only one note: the retrigger's own onset/velocity, not the original.
    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 110, startMs: 100, durationMs: 50 }]);
  });

  it('ignores non-note messages (e.g. a control change) without recording a note or throwing', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(controlChange(64, 127)); // sustain pedal down
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(100);
    recorder.handleMessage(noteOff(60));

    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 100 }]);
  });

  it('handleMessage after stop() is a no-op', () => {
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: null });
    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(100);
    const stopped = recorder.stop();

    recorder.handleMessage(noteOn(64, 90)); // arrives after the recorder is done
    expect(recorder.stop()).toEqual(stopped);
  });
});

describe('MidiRecorder — silence timeout', () => {
  it('auto-stops and fires onSilenceTimeout after the configured idle period', () => {
    const onSilenceTimeout = vi.fn();
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: 10_000, onSilenceTimeout });

    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(300);
    recorder.handleMessage(noteOff(60));

    vi.advanceTimersByTime(9_999);
    expect(onSilenceTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSilenceTimeout).toHaveBeenCalledTimes(1);

    // Already finalized by the timeout — stop() just returns the same list.
    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 300 }]);
  });

  it('every message resets the idle countdown, not just note-ons', () => {
    const onSilenceTimeout = vi.fn();
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: 10_000, onSilenceTimeout });

    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(9_000);
    recorder.handleMessage(noteOff(60)); // resets the 10s countdown
    vi.advanceTimersByTime(9_000);
    expect(onSilenceTimeout).not.toHaveBeenCalled(); // 9s since the note-off, still under 10s

    vi.advanceTimersByTime(1_000);
    expect(onSilenceTimeout).toHaveBeenCalledTimes(1);
  });

  it('a note still held when the silence timer fires is closed off at that instant', () => {
    const onSilenceTimeout = vi.fn();
    const recorder = new MidiRecorder({ origin: 'first-note', silenceTimeoutMs: 10_000, onSilenceTimeout });

    recorder.handleMessage(noteOn(60, 100)); // never released
    vi.advanceTimersByTime(10_000);

    expect(onSilenceTimeout).toHaveBeenCalledTimes(1);
    expect(recorder.stop()).toEqual([{ pitch: 60, velocity: 100, startMs: 0, durationMs: 10_000 }]);
  });

  it('silenceTimeoutMs: null disables the timeout outright — no auto-stop no matter how long the wait', () => {
    const onSilenceTimeout = vi.fn();
    const recorder = new MidiRecorder({
      origin: 'external',
      t0Ms: EPOCH,
      silenceTimeoutMs: null,
      onSilenceTimeout,
    });

    vi.advanceTimersByTime(10 * 60 * 1000); // ten minutes of silence — SR6's whole point
    expect(onSilenceTimeout).not.toHaveBeenCalled();

    recorder.handleMessage(noteOn(60, 100));
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(onSilenceTimeout).not.toHaveBeenCalled();

    // Still recording normally — disabling silence doesn't disable capture.
    recorder.handleMessage(noteOff(60));
    expect(recorder.stop()).toHaveLength(1);
  });
});
