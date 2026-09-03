/**
 * Audio capture over `getUserMedia` + `MediaRecorder` — the app's first
 * `getUserMedia` surface (RC2, docs/sketchbook.md's practice-capture
 * follow-on). Both APIs may be absent (older browsers, insecure contexts,
 * and — importantly — jsdom under vitest, which has neither), so support is
 * exposed as a first-class `supported` flag rather than something a caller
 * has to probe or that throws on click. Neither API is ever touched at
 * module scope or during render — only inside `start()`, which fires from a
 * user gesture.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderPhase = 'idle' | 'recording' | 'stopping';

export interface AudioRecorderState {
  /** False when `MediaRecorder` or `navigator.mediaDevices.getUserMedia` is
   *  unavailable in this browser/context — the record control simply
   *  doesn't render rather than crashing on click. */
  supported: boolean;
  state: RecorderPhase;
  /** Milliseconds since `start()` began; resets to 0 once idle again. */
  elapsedMs: number;
  /** A permission denial or recorder failure — a normal outcome, not a
   *  thrown exception. The UI stays usable; callers surface this. */
  error: string | null;
  start: () => Promise<void>;
  /** Stops the recorder, releases every track of the mic stream, and
   *  resolves with the captured audio. Resolves `null` if nothing was
   *  recording (e.g. permission was never granted). */
  stop: () => Promise<Blob | null>;
}

/** Preferred container/codec; `MediaRecorder` falls back to its own default
 *  (reported via `recorder.mimeType`, which the produced Blob's type
 *  always honours) when this isn't supported. */
const PREFERRED_MIME = 'audio/webm;codecs=opus';
const ELAPSED_TICK_MS = 100;

function detectSupport(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return MediaRecorder.isTypeSupported(PREFERRED_MIME) ? PREFERRED_MIME : undefined;
}

export function useAudioRecorder(): AudioRecorderState {
  // Detected once, lazily, on the client — never at module scope, where
  // SSR/build time and jsdom-under-vitest have no `navigator`/`MediaRecorder`
  // at all.
  const [supported] = useState(detectSupport);
  const [state, setState] = useState<RecorderPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const mountedRef = useRef(true);

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Release every track from the captured stream — a live mic indicator
  // that never goes away is the classic bug here. Idempotent: safe to call
  // more than once (unmount-mid-recording calls this, then `onstop` fires
  // and calls it again).
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTick();
      // Stop mid-recording on unmount so the stream — and the OS mic
      // indicator — doesn't outlive the component.
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseStream();
    };
  }, [clearTick, releaseStream]);

  const start = useCallback(async () => {
    if (!supported || state !== 'idle') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        // Unmounted while the permission prompt was pending — don't leave
        // the mic live for a component that's gone.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        // Never hardcode a mime the recorder didn't actually produce.
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        releaseStream();
        clearTick();
        if (mountedRef.current) {
          setState('idle');
          setElapsedMs(0);
        }
        stopResolveRef.current?.(blob);
        stopResolveRef.current = null;
      };
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      recorder.start();
      setState('recording');
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, ELAPSED_TICK_MS);
    } catch (err) {
      // Permission denial is a normal outcome, not an exception to leak —
      // it lands in `error` and the UI stays usable.
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Microphone access was denied.');
        setState('idle');
      }
      releaseStream();
    }
  }, [supported, state, releaseStream, clearTick]);

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    setState('stopping');
    return new Promise<Blob | null>((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { supported, state, elapsedMs, error, start, stop };
}
