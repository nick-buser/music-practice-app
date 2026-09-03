/**
 * Web MIDI device access — SB7's counterpart to `media/recorder.ts`'s
 * `useAudioRecorder` (this hook's structural precedent: `status` as a
 * first-class, never-throws flag rather than something a caller has to
 * probe or that blows up on click). `navigator.requestMIDIAccess` is
 * absent in Safari, in jsdom under vitest, and — moot anyway, since there's
 * no backend to upload a capture to — on the public static build; SB7's
 * "Record MIDI" button must not render at all in any of those, rather than
 * rendering and erroring on click (docs/sketchbook.md).
 *
 * **`status` is four states, not two**, because "not supported" and
 * "permission denied" need different UI: a user on an unsupported browser
 * never sees the record button in the first place, while a user on a
 * supported browser who declines the permission prompt *does* see it, then
 * an error after clicking — a genuinely different failure a caller should
 * be able to tell apart and message differently.
 *  - `'unsupported'` — the API isn't there. Terminal; `requestAccess` is a
 *    no-op.
 *  - `'idle'` — supported, access not yet requested (or a previous denial
 *    the caller wants to retry from).
 *  - `'granted'` — `inputs` reflects the live device list, kept current via
 *    `MIDIAccess`'s own `statechange` event as devices connect/disconnect.
 *  - `'denied'` — the permission prompt was declined, or the browser
 *    otherwise refused (e.g. an insecure context). `error` carries detail.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MidiInputDevice {
  id: string;
  /** `MIDIPort.name` is nullable in the spec (a device with no reported
   *  name) — never surfaced as `null` here so a caller can render it
   *  directly without its own fallback. */
  name: string;
}

export type MidiAccessStatus = 'unsupported' | 'idle' | 'granted' | 'denied';

export interface MidiInputsState {
  status: MidiAccessStatus;
  /** Live device list — empty until `status === 'granted'`, then kept
   *  current for the component's lifetime. */
  inputs: MidiInputDevice[];
  error: string | null;
  /** Fires the permission prompt (browsers only ask once per origin; a
   *  later call after `'granted'` is a no-op, and after `'denied'` retries
   *  the request — matching `navigator.requestMIDIAccess`'s own idempotent
   *  contract). No-op if unsupported. */
  requestAccess: () => Promise<void>;
  /** Subscribe `handler` to every currently-known input's messages, and to
   *  any input that connects afterward while still subscribed. Returns an
   *  unsubscribe function; the last-registered handler wins (this hook has
   *  exactly one consumer at a time in practice — a `MidiRecorder` — so
   *  fan-out to multiple simultaneous handlers isn't a case worth
   *  supporting here). Calling before `status === 'granted'` registers the
   *  handler but nothing is wired to a real device until access lands. */
  onMessage: (handler: (event: MIDIMessageEvent) => void) => () => void;
}

function detectSupport(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export function useMidiInputs(): MidiInputsState {
  const [supported] = useState(detectSupport);
  const [status, setStatus] = useState<MidiAccessStatus>(() => (detectSupport() ? 'idle' : 'unsupported'));
  const [inputs, setInputs] = useState<MidiInputDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const accessRef = useRef<MIDIAccess | null>(null);
  const handlerRef = useRef<((event: MIDIMessageEvent) => void) | null>(null);
  const mountedRef = useRef(true);

  // Re-attach `onmidimessage` on every currently-known input to whatever
  // handler is registered right now (or `null`, clearing it) — the one
  // place that touches `MIDIInput.onmidimessage` directly, called both when
  // the device list changes and when `onMessage` registers/unregisters.
  const rewireInputs = useCallback((access: MIDIAccess) => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = handlerRef.current
        ? (event: MIDIMessageEvent) => handlerRef.current?.(event)
        : null;
    }
  }, []);

  const syncInputs = useCallback(
    (access: MIDIAccess) => {
      const list: MidiInputDevice[] = [];
      for (const input of access.inputs.values()) {
        list.push({ id: input.id, name: input.name ?? 'MIDI input' });
      }
      setInputs(list);
      rewireInputs(access);
    },
    [rewireInputs],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Every subscription this hook could have made, undone — a dangling
      // `onmidimessage` or `onstatechange` handler on a still-live
      // `MIDIAccess`/`MIDIInput` is the leak this cleanup exists to
      // prevent (those objects outlive the component; nothing else
      // releases them).
      const access = accessRef.current;
      if (access) {
        access.onstatechange = null;
        for (const input of access.inputs.values()) input.onmidimessage = null;
      }
      handlerRef.current = null;
    };
  }, []);

  const requestAccess = useCallback(async () => {
    if (!supported || accessRef.current) return; // no-op: unsupported, or already granted
    try {
      const access = await navigator.requestMIDIAccess();
      if (!mountedRef.current) {
        access.onstatechange = null;
        return; // unmounted while the permission prompt was pending
      }
      accessRef.current = access;
      access.onstatechange = () => syncInputs(access);
      syncInputs(access);
      setStatus('granted');
      setError(null);
    } catch (err) {
      // A decline (`NotAllowedError`) and an unsupported *context* (e.g.
      // `SecurityError` for a non-HTTPS origin, distinct from the browser
      // never having the API at all) both land here as `'denied'` — both
      // are "asked and didn't get it", which is the state a caller needs
      // to show a different message for than "never asked" or
      // "unsupported browser".
      if (mountedRef.current) {
        setStatus('denied');
        setError(err instanceof Error ? err.message : 'MIDI access was denied.');
      }
    }
  }, [supported, syncInputs]);

  const onMessage = useCallback(
    (handler: (event: MIDIMessageEvent) => void) => {
      handlerRef.current = handler;
      const access = accessRef.current;
      if (access) rewireInputs(access);
      return () => {
        // Only clear the wiring if this unsubscribe's handler is still the
        // active one — an unsubscribe from a stale subscription (e.g. a
        // fast-remounting caller) must not tear down a newer subscription
        // that already replaced it.
        if (handlerRef.current !== handler) return;
        handlerRef.current = null;
        const current = accessRef.current;
        if (current) rewireInputs(current);
      };
    },
    [rewireInputs],
  );

  return { status, inputs, error, requestAccess, onMessage };
}
