/**
 * Verovio toolkit loader.
 * The WASM module is large (~3 MB) and slow to instantiate, so we share a single
 * toolkit across the app and gate every caller on the same promise.
 */

import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

let toolkitPromise: Promise<VerovioToolkit> | null = null;

export function getVerovio(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = createVerovioModule().then((mod) => new VerovioToolkit(mod));
  }
  return toolkitPromise;
}

export type RenderFormat = 'abc' | 'mei' | 'musicxml' | 'humdrum' | 'pae';

export interface RenderOptions {
  /** Auto-detected when omitted; pass for safety with hand-written ABC. */
  inputFrom?: RenderFormat;
  /** Verovio output scale, 1–1000. Default 40. */
  scale?: number;
  /** Page dimensions in px. */
  pageWidth?: number;
  pageHeight?: number;
  /** Margins / padding (in MEI units, default 0). */
  pageMarginLeft?: number;
  pageMarginRight?: number;
  pageMarginTop?: number;
  pageMarginBottom?: number;
  /** Crop the page to the content (good for thumbnails). */
  adjustPageHeight?: boolean;
  adjustPageWidth?: boolean;
  /** Header/footer suppression for thumbnails. */
  header?: 'none' | 'auto' | 'encoded';
  footer?: 'none' | 'auto' | 'encoded';
  /** Hide visual elements that clutter a thumbnail. */
  breaks?: 'none' | 'auto' | 'line' | 'smart' | 'encoded';
  /** Optional measure range, 1-indexed, e.g. "1-2" or "1-end". */
  measureRange?: string;
}

const DEFAULTS: Required<
  Pick<
    RenderOptions,
    | 'scale'
    | 'adjustPageHeight'
    | 'header'
    | 'footer'
    | 'breaks'
    | 'pageMarginLeft'
    | 'pageMarginRight'
    | 'pageMarginTop'
    | 'pageMarginBottom'
  >
> = {
  scale: 40,
  adjustPageHeight: true,
  header: 'none',
  footer: 'none',
  breaks: 'none',
  pageMarginLeft: 0,
  pageMarginRight: 0,
  pageMarginTop: 0,
  pageMarginBottom: 0,
};

/**
 * Load `data` into Verovio and render page 1 to an SVG string.
 * Options are applied per call — Verovio's toolkit is stateful, so we always
 * setOptions before loading.
 */
export async function renderToSvg(data: string, options: RenderOptions = {}): Promise<string> {
  const tk = await getVerovio();
  const { measureRange, ...toolkitOpts } = { ...DEFAULTS, ...options };
  tk.setOptions(toolkitOpts as unknown as Record<string, unknown>);
  if (!tk.loadData(data)) {
    throw new Error('Verovio: failed to load score data');
  }
  if (measureRange) {
    tk.select({ measureRange });
    tk.redoLayout();
  }
  return tk.renderToSVG(1);
}

/** One entry of Verovio's timemap: a moment in score-time and the notes that change there. */
export interface TimemapEntry {
  /** Milliseconds at the score's encoded tempo. */
  tstamp: number;
  /** Position in quarter notes. */
  qstamp: number;
  /** Note element ids that begin sounding at this moment. */
  on?: string[];
  /** Note element ids that stop sounding at this moment. */
  off?: string[];
  /** Tempo (bpm) in effect from this moment, if it changes here. */
  tempo?: number;
}

/**
 * Render a score AND capture its timemap in a single load, so the SVG note ids
 * and the timemap entries are guaranteed to refer to the same engraving.
 *
 * The timemap is a snapshot — once returned it's plain data, so it survives the
 * shared toolkit being reused by other components (thumbnails, etc.).
 */
export async function renderWithTimemap(
  data: string,
  options: RenderOptions = {},
): Promise<{ svg: string; timemap: TimemapEntry[] }> {
  const tk = await getVerovio();
  const { measureRange, ...toolkitOpts } = { ...DEFAULTS, ...options };
  tk.setOptions(toolkitOpts as unknown as Record<string, unknown>);
  if (!tk.loadData(data)) {
    throw new Error('Verovio: failed to load score data');
  }
  if (measureRange) {
    tk.select({ measureRange });
    tk.redoLayout();
  }
  const svg = tk.renderToSVG(1);
  const timemap = tk.renderToTimemap({ includeMeasures: true, includeRests: false }) as TimemapEntry[];
  return { svg, timemap };
}
