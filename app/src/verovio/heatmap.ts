/**
 * Section heatmap overlays on a Verovio-rendered SVG.
 *
 * Verovio emits one `<g class="measure">` per bar, in document order. We index
 * those, parse each section's "mm. N–M" range, and inject a colored rect into
 * each measure group so it sits behind the staff content.
 */

const HEATMAP_CLASS = 'sounding-heat-overlay';

export interface HeatSection {
  id: string;
  /** Like "mm. 1–8", "mm. 17–24", or "mm. 25". */
  range: string;
  /** 0–1, drives the color from coral → krill → lumen. */
  heat: number;
  /** Whether this is the currently pinned section (gets a brighter ring). */
  active?: boolean;
}

export function heatColor(heat: number): string {
  // Mirror the depth-strip gradient: red → amber → mint.
  if (heat > 0.65) return 'var(--lumen)';
  if (heat > 0.32) return 'var(--krill)';
  return 'var(--coral)';
}

export function parseRange(range: string): [number, number] | null {
  // Accepts "mm. 1–8", "mm. 1-8", "mm. 5", "1–8".
  const m = range.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = range.match(/(\d+)/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

/**
 * Add (or replace) heatmap overlays for the given sections.
 *
 * Measures in the SVG are 1-indexed in document order. If a section refers to
 * a measure that isn't currently rendered (e.g. only bars 1–8 are visible but
 * the section spans 17–24), those bars are skipped silently.
 */
export function paintHeatmap(svg: SVGSVGElement, sections: HeatSection[]): void {
  // Clear any previous overlays before re-painting.
  svg.querySelectorAll(`.${HEATMAP_CLASS}`).forEach((el) => el.remove());

  const measures = Array.from(svg.querySelectorAll<SVGGElement>('g.measure'));
  if (measures.length === 0) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  for (const section of sections) {
    const parsed = parseRange(section.range);
    if (!parsed) continue;
    const [start, end] = parsed;
    const fill = heatColor(section.heat);

    for (let m = start; m <= end; m++) {
      const group = measures[m - 1];
      if (!group) continue;
      let bbox: DOMRect;
      try {
        bbox = group.getBBox();
      } catch {
        continue;
      }
      if (bbox.width === 0 || bbox.height === 0) continue;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', `${HEATMAP_CLASS} heat-rect`);
      rect.setAttribute('data-section-id', section.id);
      rect.setAttribute('x', String(bbox.x));
      rect.setAttribute('y', String(bbox.y));
      rect.setAttribute('width', String(bbox.width));
      rect.setAttribute('height', String(bbox.height));
      rect.setAttribute('fill', fill);
      rect.setAttribute('opacity', section.active ? '0.28' : '0.16');
      rect.setAttribute('pointer-events', 'none');
      // Insert as the first child so the staff renders on top.
      group.insertBefore(rect, group.firstChild);
    }
  }
}

/**
 * Highlight a measure range with a brighter "selection" wash on top of any
 * existing heatmap. Pass null to clear.
 */
export function paintSelection(
  svg: SVGSVGElement,
  range: [number, number] | null,
): void {
  svg.querySelectorAll('.sounding-selection-overlay').forEach((el) => el.remove());
  if (!range) return;

  const measures = Array.from(svg.querySelectorAll<SVGGElement>('g.measure'));
  if (measures.length === 0) return;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  for (let m = range[0]; m <= range[1]; m++) {
    const group = measures[m - 1];
    if (!group) continue;
    let bbox: DOMRect;
    try {
      bbox = group.getBBox();
    } catch {
      continue;
    }
    if (bbox.width === 0 || bbox.height === 0) continue;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'sounding-selection-overlay');
    rect.setAttribute('x', String(bbox.x - 60));
    rect.setAttribute('y', String(bbox.y - 60));
    rect.setAttribute('width', String(bbox.width + 120));
    rect.setAttribute('height', String(bbox.height + 120));
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'var(--lumen-bright)');
    rect.setAttribute('stroke-width', '12');
    rect.setAttribute('opacity', '0.85');
    rect.setAttribute('pointer-events', 'none');
    group.insertBefore(rect, group.firstChild);
  }
}

/**
 * Read the source measure number (1-indexed) from a Verovio-generated element id
 * by walking up to the closest measure ancestor.
 */
export function findMeasureNumber(svg: SVGSVGElement, elementId: string): number | null {
  const el = svg.querySelector(`[id="${elementId}"]`);
  if (!el) return null;
  const measureGroup = el.closest('g.measure');
  if (!measureGroup) return null;
  const measures = Array.from(svg.querySelectorAll('g.measure'));
  const idx = measures.indexOf(measureGroup as Element);
  return idx >= 0 ? idx + 1 : null;
}
