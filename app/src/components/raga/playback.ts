/**
 * Swara sonification. We turn a section's cells into a timeline of pitched
 * tones and schedule them on the Web Audio clock with the same "two clocks"
 * lookahead as useMetronome, reporting the active matra so the score can draw
 * a cursor. Sa is movable: bind it to a frequency and every swara has a pitch.
 *
 * The timeline-building is a pure function (buildTimeline) so the musical logic
 * is unit-tested without an AudioContext; the hook is a thin scheduler on top.
 */

import { useEffect, useRef, useState } from 'react';

import type { Cell } from '../../data/raga/composition';
import { swaraSemitones } from '../../data/raga/swara';

/** A pleasant mid-register default for Sa (A3). */
export const DEFAULT_SA_HZ = 220;

/** Equal temperament (12-TET) or a 5-limit just-intonation shruti approximation. */
export type TuningSystem = 'equal' | 'just';

/**
 * 5-limit just-intonation ratios above Sa, one per chromatic position. These
 * tune the swaras to the consonant whole-number ratios Indian classical
 * intonation is built on — an approximation of shruti, not the full 22-shruti,
 * raga-dependent system.
 */
const JUST_RATIOS = [
  1, // Sa
  16 / 15, // komal Re  (R1)
  9 / 8, // shuddha Re (R2)
  6 / 5, // komal Ga  (G2)
  5 / 4, // shuddha Ga (G3)
  4 / 3, // shuddha Ma (M1)
  45 / 32, // tivra Ma   (M2)
  3 / 2, // Pa
  8 / 5, // komal Dha  (D1)
  5 / 3, // shuddha Dha(D2)
  16 / 9, // komal Ni  (N2)
  15 / 8, // shuddha Ni (N3)
];

/** Frequency of a swara `semis` semitones above Sa, in the chosen tuning. */
export function swaraHz(saHz: number, semis: number, tuning: TuningSystem): number {
  if (tuning === 'equal') return saHz * 2 ** (semis / 12);
  const oct = Math.floor(semis / 12);
  return saHz * JUST_RATIOS[semis - oct * 12] * 2 ** oct;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export interface ToneEvent {
  hz: number;
  /** Seconds after the matra's start. */
  offset: number;
  dur: number;
}

export interface MatraEvent {
  /** Index into the section's cells. */
  index: number;
  /** Seconds from the start of the section. */
  offset: number;
  tones: ToneEvent[];
}

export interface Timeline {
  events: MatraEvent[];
  totalDur: number;
}

/**
 * Lay a section's cells onto a time grid. Every matra (including sustains and
 * rests) occupies one beat; a held swara rings on through the sustains that
 * follow it, and a subdivided matra splits its beat evenly.
 */
export function buildTimeline(
  cells: Cell[],
  bpm: number,
  saHz: number,
  tuning: TuningSystem = 'equal',
): Timeline {
  const matraDur = 60 / bpm;
  const hz = (semis: number) => swaraHz(saHz, semis, tuning);
  const events: MatraEvent[] = cells.map((cell, i) => {
    const base = { index: i, offset: i * matraDur };
    if (cell.kind !== 'swara') return { ...base, tones: [] };
    const n = cell.swaras.length;
    if (n === 1) {
      // Ring on through any immediately following sustains.
      let hold = 1;
      while (cells[i + hold]?.kind === 'sustain') hold += 1;
      return { ...base, tones: [{ hz: hz(swaraSemitones(cell.swaras[0])), offset: 0, dur: matraDur * hold }] };
    }
    const each = matraDur / n;
    return {
      ...base,
      tones: cell.swaras.map((s, k) => ({ hz: hz(swaraSemitones(s)), offset: k * each, dur: each })),
    };
  });
  return { events, totalDur: cells.length * matraDur };
}

interface Options {
  cells: Cell[];
  /** Matras per minute. */
  bpm: number;
  saHz: number;
  tuning?: TuningSystem;
  running: boolean;
  loop: boolean;
  onEnded?: () => void;
}

interface PlaybackState {
  /** Active cell index, or -1 when stopped / idle. */
  activeIndex: number;
}

export function useSwaraPlayback({
  cells,
  bpm,
  saHz,
  tuning = 'equal',
  running,
  loop,
  onEnded,
}: Options): PlaybackState {
  const [activeIndex, setActiveIndex] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const eiRef = useRef(0); // index into the timeline's events
  const baseRef = useRef(0); // audio-clock time of the current loop's start
  const nextTimeRef = useRef(0);
  const queueRef = useRef<Array<{ index: number; time: number }>>([]);
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Latest inputs, readable inside the scheduler without resubscribing.
  const cellsRef = useRef(cells);
  const bpmRef = useRef(bpm);
  const saRef = useRef(saHz);
  const tuningRef = useRef(tuning);
  const loopRef = useRef(loop);
  const onEndedRef = useRef(onEnded);
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { saRef.current = saHz; }, [saHz]);
  useEffect(() => { tuningRef.current = tuning; }, [tuning]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  useEffect(() => {
    if (!running) {
      setActiveIndex(-1);
      return;
    }

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    void ctx.resume();

    let timeline = buildTimeline(cellsRef.current, bpmRef.current, saRef.current, tuningRef.current);
    eiRef.current = 0;
    doneRef.current = false;
    queueRef.current = [];
    baseRef.current = ctx.currentTime + 0.1;
    nextTimeRef.current = baseRef.current;

    const playTone = (hz: number, time: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = hz;
      const peak = 0.22;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
      gain.gain.setValueAtTime(peak, time + Math.max(0.03, dur * 0.6));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.98);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    };

    const scheduleNext = (): boolean => {
      if (eiRef.current >= timeline.events.length) {
        if (!loopRef.current) {
          doneRef.current = true;
          return false;
        }
        // Recompute each loop so a tempo change takes hold at the cycle seam.
        baseRef.current += timeline.totalDur;
        timeline = buildTimeline(cellsRef.current, bpmRef.current, saRef.current, tuningRef.current);
        eiRef.current = 0;
      }
      const ev = timeline.events[eiRef.current];
      const t = baseRef.current + ev.offset;
      for (const tone of ev.tones) playTone(tone.hz, t + tone.offset, tone.dur);
      queueRef.current.push({ index: ev.index, time: t });
      eiRef.current += 1;
      nextTimeRef.current =
        eiRef.current < timeline.events.length
          ? baseRef.current + timeline.events[eiRef.current].offset
          : baseRef.current + timeline.totalDur;
      return true;
    };

    const tick = () => {
      while (nextTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
        if (!scheduleNext()) break;
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, LOOKAHEAD_MS);

    const drain = () => {
      const now = ctx.currentTime;
      const q = queueRef.current;
      while (q.length && q[0].time <= now) setActiveIndex(q.shift()!.index);
      if (doneRef.current && q.length === 0) {
        setActiveIndex(-1);
        onEndedRef.current?.();
        return; // stop the rAF loop; the effect cleanup handles the rest
      }
      rafRef.current = requestAnimationFrame(drain);
    };
    rafRef.current = requestAnimationFrame(drain);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      queueRef.current = [];
    };
  }, [running]);

  return { activeIndex };
}
