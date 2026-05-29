import { useEffect, useRef, useState } from 'react';
import { renderWithTimemap, type RenderOptions, type TimemapEntry } from './toolkit';

interface Props {
  data: string;
  options?: RenderOptions;
  /** The score's encoded tempo (bpm) — the timemap's ms values assume this. */
  encodedBpm: number;
  /** The tempo the musician is actually working at; scales playback speed. */
  bpm: number;
  playing: boolean;
  className?: string;
  /** Reports playback position as a 0–1 fraction of the snippet each frame. */
  onProgress?: (fraction: number) => void;
}

/**
 * A Verovio score with a live playback cursor. We capture the timemap alongside
 * the SVG, then advance a score-time clock (scaled by bpm / encodedBpm) and
 * toggle a `.note-playing` class on the note groups that should be sounding —
 * a moving highlight that follows the metronome. Loops at the end of the snippet.
 */
export function SessionScore({
  data,
  options,
  encodedBpm,
  bpm,
  playing,
  className,
  onProgress,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timemapRef = useRef<TimemapEntry[]>([]);

  // Playback bookkeeping, kept in refs so the rAF loop sees fresh values.
  const scoreMsRef = useRef(0);
  const ptrRef = useRef(0);
  const activeRef = useRef<Set<string>>(new Set());
  const lastTsRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const encodedRef = useRef(encodedBpm);
  const playingRef = useRef(playing);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { encodedRef.current = encodedBpm; }, [encodedBpm]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const optsKey = JSON.stringify(options ?? {});

  // Load + render the score and its timemap together.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    renderWithTimemap(data, options)
      .then(({ svg: rendered, timemap }) => {
        if (cancelled) return;
        timemapRef.current = timemap;
        setSvg(rendered);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, optsKey]);

  // Drive the cursor.
  useEffect(() => {
    if (!svg || !hostRef.current) return;
    const svgEl = hostRef.current.querySelector('svg');
    if (!svgEl) return;

    const timemap = timemapRef.current;
    const totalMs = timemap.length
      ? timemap[timemap.length - 1].tstamp + (60000 / encodedRef.current)
      : 0;

    const setNote = (id: string, on: boolean) => {
      const el = svgEl.querySelector(`[id="${id}"]`);
      if (el) el.classList.toggle('note-playing', on);
    };

    const clearAll = () => {
      activeRef.current.forEach((id) => setNote(id, false));
      activeRef.current.clear();
    };

    const resetCursor = () => {
      scoreMsRef.current = 0;
      ptrRef.current = 0;
      clearAll();
    };

    resetCursor();
    lastTsRef.current = null;
    let raf = 0;

    const frame = (ts: number) => {
      const last = lastTsRef.current;
      lastTsRef.current = ts;

      if (playingRef.current && last !== null && totalMs > 0) {
        const dt = ts - last;
        scoreMsRef.current += dt * (bpmRef.current / encodedRef.current);

        if (scoreMsRef.current >= totalMs) {
          // Loop the snippet.
          resetCursor();
        }

        const now = scoreMsRef.current;
        // Advance through any timemap entries we've passed.
        while (ptrRef.current < timemap.length && timemap[ptrRef.current].tstamp <= now) {
          const entry = timemap[ptrRef.current];
          entry.off?.forEach((id) => { setNote(id, false); activeRef.current.delete(id); });
          entry.on?.forEach((id) => { setNote(id, true); activeRef.current.add(id); });
          ptrRef.current += 1;
        }

        onProgressRef.current?.(Math.min(1, now / totalMs));
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearAll();
    };
  }, [svg]);

  if (error) {
    return <div className={className}><span className="loading">score · error</span></div>;
  }
  if (svg === null) {
    return <div className={className}><span className="loading">— sounding —</span></div>;
  }
  return <div ref={hostRef} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
