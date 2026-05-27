import { useEffect, useState } from 'react';
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
 * Uses dangerouslySetInnerHTML so React owns the SVG subtree (avoids reconciliation
 * conflicts with the WASM-generated DOM).
 */
export function Score({ data, options, className, ariaLabel }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optsKey = JSON.stringify(options ?? {});

  useEffect(() => {
    let cancelled = false;
    setError(null);
    renderToSvg(data, options)
      .then((rendered) => {
        if (cancelled) return;
        const tagged = ariaLabel
          ? rendered.replace(/^<svg/, `<svg aria-label="${ariaLabel.replace(/"/g, '&quot;')}"`)
          : rendered;
        setSvg(tagged);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, optsKey, ariaLabel]);

  if (error) {
    return <div className={className}><span className="loading">score · error</span></div>;
  }
  if (svg === null) {
    return <div className={className}><span className="loading">— sounding —</span></div>;
  }
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
