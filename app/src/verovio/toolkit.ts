/**
 * Verovio toolkit loader.
 * The WASM module is large (~3 MB) and slow to instantiate, so we share a single
 * toolkit across the app and gate every caller on the same promise.
 */

import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

import { toMei } from '../score/mei';
import { validateScoreDoc } from '../score/schema';
import type { Issue, ScoreDoc } from '../score/types';

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
  // setOptions MERGES: a pageWidth or svgHtml5 left behind by another caller
  // persists into a DEFAULTS-shaped call (`exp21` — pageWidth 900 and
  // svgHtml5 true survived a full DEFAULTS setOptions). The toolkit is shared,
  // so every entry point resets first.
  tk.resetOptions();
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
  /** The measure that begins here, when the timemap was built with `includeMeasures`. */
  measureOn?: string;
  /** `<rest>` ids beginning here, when the timemap was built with `includeRests`. */
  restsOn?: string[];
  /** `<rest>` ids ending here. `<mRest>` ids never appear in either (`exp22` K). */
  restsOff?: string[];
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
  tk.resetOptions();
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

/* ---------------------------------------------------------------------------
 * Native ScoreDoc rendering (SC1).
 * ------------------------------------------------------------------------- */

/** Thrown by `renderScoreDoc` when the document fails `validateScoreDoc`. */
export class ScoreDocInvalidError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`ScoreDoc is invalid: ${issues.map((i) => `${i.code} at ${i.path.join('.')}`).join('; ')}`);
    this.name = 'ScoreDocInvalidError';
  }
}

export interface RenderScoreDocOptions {
  /** Target width of the rendered system in CSS pixels. */
  widthPx: number;
  /** Render only this inclusive range of measures (by ScoreDoc measure id). */
  measureIds?: { start: string; end: string };
}

export interface RenderScoreDocResult {
  svg: string;
  timemap: TimemapEntry[];
  /** The MEI actually loaded — kept so a caller can snapshot or debug it. */
  mei: string;
}

const NATIVE_SCALE = 40;

/**
 * Render a native ScoreDoc: validate, serialize, load, render, timemap.
 *
 * Everything unusual here is forced by a measured Verovio behaviour:
 *
 * - **Validate first, and throw.** Verovio accepts an overfull bar, a missing
 *   staff, duplicate ids and unknown elements with `loadData → 1` and an empty
 *   `getLog()` (`exp19`, `exp08`) — it renders something plausible and shifts
 *   every later onset. `loadData === false` is therefore an *internal* error,
 *   never validation.
 * - **`resetOptions()` then `xmlIdSeed` before every load.** Verovio re-seeds
 *   its id RNG on `setOptions`, and a seed set once at construction is consumed
 *   by the first load: with the seed re-set before each `loadData` one instance
 *   produces byte-identical SVG (`exp21`), and two fresh instances on the same
 *   seed agree (`exp20`).
 * - **One tall page.** `pageHeight: 60000` (Verovio's maximum) plus
 *   `adjustPageHeight`, because a bounded page silently omits every element on
 *   later pages from `renderToSVG(1)` (`exp13b`, `exp21`) and anchors, cursor
 *   and hit-testing would all fail for the second half of the score.
 * - **Never `svgHtml5`** — it replaces every `id=` with `data-id=` and breaks
 *   every `[id="…"]` lookup (`exp14b`).
 * - **`includeRests: true`** so `<rest>` ids are addressable in time. `<mRest>`
 *   ids never appear even so (`exp22` K); a measure rest is located through its
 *   measure's `measureOn`.
 * - **Windows are verified, not trusted.** `select({start,end})` returns 1
 *   whether it worked or not: a note id as `start` renders the whole score, and
 *   an unresolvable `end` silently extends the window to the last measure
 *   (`exp22` D). So the rendered `g.measure` ids are compared against the
 *   requested range and a mismatch throws.
 */
export async function renderScoreDoc(
  doc: ScoreDoc,
  options: RenderScoreDocOptions,
): Promise<RenderScoreDocResult> {
  return renderScoreDocOn(await getVerovio(), doc, options);
}

