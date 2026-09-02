// EXP13: system/page breaks vs the id contract — a slur/tie/hairpin spanning a system break: how many <g> carry its id? Multi-page: what does renderToSVG(1) omit? What does breaks:'none' do to a 40-bar score?
// Run: node exp13-breaks-pages.mjs
import { makeTk, mei, idIndex, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
let body = '';
for (let i = 1; i <= 40; i++) {
  body += `<measure xml:id="m${i}" n="${i}"><staff n="1"><layer n="1"><note xml:id="n${i}a" pname="c" oct="5" dur="4"/><note xml:id="n${i}b" pname="d" oct="5" dur="4"/><note xml:id="n${i}c" pname="e" oct="5" dur="4"/><note xml:id="n${i}d" pname="f" oct="5" dur="4"/></layer></staff><staff n="2"><layer n="1"><note xml:id="n${i}e" pname="c" oct="3" dur="1"/></layer></staff>`;
  if (i === 3) body += `<slur xml:id="slurAcross" startid="#n3a" endid="#n6d"/><tie xml:id="tieAcross" startid="#n3e" endid="#n4e"/><hairpin xml:id="hpAcross" staff="1" tstamp="1" tstamp2="3m+4" form="cres"/>`;
  body += `</measure>\n`;
}
const doc = mei(body);

// A) app defaults: breaks none, adjustPageHeight, no pageWidth.
console.log('load A', tk.loadData(doc));
let svg = tk.renderToSVG(1);
let gs = parseGroups(svg);
const widthAttr = (svg.match(/<svg[^>]*width="([^"]*)"/) || [])[1];
const viewBox = (svg.match(/viewBox="([^"]*)"/) || [])[1];
report('EXP13 A breaks:none — pages, systems, svg width/viewBox, ids for spanning elements', [{ pages: tk.getPageCount(), systems: gs.filter((g) => g.class === 'system').length, widthAttr, viewBox, slur: (idIndex(svg).get('slurAcross') || []).length, tie: (idIndex(svg).get('tieAcross') || []).length, hairpin: (idIndex(svg).get('hpAcross') || []).length }]);

// B) breaks auto with a laptop-ish page width: systems wrap; where do the spanning elements land?
tk.setOptions({ breaks: 'auto', pageWidth: 2100, pageHeight: 60000, adjustPageHeight: true });
console.log('load B', tk.loadData(doc));
svg = tk.renderToSVG(1);
gs = parseGroups(svg);
const idx = idIndex(svg);
const dupes = [...idx.entries()].filter(([, h]) => h.length > 1).map(([id, h]) => `${id}×${h.length} (${h[0].class})`);
report('EXP13 B breaks:auto width 2100 — pages, systems, duplicated ids', [{ pages: tk.getPageCount(), systems: gs.filter((g) => g.class === 'system').length, dupes }]);
report('EXP13 B raw <g> tags for slurAcross', [svg.split('\n').filter((l) => l.includes('slurAcross')).map((l) => l.trim().slice(0, 120))]);

// C) breaks auto with a small page height: multiple pages; page 1 SVG lacks later measures; getPageWithElement tells which page.
tk.setOptions({ breaks: 'auto', pageWidth: 2100, pageHeight: 2970, adjustPageHeight: false });
console.log('load C', tk.loadData(doc));
svg = tk.renderToSVG(1);
const p1 = idIndex(svg);
report('EXP13 C page-sized — page count, n1a/n20a/n40a in page-1 SVG, getPageWithElement', [{ pages: tk.getPageCount(), n1a: p1.has('n1a'), n20a: p1.has('n20a'), n40a: p1.has('n40a'), pageOf20: tk.getPageWithElement('n20a'), pageOf40: tk.getPageWithElement('n40a') }]);
const tm = tk.renderToTimemap({ includeMeasures: true });
report('EXP13 C timemap still covers all pages? last entry', [tm[tm.length - 1], { entries: tm.length }]);
