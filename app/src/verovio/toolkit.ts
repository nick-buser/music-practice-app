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
  const opts = { ...DEFAULTS, ...options };
  tk.setOptions(opts as unknown as Record<string, unknown>);
  if (!tk.loadData(data)) {
    throw new Error('Verovio: failed to load score data');
  }
  if (options.measureRange) {
    tk.select({ measureRange: options.measureRange });
  }
  return tk.renderToSVG(1);
}
