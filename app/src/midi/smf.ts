/**
 * Type-0 Standard MIDI File encoder — SB7's capture path turns a
 * `MidiRecorder` note list (`./recorder.ts`) into the `.mid` bytes
 * `uploadIdeaAsset` posts as a `melody` idea asset. The real interop
 * contract isn't "valid SMF" in the abstract, it's that the backend's own
 * extractor (`backend/app/jobs/extractors/midi_features.py`) parses the
 * result with `mido` — every byte-layout decision below is made against
 * that reader, not just against the spec in isolation.
 *
 * Hand-rolled on purpose (ticket SB7: "no new dependency" — this laptop's
 * disk-discipline rule rules out installing an SMF library for what is,
 * structurally, a few hundred lines against a binary format that hasn't
 * changed since 1988). *(F2 amendment 2026-09-02)*: sight-reading
 * assessment (SR6) reuses this encoder unchanged — it anchors `markers`/
 * `meta` to its own count-in clock rather than forking a second encoder —
 * so nothing here may assume "the sketchbook" is the only caller.
 *
 * ─── Spec notes (Standard MIDI File 1.0 / General MIDI) — only what this
 * module actually emits, cited so the byte layout below is checkable
 * against the spec rather than taken on faith ───────────────────────────
 *  - Header chunk `MThd`: 6-byte body — format 0 (single track), ntrks=1,
 *    division=`ppq`. Division's top bit is 0 for "ticks per quarter note"
 *    (as opposed to SMPTE frames); every `ppq` this module accepts (see the
 *    range check below) leaves that bit clear.
 *  - One track chunk `MTrk`: a flat, time-ordered `<delta-time><event>`
 *    list, no running status (see `encodeVlq`'s neighbour, the "no running
 *    status" note below `encodeSmf`).
 *  - Delta-time is a variable-length quantity (VLQ) — see `encodeVlq`.
 *  - Tempo meta: `FF 51 03 <3-byte µs-per-quarter, big-endian>`.
 *  - Text meta: `FF 01 <VLQ length> <text>`. Marker meta: `FF 06 <VLQ
 *    length> <text>` — the only structural difference is the type byte.
 *  - End-of-track meta `FF 2F 00` is mandatory and must be the track's
 *    final event; `mido` raises `EOFError` on a track missing it.
 */

/** One captured note — `MidiRecorder.stop()`'s output shape, and this
 *  module's note input shape; kept identical on purpose so a caller never
 *  has to translate between them. */
export interface SmfNoteEvent {
  /** MIDI note number, 0-127. */
  pitch: number;
  /**
   * Note-on velocity, 1-127. Zero is refused, not silently accepted: a real
   * note-on with velocity 0 is the universal "this is actually a note-off"
   * convention (see `./recorder.ts`'s own handling of it on the way in) —
   * accepting it here would let this encoder round-trip a note nothing will
   * ever be heard playing.
   */
  velocity: number;
  /** Onset, milliseconds from the recording's own t=0 (`MidiRecorder`'s clock — see that module's `origin` option). */
  startMs: number;
  durationMs: number;
}

export interface SmfMarker {
  /**
   * Absolute tick position, not milliseconds. SR6 already knows its bar
   * boundaries in ticks (it derives them from the same locked tempo/meter
   * it hands this module), so this module doesn't re-derive ticks from ms
   * and risk a second, independent rounding of the same instant.
   */
  tick: number;
  text: string;
}

export interface SmfTextMeta {
  /** Always written at tick 0 — a text meta here is a fact about the whole
   *  file (e.g. SR6's clock-anchor note), not a moment within it. */
  text: string;
}

export interface EncodeSmfOptions {
  notes?: SmfNoteEvent[];
  /** Quarter-note bpm — SMF's own tempo unit. SR6 passes its locked attempt
   *  tempo already converted to quarter terms, same unit as this default. */
  tempoBpm?: number;
  ppq?: number;
  meta?: SmfTextMeta[];
  markers?: SmfMarker[];
}

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_PPQ = 480;
/** Single-voice capture — neither `MidiRecorder`'s note list nor this
 *  encoder's callers (SB7, SR6) carry a per-note channel, so every note
 *  goes out on channel 0. A multi-channel capture is out of scope for this
 *  hand-rolled encoder; revisit if a future ticket actually needs one. */