/**
 * `renderScoreDoc` against a caller-supplied toolkit.
 *
 * The app always wants the shared instance, but determinism across *instances*
 * is a property the snapshot tests have to be able to check — and a test that
 * re-implemented the option set here would be testing its own copy of the rules
 * rather than these ones.
 */
export function renderScoreDocOn(
  tk: VerovioToolkit,
  doc: ScoreDoc,
  options: RenderScoreDocOptions,
): RenderScoreDocResult {
  const issues = validateScoreDoc(doc);
  if (issues.length > 0) throw new ScoreDocInvalidError(issues);

  const mei = toMei(doc);
  tk.resetOptions();
  tk.setOptions({
    inputFrom: 'mei',
    xmlIdSeed: 1,
    scale: NATIVE_SCALE,
    breaks: 'encoded',
    pageWidth: (options.widthPx * 100) / NATIVE_SCALE,
    pageHeight: 60000,
    adjustPageHeight: true,
    header: 'none',
    footer: 'none',
    pageMarginLeft: 0,
    pageMarginRight: 0,
    pageMarginTop: 0,
    pageMarginBottom: 0,
  } as unknown as Record<string, unknown>);

  if (!tk.loadData(mei)) {
    throw new Error('renderScoreDoc: Verovio refused a document that passed validateScoreDoc');
  }

  let expectedMeasures: string[] | null = null;
  if (options.measureIds) {
    const { start, end } = options.measureIds;
    const from = doc.measures.findIndex((m) => m.id === start);
    const to = doc.measures.findIndex((m) => m.id === end);
    if (from < 0 || to < 0 || to < from) {
      throw new Error(`renderScoreDoc: measure window ${start}..${end} is not a range in this document`);
    }
    expectedMeasures = doc.measures.slice(from, to + 1).map((m) => m.id);
    tk.select({ start, end });
    tk.redoLayout();
  }

  const svg = tk.renderToSVG(1);
  if (tk.getPageCount() !== 1) {
    throw new Error(`renderScoreDoc: expected one page, got ${tk.getPageCount()}`);
  }
  if (expectedMeasures) {
    const rendered = [...svg.matchAll(/<g id="([^"]+)" class="measure"/g)].map((m) => m[1]);
    if (rendered.join(',') !== expectedMeasures.join(',')) {
      throw new Error(
        `renderScoreDoc: window rendered [${rendered.join(',')}], expected [${expectedMeasures.join(',')}]`,
      );
    }
  }
  const timemap = tk.renderToTimemap({
    includeMeasures: true,
    includeRests: true,
  }) as TimemapEntry[];
  return { svg, timemap, mei };
}

/**
 * Foreign (imported) scores: MusicXML, MEI or ABC bytes rendered as-is.
 *
 * `xmlIdChecksum` makes a Verovio-minted id a pure function of the artifact
 * bytes and the Verovio build — without it default minting differs on every
 * single load (`exp05`), so an element anchor on a foreign score would be
 * worthless. `svgAdditionalAttribute: ['measure@n']` surfaces the encoded
 * measure numbers as `data-n` (`exp14`) for the gutter; native measures need
 * nothing, because the ScoreDoc already knows.
 *
 * SC7 consumes this entry; it does not re-do it.
 */
export async function renderForeignToSvg(
  data: string,
  options: RenderOptions = {},
): Promise<string> {
  const tk = await getVerovio();
  const { measureRange, ...toolkitOpts } = { ...DEFAULTS, ...options };
  tk.resetOptions();
  tk.setOptions({
    ...toolkitOpts,
    xmlIdChecksum: true,
    svgAdditionalAttribute: ['measure@n'],
  } as unknown as Record<string, unknown>);
  if (!tk.loadData(data)) {
    throw new Error('Verovio: failed to load foreign score data');
  }
  if (measureRange) {
    tk.select({ measureRange });
    tk.redoLayout();
  }
  return tk.renderToSVG(1);
}
