// @vitest-environment node
// Verovio's WASM toolkit loads under node, not jsdom.
import { beforeAll, describe, expect, it } from 'vitest';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

import { grandStaffExercise, overfullVoice, POSITIVE_FIXTURES } from '../score/__fixtures__';
import { toMei } from '../score/mei';
import { renderScoreDoc, renderScoreDocOn, renderToSvg, ScoreDocInvalidError } from './toolkit';

describe('renderScoreDoc — determinism (criterion 2)', () => {
  let shared: VerovioToolkit;
  let a: VerovioToolkit;
  let b: VerovioToolkit;

  beforeAll(async () => {
    shared = new VerovioToolkit(await createVerovioModule());
    a = new VerovioToolkit(await createVerovioModule());
    b = new VerovioToolkit(await createVerovioModule());
  });

  it.each(POSITIVE_FIXTURES)('%s: two calls on one shared toolkit are byte-identical', (_name, make) => {
    // exp20/exp21: without re-setting xmlIdSeed before each load, a second load
    // on the same instance differs on 45 lines — Verovio re-seeds its id RNG on
    // setOptions and the construction-time seed is consumed by the first load.
    const first = renderScoreDocOn(shared, make(), { widthPx: 1600 }).svg;
    const second = renderScoreDocOn(shared, make(), { widthPx: 1600 }).svg;
    expect(second).toBe(first);
  });

  it.each(POSITIVE_FIXTURES)('%s: two toolkits produce the same bytes', (_name, make) => {
    expect(renderScoreDocOn(b, make(), { widthPx: 1600 }).svg).toBe(
      renderScoreDocOn(a, make(), { widthPx: 1600 }).svg,
    );
  });

  it('is byte-identical on a genuinely fresh toolkit too', async () => {
    const fresh = new VerovioToolkit(await createVerovioModule());
    expect(renderScoreDocOn(fresh, grandStaffExercise(), { widthPx: 1600 }).svg).toBe(
      renderScoreDocOn(shared, grandStaffExercise(), { widthPx: 1600 }).svg,
    );
  });

  it('survives another caller having left options behind (exp21)', () => {
    // setOptions merges; a stray pageWidth or svgHtml5 persists into the next
    // DEFAULTS-shaped call unless every entry point resets first.
    shared.setOptions({ pageWidth: 400, svgHtml5: true, breaks: 'auto' });
    const after = renderScoreDocOn(shared, grandStaffExercise(), { widthPx: 1600 }).svg;
    const clean = renderScoreDocOn(a, grandStaffExercise(), { widthPx: 1600 }).svg;
    expect(after).toBe(clean);
  });
});

describe('renderScoreDoc — output shape', () => {
  let tk: VerovioToolkit;

  beforeAll(async () => {
    tk = new VerovioToolkit(await createVerovioModule());
  });

  it.each(POSITIVE_FIXTURES)('%s: one page, real ids, rests in the timemap', (_name, make) => {
    const doc = make();
    const { svg, timemap, mei } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    expect(svg.startsWith('<svg')).toBe(true);
    // exp14b: svgHtml5 rewrites every id= to data-id= and breaks [id="…"].
    expect(svg).not.toContain('data-id=');
    expect(svg).toContain('<g id=');
    expect(mei).toBe(toMei(doc));
    expect(timemap.length).toBeGreaterThan(0);
    expect(timemap[0].measureOn).toBe(doc.measures[0].id);
  });

  it('addresses <rest> ids in time (includeRests) but never <mRest> ids (exp22 K)', () => {
    const doc = grandStaffExercise();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const pickup = renderScoreDocOn(tk, POSITIVE_FIXTURES[1][1](), { widthPx: 1600 });
    expect(pickup.timemap.some((e) => (e.restsOn ?? []).length > 0)).toBe(true);
    const mrests = doc.measures.flatMap((m) =>
      m.staves.flatMap((s) => s.voices.flatMap((v) => v.events.filter((e) => e.kind === 'measureRest').map((e) => e.id))),
    );
    expect(mrests.length).toBeGreaterThan(0);
    for (const id of mrests) expect(JSON.stringify(timemap)).not.toContain(id);
  });

  it('honours the ScoreDoc system breaks', () => {
    // The exercise forces a break before bar 5, so a page wide enough for all
    // eight bars still renders two systems.
    const { svg } = renderScoreDocOn(tk, grandStaffExercise(), { widthPx: 4000 });
    expect((svg.match(/class="system"/g) ?? []).length).toBe(2);
  });
});

