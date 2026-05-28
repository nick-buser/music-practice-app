import { useEffect, useRef, useState } from 'react';
import { renderToSvg, type RenderOptions } from './toolkit';

interface Props {
  data: string;
  options?: RenderOptions;
  className?: string;
  ariaLabel?: string;
  /**
   * Called after the SVG is inserted into the DOM. Use this to query measure
   * groups and paint overlays (heatmap, selection, annotations).
   */
  onSvgReady?: (svg: SVGSVGElement) => void;
  /**
   * Optional click handler. Fires with the closest ancestor element that has
   * an id (Verovio assigns ids like "measure-0000001234567890").
   */
  onElementClick?: (id: string, kind: string) => void;
}

/**
 * Renders a music score via Verovio. Toolkit is shared across instances; SVG
 * goes through dangerouslySetInnerHTML so React doesn't fight WASM-generated DOM.
 */
export function Score({ data, options, className, ariaLabel, onSvgReady, onElementClick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
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

  // After the SVG lands in the DOM, hand it to the parent.
  useEffect(() => {
    if (!svg || !hostRef.current || !onSvgReady) return;
    const svgEl = hostRef.current.querySelector('svg');
    if (svgEl) onSvgReady(svgEl as SVGSVGElement);
  }, [svg, onSvgReady]);

  const handleClick = onElementClick
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        const target = (e.target as Element).closest<SVGElement>('[id]');
        if (!target) return;
        const id = target.id;
        const kind = target.getAttribute('class') ?? '';
        onElementClick(id, kind);
      }
    : undefined;

  if (error) {
    return <div className={className}><span className="loading">score · error</span></div>;
  }
  if (svg === null) {
    return <div className={className}><span className="loading">— sounding —</span></div>;
  }
  return (
    <div
      ref={hostRef}
      className={className}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
