import { describe, expect, it } from 'vitest';

import { encodeSmf, encodeVlq } from './smf';

// Every expected byte array below is derived by hand from the Standard
// MIDI File spec (see smf.ts's module docstring for the exact rules
// applied) — never by running `encodeSmf`/`encodeVlq` and pasting their
// output. Each derivation was independently cross-checked with a small
// from-scratch Python calculator (not this module, not any part of this
// codebase) before being written in here, so this file is the ground
// truth `smf.ts` has to match, not the other way around.

describe('encodeVlq — SMF variable-length delta-time', () => {
  it('0 is a single zero byte', () => {
    expect(encodeVlq(0)).toEqual([0x00]);
  });

  it('127 (0x7F) is the largest one-byte value', () => {
    // 127 fits entirely in the low 7 bits of a single byte — no
    // continuation bit needed.
    expect(encodeVlq(127)).toEqual([0x7f]);
  });

  it('128 is the smallest two-byte value — the 127 boundary itself', () => {
    // 128 = 0b1_0000000: bit 7 spills into a second 7-bit group. The high
    // group (value 1) is written first with its continuation bit (0x80)
    // set; the low group (value 0) is written last, unflagged.
    expect(encodeVlq(128)).toEqual([0x81, 0x00]);
  });

  it('16384 needs three bytes', () => {
    // 16384 = 0x4000 = 1_0000000_0000000 split into 7-bit groups from the
    // top: [1, 0, 0] -> continuation set on all but the last: 0x81 0x80 0x00.
    // (This is the textbook example from the SMF spec's own VLQ table.)
    expect(encodeVlq(16384)).toEqual([0x81, 0x80, 0x00]);
  });

  it('refuses a negative or non-integer delta', () => {
    expect(() => encodeVlq(-1)).toThrow(RangeError);
    expect(() => encodeVlq(1.5)).toThrow(RangeError);
  });
});

describe('encodeSmf — header + a fixed two-note sequence', () => {
  it('encodes deltas that cross the 127/128 boundary inside a real file', () => {
    // 120bpm @ 480ppq => 0.96 ticks/ms, so:
    //   note 1: C4 (60), vel 100, on at 0ms, off at 500ms  -> ticks 0, 480
    //   note 2: E4 (64), vel 90,  on at 600ms, off at 700ms -> ticks 576, 672
    // Event deltas, in order: 0 (tempo), 0 (note1 on), 480 (note1 off —
    // needs 2 VLQ bytes, crossing the boundary), 96 (note2 on — back to 1
    // byte), 96 (note2 off), 0 (end-of-track).
    const bytes = encodeSmf({
      tempoBpm: 120,
      ppq: 480,
      notes: [
        { pitch: 60, velocity: 100, startMs: 0, durationMs: 500 },
        { pitch: 64, velocity: 90, startMs: 600, durationMs: 100 },
      ],
    });

    // prettier-ignore
    const expected = [
      // MThd: tag, length=6, format=0, ntrks=1, division=480 (0x01E0)
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
      // MTrk: tag, length=28 (0x1C)
      0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x1c,
      // delta 0, tempo meta: FF 51 03, 500000us = 0x07A120
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
      // delta 0, note1 on: channel 0, pitch 60 (0x3C), velocity 100 (0x64)
      0x00, 0x90, 0x3c, 0x64,
      // delta 480 (0x83 0x60 — the boundary-crossing VLQ), note1 off
      0x83, 0x60, 0x80, 0x3c, 0x00,
      // delta 96 (0x60), note2 on: pitch 64 (0x40), velocity 90 (0x5A)
      0x60, 0x90, 0x40, 0x5a,
      // delta 96 (0x60), note2 off
      0x60, 0x80, 0x40, 0x00,
      // delta 0, end-of-track
      0x00, 0xff, 0x2f, 0x00,
    ];

    expect(Array.from(bytes)).toEqual(expected);
  });

  it('rounds a non-round tempo into the 3-byte microseconds-per-quarter tempo meta', () => {
    // 60,000,000 / 90 = 666,666.666... -> rounds to 666,667 = 0x0A2C2B.
    const bytes = encodeSmf({ tempoBpm: 90, notes: [] });

    // prettier-ignore
    const expected = [
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0, // MThd, default ppq=480
      0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0b, // MTrk, length 11
      0x00, 0xff, 0x51, 0x03, 0x0a, 0x2c, 0x2b, // delta 0, tempo meta (666667us)
      0x00, 0xff, 0x2f, 0x00, // delta 0, end-of-track
    ];

    expect(Array.from(bytes)).toEqual(expected);
  });

  it('encodes a text meta event as FF 01 <len> <ascii>', () => {
    const bytes = encodeSmf({ tempoBpm: 120, notes: [], meta: [{ text: 'anchor' }] });

    // prettier-ignore
    const expected = [
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
      0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x15, // MTrk, length 21
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // delta 0, tempo meta (120bpm -> 500000us)
      0x00, 0xff, 0x01, 0x06, 0x61, 0x6e, 0x63, 0x68, 0x6f, 0x72, // delta 0, text meta "anchor" (6 ascii bytes)
      0x00, 0xff, 0x2f, 0x00,
    ];

    expect(Array.from(bytes)).toEqual(expected);
  });

  it('encodes a marker event as FF 06 <len> <ascii>', () => {
    const bytes = encodeSmf({ tempoBpm: 120, notes: [], markers: [{ tick: 0, text: 'bar1' }] });

    // prettier-ignore
    const expected = [
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
      0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x13, // MTrk, length 19
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
      0x00, 0xff, 0x06, 0x04, 0x62, 0x61, 0x72, 0x31, // delta 0, marker "bar1" (4 ascii bytes)
      0x00, 0xff, 0x2f, 0x00,
    ];

    expect(Array.from(bytes)).toEqual(expected);
  });

  it('always ends with the mandatory end-of-track meta, even with no notes at all', () => {
    const bytes = encodeSmf({ notes: [] });
    const tail = Array.from(bytes.slice(-4));
    expect(tail).toEqual([0x00, 0xff, 0x2f, 0x00]);
  });

  it('rejects an out-of-range pitch, velocity, or a note-on velocity of 0', () => {
    expect(() => encodeSmf({ notes: [{ pitch: 128, velocity: 100, startMs: 0, durationMs: 100 }] })).toThrow(
      RangeError,
    );
    expect(() => encodeSmf({ notes: [{ pitch: 60, velocity: 0, startMs: 0, durationMs: 100 }] })).toThrow(
      RangeError,
    );
    expect(() => encodeSmf({ notes: [{ pitch: 60, velocity: 128, startMs: 0, durationMs: 100 }] })).toThrow(
      RangeError,
    );
  });

  it('rejects non-ASCII meta/marker text rather than silently mangling it', () => {
    expect(() => encodeSmf({ notes: [], meta: [{ text: 'café' }] })).toThrow(RangeError);
  });
});
