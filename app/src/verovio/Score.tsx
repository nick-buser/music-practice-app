import { useEffect, useRef, useState } from 'react';
import { renderToSvg, type RenderOptions } from './toolkit';

interface Props {
  data: string;
  options?: RenderOptions;
  className?: string;
  /** Optional aria-label for the score's SVG. */
  ariaLabel?: string;
}

/**
 * Renders a music score via Verovio. The toolkit is shared across instances —
 * each Score awaits the shared promise, then re-renders on `data`/`options` change.
 */
export function Score({ data, options, className, ariaLabel }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable string key for options so callers can pass inline literals safely.
  const optsKey = JSON.stringify(options ?? {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    renderToSvg(data, options)
      .then((svg) => {
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        const svgEl = hostRef.current.querySelector('svg');
        if (svgEl && ariaLabel) svgEl.setAttribute('aria-label', ariaLabel);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, optsKey]);

  if (error) {
    return <div className={className}><span className="loading">score · error</span></div>;
  }
  return (
    <div ref={hostRef} className={className}>
      {loading ? <span className="loading">— sounding —</span> : null}
    </div>
  );
}
