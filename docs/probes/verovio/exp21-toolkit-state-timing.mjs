// EXP21: shared-toolkit hygiene the doc's "toolkit.ts, unchanged" leans on — do options persist across setOptions calls? Is `inputFrom` a real 4.5.1 option? Does re-seeding xmlIdSeed before each load give byte-identical SVG on ONE instance? How long does a 32-bar grand-staff exercise take to load+render+timemap?
// Run: node exp21-toolkit-state-timing.mjs
import { makeTk, mei, report } from './lib.mjs';

const tk = await makeTk();
const avail = tk.getAvailableOptions();
const all = Object.values(avail.groups).flatMap((g) => Object.keys(g.options));
report('EXP21 option names: inputFrom / from / breaks / pageWidth present?', [{ inputFrom: all.includes('inputFrom'), from: all.includes('from'), breaks: all.includes('breaks'), pageWidth: all.includes('pageWidth'), adjustPageHeight: all.includes('adjustPageHeight') }]);

// Option persistence: set pageWidth 900 + svgHtml5, then a setOptions that omits them (as toolkit.ts DEFAULTS would).
tk.setOptions({ pageWidth: 900, svgHtml5: true, breaks: 'auto' });
tk.setOptions({ scale: 40, adjustPageHeight: true, header: 'none', footer: 'none', breaks: 'none', pageMarginLeft: 0, pageMarginRight: 0, pageMarginTop: 0, pageMarginBottom: 0 });
const o = tk.getOptions();
report('EXP21 after a DEFAULTS-shaped setOptions, do earlier pageWidth/svgHtml5 persist?', [{ pageWidth: o.pageWidth, svgHtml5: o.svgHtml5, breaks: o.breaks }]);
tk.resetOptions?.();
report('EXP21 resetOptions exists?', [{ hasResetOptions: typeof tk.resetOptions === 'function', pageWidthAfterReset: tk.getOptions().pageWidth, svgHtml5AfterReset: tk.getOptions().svgHtml5 }]);

// Re-seed before every load on one instance → byte-identical SVG?
const doc = mei(`<measure xml:id="m1" n="1"><staff n="1"><layer n="1"><note xml:id="n1" pname="c" oct="4" dur="8" dots="1" accid="s"/><note xml:id="n2" pname="d" oct="4" dur="16"/><rest xml:id="r1" dur="2"/><rest dur="4"/></layer></staff><staff n="2"><layer n="1"><mRest xml:id="mr1"/></layer></staff></measure>`);
const renderSeeded = () => { tk.setOptions({ xmlIdSeed: 12345, scale: 40, adjustPageHeight: true, header: 'none', footer: 'none', breaks: 'none' }); tk.loadData(doc); return tk.renderToSVG(1); };
const s1 = renderSeeded(), s2 = renderSeeded();
report('EXP21 xmlIdSeed re-set before each load, same instance', [{ identical: s1 === s2 }]);

// Timing: 32 bars, grand staff, 8 eighths RH (beamed in pairs of 4) + 4 quarters LH per bar, with slurs.
let body = '';
for (let i = 1; i <= 32; i++) {
  const rh = [0, 1].map((h) => `<beam xml:id="b${i}_${h}">` + [0, 1, 2, 3].map((k) => `<note xml:id="n${i}_${h}_${k}" pname="${'cdefgab'[(i + k) % 7]}" oct="${4 + (k % 2)}" dur="8"${k === 1 ? ' accid="s" accid.ges="s"' : ''}/>`).join('') + '</beam>').join('');
  const lh = [0, 1, 2, 3].map((k) => `<chord xml:id="ch${i}_${k}" dur="4"><note xml:id="l${i}_${k}a" pname="c" oct="3"/><note xml:id="l${i}_${k}b" pname="e" oct="3"/><note xml:id="l${i}_${k}c" pname="g" oct="3"/></chord>`).join('');
  body += `<measure xml:id="m${i}" n="${i}"><staff xml:id="m${i}s1" n="1"><layer xml:id="m${i}s1v1" n="1">${rh}</layer></staff><staff xml:id="m${i}s2" n="2"><layer xml:id="m${i}s2v1" n="1">${lh}</layer></staff><slur xml:id="sl${i}" startid="#n${i}_0_0" endid="#n${i}_1_3"/><dynam xml:id="dy${i}" staff="1" tstamp="1">${i % 2 ? 'p' : 'f'}</dynam></measure>`;
}
const big = mei(body);
for (const [label, opts] of [['breaks:none (app default)', { breaks: 'none', adjustPageHeight: true }], ['breaks:auto pageWidth 2100 tall page', { breaks: 'auto', pageWidth: 2100, pageHeight: 60000, adjustPageHeight: true }]]) {
  tk.setOptions({ xmlIdSeed: 1, scale: 40, header: 'none', footer: 'none', ...opts });
  const t0 = performance.now(); tk.loadData(big); const t1 = performance.now();
  const svg = tk.renderToSVG(1); const t2 = performance.now();
  const tm = tk.renderToTimemap({ includeMeasures: true }); const t3 = performance.now();
  report(`EXP21 32-bar timing — ${label}`, [{ loadMs: Math.round(t1 - t0), svgMs: Math.round(t2 - t1), timemapMs: Math.round(t3 - t2), svgKB: Math.round(svg.length / 1024), pages: tk.getPageCount(), width: (svg.match(/<svg[^>]*width="([^"]*)"/) || [])[1], height: (svg.match(/<svg[^>]*height="([^"]*)"/) || [])[1], timemapEntries: tm.length }]);
}