const CHANNEL = 0;

/**
 * Variable-length quantity — SMF's delta-time encoding. Big-endian 7-bit
 * groups, most-significant group first, every non-final byte's top bit set
 * as a continuation flag (so a reader knows when to stop). `127` (`0x7F`)
 * fits in seven bits and is one byte; `128` needs a second group for its
 * single high bit, so it becomes two bytes: `0x81 0x00` (the high group's
 * value `1`, flagged continuing, then the low group's `0`, unflagged) — the
 * exact boundary `smf.test.ts` pins directly against this function, ahead
 * of pinning it again inside a full encoded file.
 *
 * Exported (not just used internally) so a test — or a future caller, e.g.
 * SC9's own delta-time needs — can exercise it in isolation rather than
 * only through a whole file's worth of bytes.
 */
export function encodeVlq(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`encodeVlq: expected a non-negative integer, got ${value}`);
  }
  const groups = [value & 0x7f];
  let rest = Math.floor(value / 128);
  while (rest > 0) {
    groups.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  return groups.reverse();
}

function asciiBytes(s: string): number[] {
  return Array.from(s, (ch) => ch.charCodeAt(0));
}

/** `FF <type> <VLQ length> <text>` — the shared shape behind both text
 *  meta (`type = 0x01`) and marker meta (`type = 0x06`); the spec's only
 *  difference between them is that one type byte. Text is required to be
 *  plain ASCII: a byte with the high bit set inside a meta event's payload
 *  would read as if it were the *start* of the next VLQ-length byte to a
 *  strict reader, so silently truncating/mangling non-ASCII input here
 *  (rather than refusing it) would produce a file that's subtly wrong in a
 *  way nothing downstream would flag. */
function textMetaBytes(type: number, text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x7f) {
      throw new RangeError(`encodeSmf: meta/marker text must be plain ASCII, got ${JSON.stringify(text)}`);
    }
    bytes.push(code);
  }
  return [0xff, type, ...encodeVlq(bytes.length), ...bytes];
}

function u16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

interface TrackEvent {
  tick: number;
  bytes: number[];
}

/**
 * Encode `options` to a complete, single-track `.mid` file.
 *
 * **No running status.** Every event — including back-to-back note-on/
 * note-off pairs on the same channel, the case running status exists to
 * shrink — carries its own full status byte. `mido` reads either form
 * correctly, so this is not an interop requirement; it's a deliberate
 * simplification for a hand-rolled, first-of-kind encoder. Running status
 * also resets across any meta/sysex event (a rule a naive implementation
 * forgetting that reset would violate), and a captured sketch or a locked
 * sight-reading attempt is at most a few hundred events — the bytes saved
 * are not worth adding that failure mode to code two other tickets (SR6,
 * SC9) build directly on.
 */
