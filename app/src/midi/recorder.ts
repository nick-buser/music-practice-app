/**
 * Pure note on/off collector for a live `MIDIMessageEvent` stream — the
 * piece of SB7 shared unchanged with sight-reading assessment (SR6)
 * *(F2 amendment 2026-09-02)*, which is why this class has no dependency on
 * React, `useMidiInputs` (`./access.ts`), or anything else specific to the
 * Sketchbook. A caller (`SketchbookLive`'s capture box today; SR6's attempt
 * runner later) owns the `MIDIAccess` subscription and just forwards every
 * message here via `handleMessage`.
 *
 * **Clock**: every timestamp this class records is `Date.now()` at the
 * moment `handleMessage` is *called*, not the event's own `timeStamp`
 * field. Two reasons: it's the same clock domain the silence timer already
 * runs on (`setTimeout`/`Date.now()`, both faked together by
 * `vi.useFakeTimers()` — the exact mechanism `smf.test.ts`'s sibling,
 * `recorder.test.ts`, drives the silence-timeout assertion with), and it
 * matches this codebase's existing recorder precedent
 * (`media/recorder.ts`'s `useAudioRecorder` times itself off `Date.now()`
 * the same way). The jitter between "hardware timestamped this" and "our
 * handler got called" is a browser-scheduling artifact of microseconds to
 * low milliseconds — irrelevant to a notation capture, whether that's a
 * ten-second sketch or a locked sight-reading attempt.
 *
 * **`origin`** (ticket SB7 / F2 amendment): `'first-note'` anchors t=0 to
 * the first note-on this recorder ever sees — the Sketchbook's "the clock
 * starts when you actually play something" capture box. `'external'`
 * anchors t=0 to a caller-supplied `t0Ms` instead and never re-anchors —
 * SR6 needs its clock nailed to the count-in's downbeat, not to whenever
 * the sight-reader's first note happens to land relative to the beat.
 *
 * **`silenceTimeoutMs`**: auto-stops the recording after this many
 * milliseconds with no MIDI activity at all (note-on *or* note-off — any
 * message resets the countdown). `null` disables the timeout outright, not
 * "falls back to some default" — SR6 passes `null` because a sight-reading
 * attempt has its own fixed length and a silence timer would silently
 * truncate a passage with a long held note or a written rest, exactly the
 * bug this option shape exists to make impossible to reach by accident.
 */

/** One recorded note, and `smf.ts`'s `SmfNoteEvent` input shape — kept
 *  identical on purpose (see that module's docstring) so a caller pipes
 *  `stop()`'s return straight into `encodeSmf({ notes })` with no
 *  translation step. */
export interface MidiNoteEvent {
  pitch: number;
  velocity: number;
  /** Milliseconds from this recorder's clock origin (see `origin` above). */
  startMs: number;
  durationMs: number;
}

export interface MidiRecorderOptions {
  origin: 'first-note' | 'external';
  /** Required (and only meaningful) when `origin === 'external'` — the
   *  caller's own clock zero, in the same `Date.now()`-compatible domain
   *  every recorded timestamp is measured against. */
  t0Ms?: number;
  /** `null` disables the auto-stop-on-silence behaviour entirely. */
  silenceTimeoutMs: number | null;
  /** Fired exactly once, only when the silence timer is what ended the
   *  recording — never for an explicit `stop()` call, since that caller
   *  already knows it stopped. Lets `SketchbookLive` react to "the
   *  recording ended because you went quiet" the same way it reacts to the
   *  stop button, without polling. */
  onSilenceTimeout?: () => void;
}

/** A message shape structurally compatible with the real
 *  `MIDIMessageEvent` — deliberately not typed as that class itself, so a
 *  test can feed a scripted stream of plain objects without constructing
 *  (or faking) a DOM `Event`. */
export interface MidiMessageLike {
  data: Uint8Array | number[] | null;
}

interface PendingNote {
  pitch: number;
  velocity: number;
  startMs: number; // Date.now()-domain, not yet clock-relative
}

/** `note_on` status nibble; velocity 0 in this range is note-off (handled
 *  below), never a real note-on — see this module's docstring. */
const STATUS_NOTE_ON = 0x90;
const STATUS_NOTE_OFF = 0x80;