describe('renderScoreDoc — validation is the gate', () => {
  let tk: VerovioToolkit;

  beforeAll(async () => {
    tk = new VerovioToolkit(await createVerovioModule());
  });

  it('throws on an invalid document rather than rendering it', () => {
    // exp19: Verovio loads an overfull bar with loadData → 1 and an empty
    // getLog(), renders it, and silently shifts every later onset.
    const bad = overfullVoice();
    expect(() => renderScoreDocOn(tk, bad, { widthPx: 900 })).toThrow(ScoreDocInvalidError);
    try {
      renderScoreDocOn(tk, bad, { widthPx: 900 });
    } catch (err) {
      expect((err as ScoreDocInvalidError).issues.map((i) => i.code)).toContain('voice-overfull');
    }
  });

  it('throws before Verovio is touched, leaving the previous document loaded', () => {
    const doc = grandStaffExercise();
    renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const note = doc.measures[0].staves[0].voices[0].events[0];
    expect(() => renderScoreDocOn(tk, overfullVoice(), { widthPx: 900 })).toThrow();
    // Still the exercise: `loadData` was never reached with the bad document.
    // (The SVG bytes are deliberately not compared — a second `renderToSVG` on
    // the same load re-draws the glyph `<symbol>` suffixes from the id RNG,
    // which has already advanced. Byte-identity is a property of
    // re-seed + loadData + render, which is exactly what `renderScoreDoc` does.)
    expect(tk.getMIDIValuesForElement(note.id).pitch).toBe(67);
  });
});

describe('the legacy ABC path (criterion 8)', () => {
  // Every ABC caller passes a complete option set (`inputFrom`, `scale`,
  // `adjustPageHeight`, `header`, `footer`, `breaks`) and none sets pageWidth,
  // so `resetOptions()` is the only change here — and this proves a native
  // render, which does set `pageWidth`, cannot bleed into the next ABC one.
  const ABC = 'X:1\nM:4/4\nL:1/8\nK:C\nCDEF GABc|';
  const OPTS = {
    inputFrom: 'abc' as const,
    scale: 30,
    adjustPageHeight: true,
    header: 'none' as const,
    footer: 'none' as const,
    breaks: 'none' as const,
  };
  // Verovio mints a fresh random id for every ABC element on every load
  // (`exp05`), so the ids are compared away and the engraving is compared. The
  // milestone-end groups carry their milestone's minted id as a *class* token
  // (`exp01`), and the glyph `<symbol>` ids carry a per-render suffix, so both
  // of those go too.
  const engraving = (svg: string): string =>
    svg
      .replace(/ id="[^"]*"/g, '')
      .replace(/[EU][0-9A-F]{3}-[0-9a-z]+/g, 'GLYPH')
      .replace(/class="([^"]*)"/g, (_m, c: string) =>
        `class="${c.split(' ').filter((t) => !/^[a-z]{1,3}[0-9a-z]{6,9}$/.test(t)).join(' ')}"`,
      );

  it('renders the same engraving before and after a native ScoreDoc render', async () => {
    const before = await renderToSvg(ABC, OPTS);
    await renderScoreDoc(grandStaffExercise(), { widthPx: 1600 });
    const after = await renderToSvg(ABC, OPTS);
    expect(engraving(after)).toBe(engraving(before));
    expect(after).not.toContain('data-id=');
  });
});
