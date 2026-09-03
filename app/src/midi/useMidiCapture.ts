/**
 * SB7's "arm → record → stop-button-or-silence-timeout → encode" state
 * machine for one "Record MIDI" button, decoupled from where the resulting
 * `.mid` file ends up. The scope line this satisfies (grooming doc) is
 * explicit that there are *two* destinations for the same take: a new
 * inbox idea from the stream's quick-capture box (`SketchbookLive`), or a
 * new revision on whatever idea is already open (`AttachmentsPanel`, via
 * `IdeaPage`). Both call this hook with a different `onCaptured` and
 * nothing else differs — `handleCapture`/`uploadIdeaAsset` already exist
 * for the actual upload (design guidance: "do not write a second upload
 * implementation"), and this hook doesn't touch either; it only ever hands
 * `onCaptured` a finished `File`.
 *
 * Composes `useMidiInputs` (device access) + `MidiRecorder` (note
 * collection) + `encodeSmf` (the `.mid` bytes) — see each of those
 * modules' own docstrings for why they're shaped the way they are.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMidiInputs, type MidiAccessStatus } from './access';
import { MidiRecorder } from './recorder';
import { encodeSmf } from './smf';

/** How long the capture box waits after the last MIDI message before
 *  auto-stopping a take — long enough that a thinking pause mid-phrase
 *  doesn't cut the recording, short enough that walking away from the
 *  keyboard doesn't leave it armed indefinitely. */
const SILENCE_TIMEOUT_MS = 10_000;

export interface MidiCaptureState {
  /** Mirrors `useMidiInputs`'s status — `'unsupported'` means the caller
   *  should render no button at all. */
  status: MidiAccessStatus;
  error: string | null;
  /** A take is currently armed and listening. */
  recording: boolean;
  /** The permission prompt is in flight (between a click and the browser
   *  resolving it) — button should show a transitional label and ignore
   *  further clicks. */
  armPending: boolean;
  /** A finished take is being encoded/handed to `onCaptured`. */
  busy: boolean;
  /** The one click handler a "Record MIDI"/"stop" button needs: arms on
   *  the first click (requesting access first if it hasn't been granted
   *  yet), stops and finalizes on the next. */
  toggle: () => void;
}

/**
 * @param onCaptured Given the encoded `.mid` file for a finished take with
 *   at least one note. Never called for a take with zero notes (armed, then
 *   stopped without playing anything) — there's nothing to attach.
 */
export function useMidiCapture(onCaptured: (file: File) => Promise<void>): MidiCaptureState {
  const midi = useMidiInputs();
  const recorderRef = useRef<MidiRecorder | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured; // always the latest closure, without re-arming on every render

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  // True from the click that fires the permission prompt until it resolves
  // (arm for real) or is declined — guards a second click re-firing
  // `requestAccess` while the browser's own prompt is already open.
  const [armPending, setArmPending] = useState(false);

  const finish = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const notes = recorder.stop();
    setRecording(false);
    if (notes.length === 0) return; // nothing played — nothing to attach
    setBusy(true);
    try {
      // `MidiRecorder` only ever produces pitches/velocities already inside
      // `encodeSmf`'s accepted ranges (a note-on with velocity 0 is
      // normalised to a note-off on the way in — see recorder.ts), so this
      // can't fail on the shape of `notes` itself.
      const bytes = encodeSmf({ notes });
      const file = new File([bytes], `capture-${Date.now()}.mid`, { type: 'audio/midi' });
      await onCapturedRef.current(file);
    } finally {
      setBusy(false);
    }
  }, []);

  const arm = useCallback(() => {
    if (recorderRef.current) return; // already armed/recording
    const recorder = new MidiRecorder({
      origin: 'first-note',
      silenceTimeoutMs: SILENCE_TIMEOUT_MS,
      onSilenceTimeout: () => void finish(),
    });
    recorderRef.current = recorder;
    unsubscribeRef.current = midi.onMessage((event) => recorder.handleMessage(event));
    setRecording(true);
  }, [midi, finish]);

  // `requestAccess()` is async, but the `status` it produces only reaches
  // this hook on the *next* render — a closure captured at click time would
  // still see the pre-request value. Arming waits for that render via this
  // effect instead of reading `midi.status` right after the await.
  useEffect(() => {
    if (!armPending) return;
    if (midi.status === 'granted') {
      setArmPending(false);
      arm();
    } else if (midi.status === 'denied') {
      setArmPending(false);
    }
  }, [armPending, midi.status, arm]);

  const toggle = useCallback(() => {
    if (recording) {
      void finish();
      return;
    }
    if (midi.status === 'granted') {
      arm();
    } else {
      setArmPending(true);
      void midi.requestAccess();
    }
  }, [recording, midi, arm, finish]);

  // Unmount mid-recording: drop the subscription and the recorder's own
  // silence timer rather than let either outlive the caller — an armed
  // `setTimeout` firing after unmount would call `finish()` (and so
  // `onCaptured`) against a component that's gone.
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  return { status: midi.status, error: midi.error, recording, armPending, busy, toggle };
}