// TS 5.7+ made `Uint8Array` generic over its backing buffer
// (`ArrayBufferLike`, which also covers `SharedArrayBuffer`). `new
// Uint8Array([...])` from a plain number array always allocates a fresh
// real `ArrayBuffer`, never a shared one — pinning the return type to
// `Uint8Array<ArrayBuffer>` (rather than the wider default) is what lets a
// caller hand this straight to `new File([bytes], ...)`, whose `BlobPart`
// type requires exactly that specific backing.
export function encodeSmf(options: EncodeSmfOptions): Uint8Array<ArrayBuffer> {
  const { notes = [], tempoBpm = DEFAULT_TEMPO_BPM, ppq = DEFAULT_PPQ, meta = [], markers = [] } = options;

  if (!(tempoBpm > 0)) throw new RangeError(`encodeSmf: tempoBpm must be positive, got ${tempoBpm}`);
  // Division's top bit must stay 0 (ticks-per-quarter, not SMPTE frames) —
  // 0x7fff is the largest value that leaves it clear.
  if (!Number.isInteger(ppq) || ppq <= 0 || ppq > 0x7fff) {
    throw new RangeError(`encodeSmf: ppq must be a positive integer <= 32767, got ${ppq}`);
  }

  const ticksPerMs = (ppq * tempoBpm) / 60000;
  const msToTicks = (ms: number) => Math.round(ms * ticksPerMs);

  // `60,000,000 / bpm` is microseconds-per-quarter-note, the tempo meta's
  // unit. Rounded once, here, to the nearest microsecond — this is a single
  // value written once into the file, not a per-event or per-tick
  // conversion, so the at-most-half-a-microsecond rounding error can never
  // accumulate into audible drift across a capture the way rounding
  // *each* tick's timestamp would.
  const usPerQuarter = Math.round(60_000_000 / tempoBpm);
  if (usPerQuarter < 1 || usPerQuarter > 0xffffff) {
    throw new RangeError(`encodeSmf: tempoBpm ${tempoBpm} is outside the tempo meta's representable range`);
  }

  const events: TrackEvent[] = [
    {
      tick: 0,
      bytes: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff],
    },
  ];
  for (const m of meta) events.push({ tick: 0, bytes: textMetaBytes(0x01, m.text) });
  for (const mk of markers) {
    if (!Number.isInteger(mk.tick) || mk.tick < 0) {
      throw new RangeError(`encodeSmf: marker tick must be a non-negative integer, got ${mk.tick}`);
    }
    events.push({ tick: mk.tick, bytes: textMetaBytes(0x06, mk.text) });
  }

  // Sorted by onset before building events — not assumed pre-sorted — so
  // that, combined with the stable sort below, each note's own [on, off]
  // pair is pushed adjacently in roughly chronological order rather than in
  // whatever order the caller happened to hand notes over.
  const sortedNotes = [...notes].sort((a, b) => a.startMs - b.startMs);
  for (const n of sortedNotes) {
    if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127) {
      throw new RangeError(`encodeSmf: pitch must be an integer 0-127, got ${n.pitch}`);
    }
    if (!Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127) {
      throw new RangeError(`encodeSmf: note-on velocity must be an integer 1-127, got ${n.velocity}`);
    }
    const onTick = msToTicks(n.startMs);
    // `Math.max` keeps a caller-supplied zero/negative duration from ever
    // producing an off-tick *before* its own on-tick — the stable sort just
    // below depends on a note's off never sorting ahead of its own on.
    const offTick = Math.max(onTick, msToTicks(n.startMs + n.durationMs));
    events.push({ tick: onTick, bytes: [0x90 | CHANNEL, n.pitch, n.velocity] });
    events.push({ tick: offTick, bytes: [0x80 | CHANNEL, n.pitch, 0x00] });
  }

  // `Array.prototype.sort` has been stable since ES2019, and every note
  // above pushed its own [on, off] as adjacent entries *before* this sort
  // runs. Two consequences fall out of that stability, neither of which
  // needed a manual tie-break field:
  //  - A note whose on/off round to the *same* tick (duration rounds to 0)
  //    keeps its on-event sorting first, so it's never "stuck" — an
  //    off-event with no preceding on is simply a no-op to any reader.
  //  - Two *different*, back-to-back notes sharing a tick (one ends exactly
  //    when the next begins) keep the earlier note's off ahead of the later
  //    note's on, since the earlier note was pushed first — momentary
  //    overlap is avoided as a side effect of insertion order, not a
  //    special case this code has to reason about.
  events.sort((a, b) => a.tick - b.tick);

  const trackBytes: number[] = [];
  let prevTick = 0;
  for (const event of events) {
    trackBytes.push(...encodeVlq(event.tick - prevTick), ...event.bytes);
    prevTick = event.tick;
  }
  trackBytes.push(0x00, 0xff, 0x2f, 0x00); // end-of-track — mandatory, see module docstring

  const header = [...asciiBytes('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ppq)];
  const track = [...asciiBytes('MTrk'), ...u32(trackBytes.length), ...trackBytes];

  return new Uint8Array([...header, ...track]);
}
