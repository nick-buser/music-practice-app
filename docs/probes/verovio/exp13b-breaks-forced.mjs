// EXP13b: FORCE a system break inside a slur / tie / hairpin and force multiple pages; count <g> per id and what page-1 SVG omits.
// Run: node exp13b-breaks-forced.mjs
import { makeTk, mei, idIndex, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
let body = '';
for (let i = 1; i <= 12; i++) {
  body += `<measure xml:id="m${i}" n="${i}"><staff n="1"><layer n="1"><note xml:id="n${i}a" pname="c" oct="5" dur="4"/><note xml:id="n${i}b" pname="d" oct="5" dur="4"/><note xml:id="n${i}c" pname="e" oct="5" dur="4"/><note xml:id="n${i}d" pname="f" oct="5" dur="4"/></layer></staff><staff n="2"><layer n="1"><note xml:id="n${i}e" pname="c" oct="3" dur="1"/></layer></staff>`;
  if (i === 1) body += `<slur xml:id="slurAcross" startid="#n1a" endid="#n3d"/><hairpin xml:id="hpAcross" staff="1" tstamp="1" tstamp2="2m+4" form="cres"/>`;
  if (i === 2) body += `<tie xml:id="tieAcross" startid="#n2e" endid="#n3e"/>`;
  body += `</measure>\n`;
}
const doc = mei(body);

// Force ~2 measures per system: tiny page width; and force pages: small page height.
tk.setOptions({ breaks: 'auto', pageWidth: 900, pageHeight: 1400, adjustPageHeight: false, scale: 40 });
console.log('load', tk.loadData(doc));
const pages = tk.getPageCount();
const per = [];
const allIdx = new Map();
for (let p = 1; p <= pages; p++) {
  const svg = tk.renderToSVG(p);
  const gs = parseGroups(svg);
  const idx = idIndex(svg);
  per.push({ page: p, systems: gs.filter((g) => g.class === 'system').length, measures: gs.filter((g) => g.class === 'measure').map((g) => g.id), slur: (idx.get('slurAcross') || []).length, tie: (idx.get('tieAcross') || []).length, hairpin: (idx.get('hpAcross') || []).length });
  for (const [id, hits] of idx) allIdx.set(id, (allIdx.get(id) || 0) + hits.length);
}
report('EXP13b per-page', per);
report('EXP13b ids appearing more than once across all pages', [[...allIdx.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`)]);
report('EXP13b getPageWithElement', ['n1a', 'n3d', 'n6a', 'n12d', 'slurAcross', 'tieAcross', 'hpAcross'].map((id) => ({ id, page: tk.getPageWithElement(id) })));
// what renderToSVG(1) alone (the app's only call) contains
const p1 = idIndex(tk.renderToSVG(1));
report('EXP13b page-1-only render: which note ids resolvable', [{ n1a: p1.has('n1a'), n6a: p1.has('n6a'), n12a: p1.has('n12a') }]);
// And the same with breaks:'none' (app default) but many bars: one system, width?
tk.setOptions({ breaks: 'none', adjustPageHeight: true, pageWidth: 2100 });
tk.loadData(doc);
const svgNone = tk.renderToSVG(1);
report('EXP13b breaks:none + pageWidth 2100: svg width attr / systems / measures on page 1', [{ width: (svgNone.match(/<svg[^>]*width="([^"]*)"/) || [])[1], systems: parseGroups(svgNone).filter((g) => g.class === 'system').length, measures: parseGroups(svgNone).filter((g) => g.class === 'measure').length, pages: tk.getPageCount() }]);
