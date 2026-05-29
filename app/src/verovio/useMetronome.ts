import { useEffect, useRef, useState } from 'react';

/**
 * A precise metronome built on the Web Audio API.
 *
 * Uses the "tale of two clocks" pattern: a setInterval lookahead loop schedules
 * click oscillators slightly ahead of time against the rock-solid audio clock,
 * so timing doesn't jitter with the main thread. Each scheduled beat is pushed
 * to a queue that a requestAnimationFrame loop drains to drive the visual pip,
 * keeping the blinking light locked to what you actually hear.
 */

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

interface MetronomeState {
  /** Beat index within the current bar (0 = downbeat), or -1 when stopped. */
  currentBeat: number;
}

export function useMetronome(bpm: number, meter: number, running: boolean): MetronomeState {
  const [currentBeat, setCurrentBeat] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatInBarRef = useRef(0);
  const queueRef = useRef<Array<{ beat: number; time: number }>>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep the latest bpm/meter readable inside the scheduler without resubscribing.
  const bpmRef = useRef(bpm);
  const meterRef = useRef(meter);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { meterRef.current = meter; }, [meter]);

  useEffect(() => {
    if (!running) {
      setCurrentBeat(-1);
      return;
    }

    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    void ctx.resume();

    beatInBarRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.08;
    queueRef.current = [];

    const scheduleClick = (beat: number, time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isDownbeat = beat === 0;
      // Downbeat rings higher and a touch louder, like a wood block accent.
      osc.frequency.value = isDownbeat ? 1320 : 880;
      const peak = isDownbeat ? 0.5 : 0.32;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    };

    const tick = () => {
      while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
        const beat = beatInBarRef.current;
        scheduleClick(beat, nextNoteTimeRef.current);
        queueRef.current.push({ beat, time: nextNoteTimeRef.current });
        const secondsPerBeat = 60 / bpmRef.current;
        nextNoteTimeRef.current += secondsPerBeat;
        beatInBarRef.current = (beat + 1) % meterRef.current;
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, LOOKAHEAD_MS);

    const drain = () => {
      const now = ctx.currentTime;
      const q = queueRef.current;
      while (q.length && q[0].time <= now) {
        setCurrentBeat(q.shift()!.beat);
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

  return { currentBeat };
}