export class MidiRecorder {
  private readonly options: MidiRecorderOptions;
  private t0: number | null;
  private readonly notes: MidiNoteEvent[] = [];
  // Keyed `${channel}:${pitch}` — mirrors the backend's own simplification
  // for the same problem (`midi_features.py::_parse`'s `dict[tuple[channel,
  // note], float]`): a retrigger with no intervening note-off (legal SMF,
  // rare in a single-voice capture) simply replaces the pending start
  // rather than this class inventing a synthetic note-off for it.
  private readonly active = new Map<string, PendingNote>();
  private stopped = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MidiRecorderOptions) {
    if (options.origin === 'external' && options.t0Ms === undefined) {
      throw new Error("MidiRecorder: origin 'external' requires t0Ms");
    }
    this.options = options;
    this.t0 = options.origin === 'external' ? options.t0Ms! : null;
    this.armSilenceTimer();
  }

  /** Feed one MIDI message in. Ignored once `stop()` has been called, and
   *  ignored for anything that isn't a 3-byte note-on/note-off — SB7/SR6
   *  only ever need notes, not CC/pitch-bend/clock traffic, and the Web
   *  MIDI API always hands each message over already expanded (no running
   *  status to decompress on the way in — that's an encoder-side, not a
   *  reader-side, concern; see `smf.ts`'s equivalent note). */
  handleMessage(event: MidiMessageLike): void {
    if (this.stopped || !event.data || event.data.length < 3) return;
    const status = event.data[0];
    const data1 = event.data[1];
    const data2 = event.data[2];
    const type = status & 0xf0;
    const channel = status & 0x0f;

    // A note-on with velocity 0 is universally read as a note-off — a real
    // keyboard convention (many controllers send it instead of a genuine
    // 0x80 to save a byte via running status), not an edge case to special
    // case away.
    const isNoteOn = type === STATUS_NOTE_ON && data2 > 0;
    const isNoteOff = type === STATUS_NOTE_OFF || (type === STATUS_NOTE_ON && data2 === 0);
    if (!isNoteOn && !isNoteOff) return;

    const now = Date.now();
    const key = `${channel}:${data1}`;

    if (isNoteOn) {
      if (this.options.origin === 'first-note' && this.t0 === null) {
        this.t0 = now; // the clock starts here — see module docstring
      }
      this.active.set(key, { pitch: data1, velocity: data2, startMs: now });
      this.armSilenceTimer();
      return;
    }

    // isNoteOff. An unmatched note-off — no pending note-on for this
    // (channel, pitch), e.g. recording started mid-note, or the on was
    // dropped/missed — carries no onset to build a note from, so it's
    // simply discarded rather than fabricating a zero-duration or
    // negative-duration note for it.
    const pending = this.active.get(key);
    this.armSilenceTimer();
    if (!pending) return;
    this.active.delete(key);
    this.notes.push(this.finalizeNote(pending, now));
  }

  /** Stop the recording and return every note. Idempotent: calling this
   *  again (or after the silence timer already fired) just returns the
   *  same finalized list rather than re-finalizing or throwing. */
  stop(): MidiNoteEvent[] {
    if (!this.stopped) this.finalize(Date.now());
    return this.notes;
  }

  private finalize(nowAbsolute: number): void {
    this.stopped = true;
    this.clearSilenceTimer();
    // A note still held when the recording ends (stop() called, or the
    // silence timer fired) is closed off *at* that moment rather than
    // dropped — mirrors `midi_features.py::_parse`'s identical judgment
    // call for a truncated file ("closed off at the file's last event time
    // rather than dropped, so one bad file can't silently erase a note").
    if (this.active.size > 0) {
      for (const pending of this.active.values()) {
        this.notes.push(this.finalizeNote(pending, nowAbsolute));
      }
      this.active.clear();
      // Held notes are appended after every already-closed note above, so
      // re-sort onto chronological order (`smf.ts` doesn't require sorted
      // input, but callers other than `encodeSmf` shouldn't have to know
      // that).
      this.notes.sort((a, b) => a.startMs - b.startMs);
    }
  }

  /** `pending.startMs`/`nowAbsolute` are `Date.now()`-domain; convert both
   *  to this recorder's clock-relative ms. `t0` is guaranteed non-null
   *  here: a `PendingNote` only ever exists after a note-on has been
   *  processed, and processing a note-on sets `t0` first if it wasn't set
   *  already (`origin: 'first-note'`) or it was set at construction
   *  (`origin: 'external'`). */
  private finalizeNote(pending: PendingNote, nowAbsolute: number): MidiNoteEvent {
    const t0 = this.t0 as number;
    const startMs = pending.startMs - t0;
    const durationMs = Math.max(0, nowAbsolute - t0 - startMs);
    return { pitch: pending.pitch, velocity: pending.velocity, startMs, durationMs };
  }

  private armSilenceTimer(): void {
    this.clearSilenceTimer();
    if (this.stopped || this.options.silenceTimeoutMs == null) return;
    this.silenceTimer = setTimeout(() => {
      this.finalize(Date.now());
      this.options.onSilenceTimeout?.();
    }, this.options.silenceTimeoutMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
