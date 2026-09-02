// EXP06: select({measureRange}) + redoLayout — do ids stay identical to a full render? What does the timemap cover? What does g.measure positional indexing (heatmap.ts) see?
// Run: node exp06-select-measurerange.mjs
import { makeTk, mei, idIndex, parseGroups, report } from './lib.mjs';

const tk = await makeTk();
let body = '';
for (let i = 1; i <= 8; i++) {
  body += `<measure xml:id="m${i}" n="${i}"><staff n="1"><layer n="1"><note xml:id="n${i}a" pname="c" oct="4" dur="2"/><note xml:id="n${i}b" pname="e" oct="4" dur="2"/></layer></staff><staff n="2"><layer n="1"><note xml:id="n${i}c" pname="c" oct="3" dur="1"/></layer></staff></measure>\n`;
}
const doc = mei(body);
console.log('loadData', tk.loadData(doc));
const full = tk.renderToSVG(1);
const fullIdx = idIndex(full);
const fullTm = tk.renderToTimemap({ includeMeasures: true, includeRests: false });

tk.select({ measureRange: '5-8' });
tk.redoLayout();
const part = tk.renderToSVG(1);
const partIdx = idIndex(part);
const partTm = tk.renderToTimemap({ includeMeasures: true, includeRests: false });

const noteIds = [...fullIdx.keys()].filter((k) => /^n\d/.test(k) || /^m\d/.test(k));
report('EXP06 ids present in full vs measureRange 5-8 render', noteIds.map((id) => ({ id, full: fullIdx.has(id), part: partIdx.has(id) })));
report('EXP06 g.measure document order in partial render (heatmap indexes measures[m-1])', [parseGroups(part).filter((g) => g.class === 'measure').map((g) => g.id)]);
report('EXP06 timemap full (first/last)', [fullTm[0], fullTm[fullTm.length - 1], { entries: fullTm.length }]);
report('EXP06 timemap after select 5-8 (first/last)', [partTm[0], partTm[partTm.length - 1], { entries: partTm.length }]);
report('EXP06 getTimeForElement n5a full-vs-part / getPageWithElement n1a in part', [{ n5a_ms: tk.getTimeForElement('n5a'), n1a_ms: tk.getTimeForElement('n1a'), n1a_page: tk.getPageWithElement('n1a'), n5a_page: tk.getPageWithElement('n5a') }]);
// Does select persist across the next loadData on the shared toolkit (toolkit.ts never clears it)?
console.log('reload', tk.loadData(doc));
const again = tk.renderToSVG(1);
report('EXP06 after a plain reload with no select() call: measures rendered', [parseGroups(again).filter((g) => g.class === 'measure').map((g) => g.id)]);
tk.select({});
tk.redoLayout();
report('EXP06 after select({}) + redoLayout', [parseGroups(tk.renderToSVG(1)).filter((g) => g.class === 'measure').map((g) => g.id)]);
